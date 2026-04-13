// ── POST /api/articles/generate — AI Article Generation ─────────────────────
// Generates a full article using Claude via OpenRouter, returns as draft

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function POST(request: NextRequest) {
  try {
  // ── Auth ──
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  // ── Parse request ──
  const body = await request.json()
  const { topic, tone: toneOverride, length = 'medium' } = body as {
    topic?: string
    tone?: string
    length?: 'short' | 'medium' | 'long'
  }

  // ── Fetch brand profile ──
  const admin = createAdminClient()
  const { data: brand } = await admin
    .from('brand_profiles')
    .select('tone, voice_description, tone_keywords, target_audience, description, colors, do_list, dont_list, key_messages')
    .eq('org_id', profile.org_id)
    .limit(1)
    .single()

  // ── Build prompt ──
  const lengthMap = {
    short: '500-800 ord',
    medium: '800-1500 ord',
    long: '1500-2500 ord',
  }

  const tone = toneOverride || brand?.tone || 'profesjonell og engasjerende'
  const audience = brand?.target_audience || 'generelt publikum'
  const brandContext = brand ? `
MERKEVARE-KONTEKST:
- Beskrivelse: ${brand.description || 'Ikke oppgitt'}
- Tone: ${tone}
- Stemme: ${brand.voice_description || 'Ikke oppgitt'}
- Tone-nøkkelord: ${(brand.tone_keywords || []).join(', ') || 'Ingen'}
- Målgruppe: ${audience}
- Nøkkelbudskap: ${(brand.key_messages || []).join(', ') || 'Ingen'}
- Gjør: ${(brand.do_list || []).join(', ') || 'Ingen'}
- Ikke gjør: ${(brand.dont_list || []).join(', ') || 'Ingen'}
` : ''

  const systemPrompt = `Du er en profesjonell innholdsskribent som skriver artikler på norsk bokmål.
Du lager engasjerende, SEO-optimaliserte artikler tilpasset merkevarens profil.

${brandContext}

VIKTIGE REGLER:
- Skriv alltid på norsk bokmål
- Bruk merkevarens tone og stil konsekvent
- Artikler skal være faktabaserte og verdifulle for leseren
- Inkluder relevante underoverskrifter (H2, H3)
- Skriv for målgruppen: ${audience}
- Lengde: ${lengthMap[length]}

Du skal returnere et JSON-objekt med følgende struktur (og INGEN annen tekst):
{
  "title": "Artikkelens tittel",
  "content": { TipTap-kompatibelt JSON-dokument },
  "meta_title": "SEO-tittel (maks 60 tegn)",
  "meta_description": "Meta-beskrivelse (maks 160 tegn)",
  "slug": "url-vennlig-slug",
  "excerpt": "2-3 setningers sammendrag",
  "target_keyword": "hovedsøkeord"
}

VIKTIG om content-formatet — TipTap JSON:
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Overskrift" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Brødtekst her." }] },
    { "type": "paragraph", "content": [
      { "type": "text", "text": "Normal tekst " },
      { "type": "text", "marks": [{ "type": "bold" }], "text": "fet tekst" },
      { "type": "text", "text": " og " },
      { "type": "text", "marks": [{ "type": "italic" }], "text": "kursiv tekst" }
    ]},
    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Punkt 1" }] }] }
    ]},
    { "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Sitat" }] }] }
  ]
}

Svar KUN med gyldig JSON — ingen markdown, ingen kodeblokker, bare rå JSON.`

  const userMessage = topic
    ? `Skriv en ${lengthMap[length]} artikkel om: ${topic}`
    : `Foreslå et relevant tema basert på merkevaren og skriv en ${lengthMap[length]} artikkel om det.`

  // ── Call AI API ──
  const apiKey = ANTHROPIC_API_KEY || OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ingen AI API-nøkkel konfigurert. Sett ANTHROPIC_API_KEY eller OPENROUTER_API_KEY.' },
      { status: 500 }
    )
  }

  let aiResponse: Response

  if (ANTHROPIC_API_KEY) {
    // Direct Anthropic API
    aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  } else {
    // OpenRouter fallback
    aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://some.aiagenten.no',
        'X-Title': 'SoMe Article Generator',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text()
    console.error('[/api/articles/generate] AI API error:', aiResponse.status, errText)
    // Parse error detail from AI provider response
    let detail = errText.slice(0, 200)
    try {
      const errJson = JSON.parse(errText)
      detail = errJson.error?.message || errJson.error || detail
    } catch { /* use raw text slice */ }
    return NextResponse.json(
      { error: `AI-generering feilet (${aiResponse.status}): ${detail}` },
      { status: 502 }
    )
  }

  // ── Parse AI response ──
  let rawText: string
  try {
    const data = await aiResponse.json()
    if (ANTHROPIC_API_KEY) {
      // Anthropic Messages API format
      rawText = data.content?.[0]?.text || ''
    } else {
      // OpenRouter / OpenAI format
      rawText = data.choices?.[0]?.message?.content || ''
    }
  } catch {
    return NextResponse.json({ error: 'Kunne ikke parse AI-respons' }, { status: 500 })
  }

  // Strip potential markdown code fences
  let jsonText = rawText.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  let article: {
    title: string
    content: Record<string, unknown>
    meta_title: string
    meta_description: string
    slug: string
    excerpt: string
    target_keyword?: string
  }

  try {
    article = JSON.parse(jsonText)
  } catch {
    console.error('[/api/articles/generate] Failed to parse JSON:', jsonText.slice(0, 500))
    return NextResponse.json({ error: 'AI returnerte ugyldig JSON' }, { status: 500 })
  }

  // ── Save article as draft ──
  const slug = article.slug || slugify(article.title)

  const { data: saved, error: saveErr } = await supabase
    .from('articles')
    .insert({
      org_id: profile.org_id,
      author_id: user.id,
      title: article.title,
      slug,
      content: article.content,
      excerpt: article.excerpt,
      meta_title: article.meta_title,
      meta_description: article.meta_description,
      target_keyword: article.target_keyword || topic || null,
      generated_by: 'ai',
      generation_prompt: topic || 'Automatisk tema',
      status: 'draft',
      metadata: {
        meta_description: article.meta_description,
      },
    })
    .select()
    .single()

  if (saveErr) {
    console.error('[/api/articles/generate] save error:', saveErr)
    return NextResponse.json({ error: saveErr.message }, { status: 500 })
  }

  return NextResponse.json(saved)
  } catch (err) {
    console.error('[/api/articles/generate] Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Artikkelgenerering feilet: ${message}` }, { status: 500 })
  }
}
