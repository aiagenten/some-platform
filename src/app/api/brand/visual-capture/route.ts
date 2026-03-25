import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

const VISUAL_ANALYSIS_PROMPT = `Du er en UX/design-analytiker. Analyser dette skjermbildet av en nettside og trekk ut designelementer.

Returner JSON med disse feltene:
- border_radius: string (f.eks. "rounded-full", "rounded-lg", "rounded-none" — Tailwind-verdier)
- button_style: objekt med { border_radius: string, has_shadow: boolean, has_gradient: boolean, is_outlined: boolean, typical_padding: string }
- card_style: objekt med { border_radius: string, has_shadow: boolean, has_border: boolean, background: string }
- spacing_feel: "tight" | "normal" | "airy" (generelt spacing-inntrykk)
- visual_weight: "light" | "medium" | "heavy" (hvor mye visuell tyngde/kontrast)
- layout_style: "minimal" | "modern" | "classic" | "bold" | "playful"
- hero_pattern: string (beskrivelse av hero-seksjonen, f.eks. "full-width image with overlay text")
- signature_elements: array med 3-5 karakteristiske designelementer (f.eks. "rounded pill buttons", "gradient backgrounds", "large hero images")
- color_usage: objekt med { primary_usage: string, accent_usage: string, background_style: string }
- typography_feel: "clean-sans" | "elegant-serif" | "mixed" | "bold-geometric" | "humanist"
- overall_vibe: 1-2 setninger som beskriver den visuelle identiteten

Svar KUN med gyldig JSON.`

export async function POST(request: NextRequest) {
  try {
    const { url, org_id } = await request.json()

    if (!url || !org_id) {
      return NextResponse.json({ error: 'url og org_id er påkrevd' }, { status: 400 })
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY ikke konfigurert' }, { status: 500 })
    }

    // Step 1: Take screenshot via Microlink API
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&screenshot.fullPage=false&meta=false&waitUntil=networkidle2`
    
    const microlinkRes = await fetch(microlinkUrl, { 
      signal: AbortSignal.timeout(30000) 
    })
    const microlinkData = await microlinkRes.json()

    if (microlinkData.status !== 'success' || !microlinkData.data?.screenshot?.url) {
      return NextResponse.json({ error: 'Kunne ikke ta screenshot av nettsiden' }, { status: 422 })
    }

    const screenshotUrl = microlinkData.data.screenshot.url

    // Step 2: Download screenshot as base64
    const imgRes = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(15000)
    })
    const imgBuffer = await imgRes.arrayBuffer()
    const base64Image = Buffer.from(imgBuffer).toString('base64')
    const dataUrl = `data:image/png;base64,${base64Image}`

    // Step 3: Send to OpenRouter vision model
    const visionRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://some-platform.aiagenten.no',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISUAL_ANALYSIS_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!visionRes.ok) {
      const errText = await visionRes.text()
      console.error('OpenRouter vision error:', errText)
      return NextResponse.json({ error: 'Visuell analyse feilet' }, { status: 502 })
    }

    const visionData = await visionRes.json()
    const rawContent = visionData.choices?.[0]?.message?.content || ''

    // Parse JSON from response (strip markdown fences if present)
    let visualStyle
    try {
      const jsonStr = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      visualStyle = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse visual style JSON:', rawContent)
      return NextResponse.json({ error: 'Kunne ikke tolke visuell analyse' }, { status: 422 })
    }

    // Step 4 & 5: Save to brand_profiles
    const supabase = createAdminClient()
    
    await supabase
      .from('brand_profiles')
      .update({
        visual_style: visualStyle,
        website_screenshot_url: screenshotUrl,
      })
      .eq('org_id', org_id)

    // Step 6: Return result
    return NextResponse.json({
      visual_style: visualStyle,
      screenshot_url: screenshotUrl,
    })
  } catch (error) {
    console.error('Visual capture error:', error)
    return NextResponse.json(
      { error: 'Visuell analyse feilet. Prøv igjen.' },
      { status: 500 }
    )
  }
}
