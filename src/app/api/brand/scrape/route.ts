import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as cheerio from 'cheerio'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

const BRAND_EXTRACTION_PROMPT = `Du er en merkevareanalytiker. Analyser følgende nettsideinnhold og trekk ut en strukturert merkevareprofil.

VIKTIG: Skriv ALT på norsk (bokmål). Alle beskrivelser, dos/donts, nøkkelmeldinger — alt skal være på norsk.

VIKTIG OM FARGER OG FONTER:
- Bruk CSS-variabelfarger og font-family-navn som er oppgitt i dataene. Dette er de FAKTISKE merkevare-fargene/-fontene, ikke gjett.
- Hvis fontnavn er oppgitt i dataene, bruk de eksakte navnene. Ikke gjett.
- Utvid korte hex-koder: #f90 → #ff9900 før du vurderer om det er en merkevarefarge.
- Ignorer standard rammeverk-farger og nøytrale farger som #fff, #000, #333, #666, #999, #ccc, #eee, #f5f5f5.

Returner et JSON-objekt med disse feltene:
- colors: array med 3-5 HEX-fargekoder som representerer merkevarens faktiske BRAND-farger (e.g. ["#7c3aed", "#1a1a2e", "#f5f5f5"]).
  REGLER FOR FARGEVALG:
  * Prioriter CSS-variabler (--primary, --brand, --accent, --color-primary osv.)
  * Prioriter farger fra logo og fremtredende UI-elementer (knapper, overskrifter, bakgrunner)
  * IGNORER generiske utility-farger: ren hvit (#ffffff, #fff), ren sort (#000000, #000), og veldig vanlige nøytrale grånyanser
  * IGNORER Tailwind standard-farger som #2563eb (blue-600), #3b82f6 (blue-500) hvis de ikke er tydelig merkevarefarger
  * Velg de mest DISTINKTE og KARAKTERISTISKE fargene for merkevaren
  * Maks 5 farger — fokuser på kvalitet, ikke kvantitet
  * Alle fargekoder MÅ være fulle 6-tegns hex (#ff9900, IKKE #f90)
- fonts: array med fontnavn brukt (e.g. ["Inter", "Georgia"]). Bruk fontnavn fra CSS font-family og Google Fonts som er oppgitt i dataene.
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

// Common framework/utility colors to filter out
const FRAMEWORK_COLORS = new Set([
  '#fff', '#ffffff', '#000', '#000000',
  '#333', '#333333', '#666', '#666666', '#999', '#999999',
  '#ccc', '#cccccc', '#eee', '#eeeeee',
  '#f5f5f5', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827',
])

function expandHex(hex: string): string {
  const h = hex.toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  return h
}

function isFrameworkColor(hex: string): boolean {
  const expanded = expandHex(hex.toLowerCase())
  return FRAMEWORK_COLORS.has(expanded) || FRAMEWORK_COLORS.has(hex.toLowerCase())
}

function extractFontsFromCSS(cssText: string): string[] {
  const fonts = new Set<string>()
  // Match font-family declarations
  const fontFamilyMatches = cssText.match(/font-family\s*:\s*([^;}]+)/gi) || []
  for (const match of fontFamilyMatches) {
    const value = match.replace(/font-family\s*:\s*/i, '').trim()
    // Split by comma and clean each font name
    for (const font of value.split(',')) {
      const cleaned = font.trim().replace(/^["']|["']$/g, '').trim()
      // Skip generic families and system fonts
      if (cleaned && !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|-apple-system|BlinkMacSystemFont|Segoe UI|inherit|initial|unset)$/i.test(cleaned)) {
        fonts.add(cleaned)
      }
    }
  }
  return Array.from(fonts)
}

function extractGoogleFonts($: cheerio.CheerioAPI): string[] {
  const fonts = new Set<string>()
  // Google Fonts <link> tags
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    // Handle both /css?family= and /css2?family= formats
    const familyMatches = href.match(/family=([^&]+)/g) || []
    for (const fm of familyMatches) {
      const families = fm.replace('family=', '').split('|')
      for (const f of families) {
        const name = decodeURIComponent(f.split(':')[0].split('@')[0]).replace(/\+/g, ' ').trim()
        if (name) fonts.add(name)
      }
    }
  })
  return Array.from(fonts)
}

function extractFontsFromImports(cssText: string): string[] {
  const fonts = new Set<string>()
  const importMatches = cssText.match(/@import\s+url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi) || []
  for (const imp of importMatches) {
    const urlMatch = imp.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i)
    if (urlMatch && urlMatch[1].includes('fonts.googleapis.com')) {
      const familyMatches = urlMatch[1].match(/family=([^&]+)/g) || []
      for (const fm of familyMatches) {
        const families = fm.replace('family=', '').split('|')
        for (const f of families) {
          const name = decodeURIComponent(f.split(':')[0].split('@')[0]).replace(/\+/g, ' ').trim()
          if (name) fonts.add(name)
        }
      }
    }
  }
  return Array.from(fonts)
}

function extractBrandColors(cssText: string): { priority: string[]; contextual: string[]; all: string[] } {
  // CSS custom properties (highest priority)
  const cssVarMatches = cssText.match(/--[\w-]*(?:color|primary|secondary|accent|brand|main)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8})/gi) || []
  const cssVarColors = cssVarMatches.map(m => m.match(/#[0-9a-fA-F]{3,8}/)?.[0]).filter(Boolean) as string[]

  // Colors from brand-relevant CSS selectors (buttons, headings, links, .btn, .primary)
  const contextualColors: string[] = []
  const brandContextRegex = /(?:^|\}|\{|;)\s*(?:[^{}]*(?:button|\.btn|\.primary|\.accent|\.brand|h[1-6]|\.hero|\.cta|nav|header|a(?:\s|:|\.|,|\{))[^{}]*\{[^}]*(?:(?:background-)?color|border-color)\s*:\s*(#[0-9a-fA-F]{3,8}))/gi
  let match
  while ((match = brandContextRegex.exec(cssText)) !== null) {
    if (match[1]) contextualColors.push(match[1])
  }

  // Also extract color/background-color/border-color property values directly
  const colorPropMatches = cssText.match(/(?:^|[{;])\s*(?:color|background-color|border-color)\s*:\s*(#[0-9a-fA-F]{3,8})/gi) || []
  const propColors = colorPropMatches.map(m => m.match(/#[0-9a-fA-F]{3,8}/)?.[0]).filter(Boolean) as string[]

  // All hex colors as fallback
  const allColorMatches = cssText.match(/#[0-9a-fA-F]{3,8}\b/g) || []

  // Filter and expand
  const filterAndExpand = (colors: string[]) =>
    Array.from(new Set(colors.map(expandHex).filter(c => !isFrameworkColor(c))))

  return {
    priority: filterAndExpand(cssVarColors),
    contextual: filterAndExpand([...contextualColors, ...propColors]),
    all: filterAndExpand(allColorMatches),
  }
}

function extractInlineStyleColors($: cheerio.CheerioAPI, selectors: string): string[] {
  const colors: string[] = []
  $(selectors).each((_, el) => {
    const style = $(el).attr('style') || ''
    const matches = style.match(/#[0-9a-fA-F]{3,8}\b/g) || []
    colors.push(...matches)
  })
  return Array.from(new Set(colors.map(expandHex).filter(c => !isFrameworkColor(c))))
}

function buildColorSummary(priority: string[], contextual: string[], all: string[]): string {
  const parts: string[] = []
  if (priority.length) parts.push(`CSS variable brand colors (highest priority): ${priority.join(', ')}`)
  if (contextual.length) parts.push(`Colors from buttons/headings/links/brand classes: ${contextual.slice(0, 15).join(', ')}`)
  if (all.length) parts.push(`All other colors found: ${all.slice(0, 20).join(', ')}`)
  return parts.join('\n') || 'No colors found'
}

async function scrapeWithFirecrawl(url: string): Promise<{ content: string; html: string | null } | null> {
  if (!FIRECRAWL_API_KEY) return null

  try {
    const FirecrawlApp = (await import('@mendable/firecrawl-js')).default
    const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY })
    const result = await app.scrape(url, { formats: ['markdown', 'rawHtml'] }) as Record<string, unknown>

    if (result && result.markdown) {
      return {
        content: (result.markdown as string).slice(0, 8000),
        html: (result.rawHtml as string | null) || null,
      }
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

    // Extract fonts and colors BEFORE removing style elements
    const embeddedStyleText = $('style').text()
    const googleFonts = extractGoogleFonts($)
    const importFonts = extractFontsFromImports(embeddedStyleText)

    // Extract inline style colors from prominent elements
    const prominentInlineColors = extractInlineStyleColors($, 'header, nav, [class*="hero"], [class*="btn"], [class*="primary"], button, h1, h2, h3, h4, h5, h6, a')

    // Collect all CSS text for color/font extraction
    const inlineStyleText = $('[style]').map((_, el) => $(el).attr('style')).get().join(' ')
    let allStyleText = embeddedStyleText + ' ' + inlineStyleText

    // Fetch external stylesheets for more color and font data
    const cssLinks = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get().slice(0, 3)
    for (const href of cssLinks) {
      try {
        const cssUrl = href.startsWith('http') ? href : new URL(href, url).toString()
        const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })
        if (cssRes.ok) {
          const cssText = await cssRes.text()
          allStyleText += ' ' + cssText
        }
      } catch { /* ignore failed CSS fetches */ }
    }

    // Extract fonts from all CSS
    const cssFonts = extractFontsFromCSS(allStyleText)
    const allFonts = Array.from(new Set([...googleFonts, ...importFonts, ...cssFonts]))

    // Extract colors using improved logic
    const { priority, contextual, all: allColors } = extractBrandColors(allStyleText)
    // Add prominent inline colors to contextual
    const mergedContextual = Array.from(new Set([...contextual, ...prominentInlineColors]))
    const colorSummary = buildColorSummary(priority, mergedContextual, allColors)

    // Remove scripts, styles, nav, footer for content extraction
    $('script, style, nav, footer, header, iframe, noscript').remove()

    const title = $('title').text().trim()
    const metaDesc = $('meta[name="description"]').attr('content') || ''
    const ogDesc = $('meta[property="og:description"]').attr('content') || ''
    const h1s = $('h1').map((_, el) => $(el).text().trim()).get().join('. ')
    const h2s = $('h2').map((_, el) => $(el).text().trim()).get().slice(0, 5).join('. ')
    const paragraphs = $('p').map((_, el) => $(el).text().trim()).get().filter(p => p.length > 20).slice(0, 10).join('\n')

    // Try to find logo
    const logoUrl = $('img[alt*="logo" i], img[class*="logo" i], img[id*="logo" i]').first().attr('src') || null

    const content = [
      `Title: ${title}`,
      `Description: ${metaDesc || ogDesc}`,
      `Headlines: ${h1s}`,
      `Subheadlines: ${h2s}`,
      `Content:\n${paragraphs}`,
      logoUrl ? `Logo: ${logoUrl}` : '',
      allFonts.length ? `Fonts found: ${allFonts.join(', ')}` : '',
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

    // Use admin client for DB writes to bypass RLS
    const adminSupabase = createAdminClient()

    const body = await request.json()
    const { url, org_id } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Try Firecrawl first, fallback to Cheerio
    let scrapedContent: string | null = null
    let scrapedHtml: string | null = null
    let scrapeMethod = 'firecrawl'

    const firecrawlResult = await scrapeWithFirecrawl(url)
    if (firecrawlResult) {
      scrapedContent = firecrawlResult.content
      scrapedHtml = firecrawlResult.html
    }

    if (!scrapedContent) {
      scrapedContent = await scrapeWithCheerio(url)
      scrapeMethod = 'cheerio'
    }

    if (!scrapedContent) {
      scrapedContent = `Website URL: ${url}\nNote: Could not scrape the website content directly. Please analyze based on the URL and any knowledge you have about this website/brand.`
      scrapeMethod = 'url-only'
    }

    // If Firecrawl returned HTML, extract colors and fonts from it and append to content
    if (scrapedHtml) {
      try {
        const $ = cheerio.load(scrapedHtml)

        // Extract fonts
        const googleFonts = extractGoogleFonts($)
        const embeddedStyleText = $('style').text()
        const importFonts = extractFontsFromImports(embeddedStyleText)

        // Collect all CSS text
        const inlineStyleText = $('[style]').map((_, el) => $(el).attr('style')).get().join(' ')
        let allStyleText = embeddedStyleText + ' ' + inlineStyleText

        // Fetch external stylesheets
        const cssLinks = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get().slice(0, 3)
        for (const href of cssLinks) {
          try {
            const cssUrl = href.startsWith('http') ? href : new URL(href, url).toString()
            const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })
            if (cssRes.ok) {
              allStyleText += ' ' + await cssRes.text()
            }
          } catch { /* ignore failed CSS fetches */ }
        }

        // Extract fonts from all CSS
        const cssFonts = extractFontsFromCSS(allStyleText)
        const allFonts = Array.from(new Set([...googleFonts, ...importFonts, ...cssFonts]))

        // Extract colors with improved logic
        const { priority, contextual, all: allColors } = extractBrandColors(allStyleText)
        const prominentInlineColors = extractInlineStyleColors($, 'header, nav, [class*="hero"], [class*="btn"], [class*="primary"], button, h1, h2, h3, h4, h5, h6, a')
        const mergedContextual = Array.from(new Set([...contextual, ...prominentInlineColors]))

        const colorSummary = buildColorSummary(priority, mergedContextual, allColors)
        const fontSummary = allFonts.length ? `Fonts found: ${allFonts.join(', ')}` : ''

        scrapedContent += `\n\n${[fontSummary, colorSummary].filter(Boolean).join('\n')}`
      } catch (e) {
        console.warn('Color/font extraction from Firecrawl HTML failed:', e)
      }
    }

    // Extract brand profile via AI
    const brandProfile = await extractBrandProfile(scrapedContent)

    // Download logo and store in Supabase storage to avoid CORS issues
    let storedLogoUrl: string | null = null
    if (brandProfile.logo_url && org_id) {
      try {
        // Resolve relative logo URLs
        let logoSrc = brandProfile.logo_url as string
        if (logoSrc.startsWith('/')) {
          logoSrc = new URL(logoSrc, url).toString()
        } else if (!logoSrc.startsWith('http')) {
          logoSrc = new URL(logoSrc, url).toString()
        }

        const logoRes = await fetch(logoSrc, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SoMeBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })

        if (logoRes.ok) {
          const contentType = logoRes.headers.get('content-type') || 'image/png'
          const logoBuffer = Buffer.from(await logoRes.arrayBuffer())
          const ext = contentType.includes('svg') ? 'svg' : contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
          const logoPath = `${org_id}/logo.${ext}`

          const { error: uploadError } = await adminSupabase.storage
            .from('brand-assets')
            .upload(logoPath, logoBuffer, {
              contentType,
              upsert: true,
            })

          if (!uploadError) {
            const { data: publicUrl } = adminSupabase.storage
              .from('brand-assets')
              .getPublicUrl(logoPath)
            storedLogoUrl = publicUrl.publicUrl
          } else {
            console.warn('Logo upload error:', uploadError.message)
          }
        }
      } catch (e) {
        console.warn('Logo download failed:', e)
      }
    }

    const result = {
      source_url: url,
      scrape_method: scrapeMethod,
      scraped_data: { raw_length: scrapedContent.length, method: scrapeMethod },
      colors: brandProfile.colors || [],
      fonts: brandProfile.fonts || [],
      logo_url: storedLogoUrl || brandProfile.logo_url || null,
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

    // If org_id provided, save to database (use admin client to bypass RLS)
    if (org_id) {
      const { data: saved, error: saveError } = await adminSupabase
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
