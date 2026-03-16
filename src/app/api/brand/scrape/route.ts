import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

const BRAND_EXTRACTION_PROMPT = `You are a brand analyst. Analyze the following website content and extract a structured brand profile.

Return a JSON object with these fields:
- colors: array of hex color codes found or implied (e.g. ["#1a1a2e", "#e94560"])
- fonts: array of font names used (e.g. ["Inter", "Georgia"])
- logo_url: URL of the logo if found, or null
- tone: one-word tone (e.g. "professional", "playful", "authoritative")
- voice_description: 1-2 sentence description of the brand voice
- tone_keywords: array of 3-5 keywords describing the tone
- tagline: the brand tagline if found, or a suggested one
- description: 2-3 sentence brand description
- target_audience: who the brand seems to target
- do_list: array of 3-5 things the brand SHOULD do in communications
- dont_list: array of 3-5 things the brand should AVOID in communications
- key_messages: array of 3-5 key messages the brand conveys
- industry: the industry/sector

Respond ONLY with valid JSON, no markdown, no explanation.`

async function scrapeWithFirecrawl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null

  try {
    const FirecrawlApp = (await import('@mendable/firecrawl-js')).default
    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY })
    const result = await app.scrape(url, { formats: ['markdown'] })

    if (result && (result as Record<string, unknown>).markdown) {
      return ((result as Record<string, unknown>).markdown as string).slice(0, 8000)
    }
    return null
  } catch (error) {
    console.error('Firecrawl error:', error)
    return null
  }
}

async function scrapeWithCheerio(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandScraper/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove scripts, styles, nav, footer
    $('script, style, nav, footer, header, iframe, noscript').remove()

    const title = $('title').text().trim()
    const metaDesc = $('meta[name="description"]').attr('content') || ''
    const ogDesc = $('meta[property="og:description"]').attr('content') || ''
    const h1s = $('h1').map((_, el) => $(el).text().trim()).get().join('. ')
    const h2s = $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 5).join('. ')
    const paragraphs = $('p').map((_, el) => $(el).text().trim()).get().filter(p => p.length > 20).slice(0, 10).join('\n')

    // Try to find logo
    const logoUrl = $('img[alt*="logo" i], img[class*="logo" i], img[id*="logo" i]').first().attr('src') || null

    // Extract colors from inline styles and CSS
    const styleText = $('style').text() + $('[style]').map((_, el) => $(el).attr('style')).get().join(' ')
    const colorMatches = styleText.match(/#[0-9a-fA-F]{3,8}\b/g) || []

    const content = [
      `Title: ${title}`,
      `Description: ${metaDesc || ogDesc}`,
      `Headlines: ${h1s}`,
      `Subheadlines: ${h2s}`,
      `Content:\n${paragraphs}`,
      logoUrl ? `Logo: ${logoUrl}` : '',
      colorMatches.length ? `Colors found: ${Array.from(new Set(colorMatches)).slice(0, 10).join(', ')}` : '',
    ].filter(Boolean).join('\n\n')

    return content.slice(0, 8000)
  } catch (error) {
    console.error('Cheerio scrape error:', error)
    return null
  }
}

async function extractBrandProfile(content: string): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        { role: 'system', content: BRAND_EXTRACTION_PROMPT },
        { role: 'user', content: `Website content:\n\n${content}` },
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

  // Parse JSON from response (handle possible markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response')
  }

  return JSON.parse(jsonMatch[0])
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url, org_id } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Try Firecrawl first, fallback to Cheerio
    let scrapedContent = await scrapeWithFirecrawl(url)
    let scrapeMethod = 'firecrawl'

    if (!scrapedContent) {
      scrapedContent = await scrapeWithCheerio(url)
      scrapeMethod = 'cheerio'
    }

    if (!scrapedContent) {
      return NextResponse.json(
        { error: 'Failed to scrape website. Please check the URL and try again.' },
        { status: 422 }
      )
    }

    // Extract brand profile via AI
    const brandProfile = await extractBrandProfile(scrapedContent)

    const result = {
      source_url: url,
      scrape_method: scrapeMethod,
      scraped_data: { raw_length: scrapedContent.length, method: scrapeMethod },
      colors: brandProfile.colors || [],
      fonts: brandProfile.fonts || [],
      logo_url: brandProfile.logo_url || null,
      tagline: brandProfile.tagline || null,
      description: brandProfile.description || null,
      tone: brandProfile.tone || null,
      voice_description: brandProfile.voice_description || null,
      tone_keywords: brandProfile.tone_keywords || [],
      target_audience: brandProfile.target_audience || null,
      key_messages: brandProfile.key_messages || [],
      do_list: brandProfile.do_list || [],
      dont_list: brandProfile.dont_list || [],
      industry: brandProfile.industry || null,
    }

    // If org_id provided, save to database
    if (org_id) {
      const { data: saved, error: saveError } = await supabase
        .from('brand_profiles')
        .upsert(
          {
            org_id,
            source_url: url,
            scraped_data: result.scraped_data,
            colors: result.colors,
            fonts: result.fonts,
            logo_url: result.logo_url,
            tagline: result.tagline,
            description: result.description,
            tone: result.tone,
            voice_description: result.voice_description,
            tone_keywords: result.tone_keywords,
            target_audience: result.target_audience,
            key_messages: result.key_messages,
            do_list: result.do_list,
            dont_list: result.dont_list,
            last_scraped_at: new Date().toISOString(),
          },
          { onConflict: 'org_id' }
        )
        .select()
        .single()

      if (saveError) {
        console.error('Save error:', saveError)
        // Return the profile even if save fails
        return NextResponse.json({ ...result, saved: false, save_error: saveError.message })
      }

      return NextResponse.json({ ...result, saved: true, id: saved?.id })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Brand scrape error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
