import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

/**
 * Extract dominant brand colors from social media post images.
 * Uses a vision model to analyze the images and identify brand-relevant colors.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { image_urls } = await request.json()

    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      return NextResponse.json({ colors: [], message: 'No images provided' })
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ colors: [], message: 'AI not configured' })
    }

    // Take up to 6 images for analysis (balance between accuracy and cost)
    const selectedUrls = image_urls.slice(0, 6)

    // Build vision message with images
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: `Analyser disse sosiale medie-bildene og trekk ut de dominerende MERKEVARE-fargene.

VIKTIGE REGLER:
- Fokuser på farger som ser ut til å være bevisste merkevare-valg (logo, grafiske elementer, konsistente farger på tvers av bilder)
- IGNORER bakgrunnsfarger som hvit, sort, og vanlige gråtoner
- IGNORER naturfarger fra fotografier (himmel, gress, hud) — vi vil ha BRAND-farger
- Returner 3-5 HEX-fargekoder som representerer merkevarens visuelle identitet
- Alle fargekoder MÅ være fulle 6-tegns hex (#ff9900, IKKE #f90)

Svar KUN med gyldig JSON i dette formatet:
{"colors": ["#hex1", "#hex2", "#hex3"], "confidence": "high|medium|low", "notes": "kort beskrivelse av hva du ser"}

Hvis bildene ikke har tydelige merkevarefarger (f.eks. bare vanlige foto uten grafisk design), sett confidence til "low" og returner de mest fremtredende fargene likevel.`
      }
    ]

    for (const url of selectedUrls) {
      content.push({
        type: 'image_url',
        image_url: { url }
      })
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
          { role: 'user', content }
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      console.error('OpenRouter vision API error:', response.status)
      return NextResponse.json({ colors: [], message: 'AI analysis failed' })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ colors: [], message: 'Could not parse AI response' })
    }

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      colors: result.colors || [],
      confidence: result.confidence || 'low',
      notes: result.notes || '',
      images_analyzed: selectedUrls.length,
    })
  } catch (error) {
    console.error('Image color extraction error:', error)
    return NextResponse.json({ colors: [], message: 'Error extracting colors' })
  }
}
