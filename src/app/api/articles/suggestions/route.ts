// ── GET /api/articles/suggestions — AI Topic Suggestions ────────────────────
// Returns 5-10 article topic suggestions based on brand profile

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
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

  // ── Fetch brand profile ──
  const admin = createAdminClient()
  const { data: brand } = await admin
    .from('brand_profiles')
    .select('tone, target_audience, description, key_messages, tone_keywords')
    .eq('org_id', profile.org_id)
    .limit(1)
    .single()

  // ── Fetch existing article titles to avoid duplicates ──
  const { data: existing } = await supabase
    .from('articles')
    .select('title')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const existingTitles = (existing || []).map(a => a.title).join(', ')

  // ── Build prompt ──
  const brandContext = brand ? `
MERKEVARE:
- Beskrivelse: ${brand.description || 'Ikke oppgitt'}
- Tone: ${brand.tone || 'profesjonell'}
- Målgruppe: ${brand.target_audience || 'generelt publikum'}
- Nøkkelbudskap: ${(brand.key_messages || []).join(', ') || 'Ingen'}
- Tone-nøkkelord: ${(brand.tone_keywords || []).join(', ') || 'Ingen'}
` : 'Ingen merkevare-profil tilgjengelig. Foreslå generelle, nyttige artikkelemner.'

  const systemPrompt = `Du er en innholdsstrateg som foreslår artikkelemner på norsk bokmål.
Basert på merkevarens profil, foreslå 8 relevante og engasjerende artikkelemner.

${brandContext}

${existingTitles ? `EKSISTERENDE ARTIKLER (unngå duplikater): ${existingTitles}` : ''}

Svar KUN med gyldig JSON — en array av objekter:
[
  { "title": "Foreslått tittel", "description": "Kort beskrivelse (1 setning)", "keyword": "hovedsøkeord" }
]

Regler:
- Alle forslag på norsk bokmål
- Variasjon i emner (how-to, liste, guide, analyse, tips)
- Relevante for målgruppen
- SEO-vennlige titler
- Ingen markdown, bare rå JSON`

  // ── Call AI ──
  const apiKey = ANTHROPIC_API_KEY || OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Ingen AI API-nøkkel konfigurert' },
      { status: 500 }
    )
  }

  let aiResponse: Response

  if (ANTHROPIC_API_KEY) {
    aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Foreslå artikkelemner for denne merkevaren.' }],
      }),
    })
  } else {
    aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://some.aiagenten.no',
        'X-Title': 'SoMe Article Suggestions',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Foreslå artikkelemner for denne merkevaren.' },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    })
  }

  if (!aiResponse.ok) {
    console.error('[/api/articles/suggestions] AI error:', aiResponse.status)
    return NextResponse.json({ error: 'Kunne ikke hente forslag' }, { status: 502 })
  }

  let rawText: string
  try {
    const data = await aiResponse.json()
    if (ANTHROPIC_API_KEY) {
      rawText = data.content?.[0]?.text || ''
    } else {
      rawText = data.choices?.[0]?.message?.content || ''
    }
  } catch {
    return NextResponse.json({ error: 'Kunne ikke parse AI-respons' }, { status: 500 })
  }

  // Strip markdown fences
  let jsonText = rawText.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  try {
    const suggestions = JSON.parse(jsonText)
    return NextResponse.json(suggestions)
  } catch {
    console.error('[/api/articles/suggestions] bad JSON:', jsonText.slice(0, 300))
    return NextResponse.json({ error: 'Ugyldig JSON fra AI' }, { status: 500 })
  }
}
