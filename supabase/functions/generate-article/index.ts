// Supabase Edge Function: generate-article
// Generates the article content via Anthropic and updates the article record.
// Called fire-and-forget from /api/articles/generate so the request returns
// immediately and the frontend can poll the article for completion.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function failArticle(articleId: string, reason: string) {
  await supabase
    .from('articles')
    .update({
      status: 'failed',
      generation_error: reason.slice(0, 1000),
    })
    .eq('id', articleId)
}

Deno.serve(async (req) => {
  let articleId: string | null = null
  try {
    const body = await req.json()
    articleId = body.article_id
    const { topic, tone, length, system_prompt, user_message } = body

    if (!articleId || !system_prompt || !user_message) {
      return new Response(
        JSON.stringify({ error: 'article_id, system_prompt, user_message required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!ANTHROPIC_API_KEY && !OPENROUTER_API_KEY) {
      await failArticle(articleId, 'Ingen AI API-nøkkel konfigurert')
      return new Response(
        JSON.stringify({ error: 'No AI key configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
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
          max_tokens: 4096,
          temperature: 0.7,
          system: system_prompt,
          messages: [{ role: 'user', content: user_message }],
        }),
      })
    } else {
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
            { role: 'system', content: system_prompt },
            { role: 'user', content: user_message },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      })
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      let detail = errText.slice(0, 200)
      try {
        const errJson = JSON.parse(errText)
        detail = errJson.error?.message || errJson.error || detail
      } catch { /* keep raw */ }
      await failArticle(articleId, `AI feilet (${aiResponse.status}): ${detail}`)
      return new Response(JSON.stringify({ error: detail }), { status: 502 })
    }

    const data = await aiResponse.json()
    const rawText = ANTHROPIC_API_KEY
      ? (data.content?.[0]?.text || '')
      : (data.choices?.[0]?.message?.content || '')

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
      await failArticle(articleId, 'AI returnerte ugyldig JSON')
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 500 })
    }

    const slug = article.slug || slugify(article.title)

    const { error: updateErr } = await supabase
      .from('articles')
      .update({
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
        generation_error: null,
        metadata: { meta_description: article.meta_description, tone, length },
      })
      .eq('id', articleId)

    if (updateErr) {
      await failArticle(articleId, `Lagring feilet: ${updateErr.message}`)
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, article_id: articleId }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate-article] Fatal:', err)
    if (articleId) await failArticle(articleId, msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
