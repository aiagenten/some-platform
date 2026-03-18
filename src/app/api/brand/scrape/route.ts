import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

const BRAND_EXTRACTION_PROMPT = `Du er en merkevareanalytiker. Analyser følgende nettsideinnhold og trekk ut en strukturert merkevareprofil.

VIKTIG: Skriv ALT på norsk (bokmål). Alle beskrivelser, dos/donts, nøkkelmeldinger — alt skal være på norsk.

Returner et JSON-objekt med disse feltene:
- colors: array med 3-5 HEX-fargekoder som representerer merkevarens faktiske BRAND-farger (e.g. ["#7c3aed", "#1a1a2e", "#f5f5f5"]). 
  REGLER FOR FARGEVALG:
  * Prioriter CSS-variabler (--primary, --brand, --accent, --color-primary osv.)
  * Prioriter farger fra logo og fremtredende UI-elementer (knapper, overskrifter, bakgrunner)
  * IGNORER generiske utility-farger: ren hvit (#ffffff, #fff), ren sort (#000000, #000), og veldig vanlige nøytrale grånyanser
  * IGNORER Tailwind standard-farger som #2563eb (blue-600), #3b82f6 (blue-500) hvis de ikke er tydelig merkevarefarger
  * Velg de mest DISTINKTE og KARAKTERISTISKE fargene for merkevaren
  * Maks 5 farger — fokuser på kvalitet, ikke kvantitet
- fonts: array med fontnavn brukt (e.g. ["Inter", "Georgia"])
- logo_url: URL til logoen hvis funnet, eller null
- tone: ett norsk ord for tonen (f.eks. "profesjonell", "leken", "autoritativ", "vennlig")
- voice_description: 1-2 setninger på norsk som beskriver merkevarens stemme
- tone_keywords: array med 3-5 norske nøkkelord som beskriver tonen
- tagline: merkevarens slagord hvis funnet, eller et foreslått ett (på norsk)
- description: 2-3 setninger på norsk som beskriver merkevaren
- target_audience: hvem merkevaren retter seg mot (på norsk)
- do_list: array med 3-5 ting merkevaren BØR gjøre i kommunikasjon (på norsk)
- dont_list: array med 3-5 ting merkevaren bør UNNGÅ i kommunikasjon (på norsk)
- key_messages: array med 3-5 nøkkelmeldinger merkevaren formidler (på norsk)
- industry: bransjen/sektoren (på norsk)

Svar KUN med gyldig JSON, ingen markdown, ingen forklaring.`

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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
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
    const inlineStyleText = $('[style]').map((_, el) => $(el).attr('style')).get().join(' ')
    const embeddedStyleText = $('style').text()
    const allStyleText = embeddedStyleText + ' ' + inlineStyleText

    // Extract CSS custom properties (brand variables like --primary, --brand-color etc.)
    const cssVarMatches = allStyleText.match(/--[\w-]*(?:color|primary|secondary|accent|brand|main)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8})/gi) || []
    const cssVarColors = cssVarMatches.map(m => m.match(/#[0-9a-fA-F]{3,8}/)?.[0]).filter(Boolean) as string[]

    // Extract all hex colors
    const allColorMatches = allStyleText.match(/#[0-9a-fA-F]{3,8}\b/g) || []

    // Fetch external stylesheets for more color data
    const externalCssColors: string[] = []
    const cssLinks = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get().slice(0, 3)
    for (const href of cssLinks) {
      try {
        const cssUrl = href.startsWith('http') ? href : new URL(href, url).toString()
        const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })
        if (cssRes.ok) {
          const cssText = await cssRes.text()
          // Extract CSS variable colors first
          const varMatches = cssText.match(/--[\w-]*(?:color|primary|secondary|accent|brand|main)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8})/gi) || []
          varMatches.forEach(m => {
            const hex = m.match(/#[0-9a-fA-F]{3,8}/)?.[0]
            if (hex) externalCssColors.push(hex)
          })
          // Also grab all hex colors from CSS
          const hexMatches = cssText.match(/#[0-9a-fA-F]{3,8}\b/g) || []
          externalCssColors.push(...hexMatches.slice(0, 30))
        }
      } catch { /* ignore failed CSS fetches */ }
    }

    // Combine: prioritize CSS variable colors, then all collected colors
    const priorityColors = Array.from(new Set(cssVarColors))
    const allColors = Array.from(new Set([...allColorMatches, ...externalCssColors]))
    const colorSummary = priorityColors.length
      ? `CSS variable brand colors (highest priority): ${priorityColors.join(', ')}\nAll colors found: ${allColors.slice(0, 20).join(', ')}`
      : `Colors found in stylesheets: ${allColors.slice(0, 20).join(', ')}`

    const content = [
      `Title: ${title}`,
      `Description: ${metaDesc || ogDesc}`,
      `Headlines: ${h1s}`,
      `Subheadlines: ${h2s}`,
      `Content:\n${paragraphs}`,
      logoUrl ? `Logo: ${logoUrl}` : '',
      colorSummary,
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
      model: 'google/gemini-2.0-flash-001',
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
      // Last resort: just send the URL to AI and let it work with its knowledge
      scrapedContent = `Website URL: ${url}\nNote: Could not scrape the website content directly. Please analyze based on the URL and any knowledge you have about this website/brand.`
      scrapeMethod = 'url-only'
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
