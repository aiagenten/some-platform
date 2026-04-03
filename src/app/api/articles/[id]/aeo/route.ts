// ── POST /api/articles/[id]/aeo — AEO generation (FAQ + Schema.org) ─────────

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

function tiptapToText(content: Record<string, unknown> | null): string {
  if (!content) return ''
  try {
    const html = generateHTML(content as Parameters<typeof generateHTML>[0], [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
    ])
    // Strip HTML tags for plain text
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', profile.org_id)
    .single()
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const articleText = tiptapToText(article.content)
  if (!articleText || articleText.length < 50) {
    return NextResponse.json({ error: 'Artikkelen har for lite innhold å analysere' }, { status: 400 })
  }

  const apiKey = OPENROUTER_API_KEY || OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
  }

  const systemPrompt = `Du er en SEO/AEO-ekspert for norske nettsider. Du genererer strukturert data for å optimalisere synlighet i AI-verktøy (ChatGPT, Perplexity, Google AI Overview).

Returner alltid gyldig JSON — ingen markdown, ingen forklaring. Formatet er:
{
  "faqs": [
    { "question": "Spørsmål på norsk?", "answer": "Kort, presis svar (2-3 setninger)." }
  ],
  "featured_snippet": "Et kort sammendrag (40-60 ord) som svarer direkte på hovedtemaet i artikkelen. Skal være formulert slik at AI-verktøy kan sitere det direkte.",
  "schema_article": {
    "@type": "Article",
    "headline": "...",
    "description": "...",
    "keywords": "kommaseparerte nøkkelord"
  }
}`

  const userPrompt = `Analyser denne artikkelen og generer:
1. 3-5 relevante FAQ-spørsmål med svar (norsk bokmål)
2. Et featured snippet-sammendrag
3. Schema.org Article-metadata

Artikkel-tittel: ${article.title}
${article.target_keyword ? `Mål-nøkkelord: ${article.target_keyword}` : ''}

Artikkelinnhold:
${articleText.slice(0, 4000)}`

  try {
    const endpoint = OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    if (OPENROUTER_API_KEY) {
      headers['HTTP-Referer'] = 'https://some.aiagenten.no'
      headers['X-Title'] = 'SoMe AEO Generator'
    }

    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: OPENROUTER_API_KEY ? 'anthropic/claude-sonnet-4-5' : 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2048,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('[/api/articles/aeo] AI error:', aiRes.status, errText)
      return NextResponse.json({ error: `AI API error: ${aiRes.status}` }, { status: 502 })
    }

    const aiData = await aiRes.json()
    const rawContent = aiData.choices?.[0]?.message?.content || ''

    // Parse the JSON response — try to extract JSON from possible markdown wrapping
    let parsed
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent)
    } catch {
      return NextResponse.json({ error: 'Kunne ikke tolke AI-respons' }, { status: 502 })
    }

    // Build full Schema.org JSON-LD
    const schemaJsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: parsed.schema_article?.headline || article.title,
          description: parsed.schema_article?.description || article.excerpt || '',
          keywords: parsed.schema_article?.keywords || '',
          ...(article.featured_image_url ? { image: article.featured_image_url } : {}),
        },
        {
          '@type': 'FAQPage',
          mainEntity: (parsed.faqs || []).map((faq: { question: string; answer: string }) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        },
      ],
    }

    const aeoData = {
      faqs: parsed.faqs || [],
      featured_snippet: parsed.featured_snippet || '',
      schema_json_ld: schemaJsonLd,
      generated_at: new Date().toISOString(),
    }

    // Save to database
    await supabase
      .from('articles')
      .update({
        aeo_schema: aeoData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    return NextResponse.json({ success: true, aeo: aeoData })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AEO generation failed: ${message}` }, { status: 500 })
  }
}
