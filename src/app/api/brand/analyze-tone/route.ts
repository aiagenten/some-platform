import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

const TONE_ANALYSIS_PROMPT = `Analyser disse eksisterende SoMe-postene og trekk ut en tone-of-voice profil PÅ NORSK.

Returner et JSON-objekt med disse feltene:
- tone: string — overordnet tone (formell/uformell/vennlig/autoritativ/leken etc)
- typical_words: array med typiske ordvalg og uttrykk de bruker
- emoji_usage: object med { uses_emojis: boolean, common_emojis: string[], frequency: "ofte"/"sjelden"/"aldri" }
- sentence_length: string — "kort", "medium", eller "lang"
- dos: array med 3-5 ting de gjør konsekvent i postene (på norsk)
- donts: array med 3-5 ting de unngår i postene (på norsk)
- good_examples: array med 2-3 sitater fra postene som best representerer tonen
- voice_description: 1-2 setninger som beskriver stemmen deres (på norsk)
- tone_keywords: array med 3-5 norske nøkkelord som beskriver tonen

Svar KUN med gyldig JSON, ingen markdown, ingen forklaring.`

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { posts, org_id } = body

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'posts array is required and must not be empty' }, { status: 400 })
    }

    // Extract text content from posts
    const postTexts = posts
      .map((p: { text?: string; platform?: string }) => p.text || '')
      .filter((t: string) => t.trim().length > 0)

    if (postTexts.length === 0) {
      return NextResponse.json({
        error: 'Ingen poster med tekst funnet. Kan ikke analysere tone.',
      }, { status: 400 })
    }

    // Build content for analysis
    const content = postTexts
      .map((text: string, i: number) => `Post ${i + 1}:\n${text}`)
      .join('\n\n---\n\n')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: TONE_ANALYSIS_PROMPT },
          { role: 'user', content: `Her er ${postTexts.length} SoMe-poster å analysere:\n\n${content}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${err}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const toneProfile = JSON.parse(jsonMatch[0])

    // If org_id is provided, merge into brand_profile
    if (org_id) {
      const { data: existing } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('org_id', org_id)
        .single()

      if (existing) {
        // Merge tone data into existing brand profile
        const mergedDoList = [
          ...(existing.do_list || []),
          ...(toneProfile.dos || []),
        ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).slice(0, 8)

        const mergedDontList = [
          ...(existing.dont_list || []),
          ...(toneProfile.donts || []),
        ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).slice(0, 8)

        const mergedKeywords = [
          ...(existing.tone_keywords || []),
          ...(toneProfile.tone_keywords || []),
        ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).slice(0, 8)

        await supabase
          .from('brand_profiles')
          .update({
            do_list: mergedDoList,
            dont_list: mergedDontList,
            tone_keywords: mergedKeywords,
            // Only override tone/voice if not already set from website
            ...((!existing.tone || existing.tone === '') ? { tone: toneProfile.tone } : {}),
            ...((!existing.voice_description || existing.voice_description === '') ? { voice_description: toneProfile.voice_description } : {}),
          })
          .eq('org_id', org_id)
      }
    }

    return NextResponse.json({
      tone_profile: toneProfile,
      posts_analyzed: postTexts.length,
    })
  } catch (error) {
    console.error('Analyze tone error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
