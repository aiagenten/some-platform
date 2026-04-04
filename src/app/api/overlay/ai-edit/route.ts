// ── POST /api/overlay/ai-edit — AI-powered overlay element editing ───────────
// Accepts current elements + natural language prompt, returns modified elements

import { NextRequest, NextResponse } from 'next/server'
import type { OverlayElement } from '@/lib/custom-overlay-types'

export const runtime = 'edge'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

type AiEditRequest = {
  prompt: string
  elements: OverlayElement[]
  canvasSize: { w: number; h: number }
  brandColors?: string[]
}

const SYSTEM_PROMPT = `Du er en overlay-design-assistent for en SoMe-plattform (sosiale medier).
Du mottar en liste med overlay-elementer (JSON) og en instruksjon på norsk fra brukeren.
Din oppgave er å returnere den OPPDATERTE elements-arrayen som gyldig JSON.

Elementstruktur (OverlayElement):
- id: string (behold eksisterende ID-er, generer nye UUID-er for nye elementer)
- type: "text" | "logo" | "shape" | "color-block" | "image"
- left: number (x-posisjon, 0-1080)
- top: number (y-posisjon, 0-1080)
- width: number
- height: number
- angle: number (rotasjon i grader)
- scaleX: number (skala, default 1)
- scaleY: number (skala, default 1)
- opacity: number (0-1)
- text?: string (kun for type "text")
- fontSize?: number (typisk 24-120)
- fontFamily?: string (f.eks. "Inter", "Arial", "Georgia", "Playfair Display")
- fontWeight?: string ("normal", "bold", "300", "500", "700", "900")
- fill?: string (farge som hex eller rgba)
- textAlign?: string ("left", "center", "right")
- shapeType?: "rect" | "circle" | "triangle" (kun for type "shape")
- stroke?: string (kantlinjefarge)
- strokeWidth?: number
- rx?: number (hjørneradius for rektangler)
- ry?: number
- useBrandLogo?: boolean (kun for type "logo")

Canvas er 1080x1080 piksler.

REGLER:
1. Returner KUN en JSON-array med elementer — ingen forklaring, ingen markdown.
2. Behold alle eksisterende elementer som brukeren ikke ber om å endre.
3. Behold eksisterende id-verdier. Bruk format "ai-<random>" for nye elementer.
4. Sørg for at alle verdier er gyldige (posisjon innenfor canvas, etc.).
5. Hvis brukeren ber om å "gjøre noe mer minimalistisk", reduser størrelser, bruk enklere farger, øk whitespace.
6. Hvis brukeren ber om å "gjøre noe mer prominent", øk størrelse, bruk sterkere farger, bold vekt.
7. Forstå norske fargenavn: rød=#ff0000, blå=#0066ff, grønn=#00aa44, gul=#ffcc00, hvit=#ffffff, svart=#000000, lilla=#9933ff, oransje=#ff6633, rosa=#ff69b4.
8. "Øvre høyre hjørne" = left:880, top:40. "Øvre venstre" = left:40, top:40. "Nedre høyre" = left:880, top:940. "Nedre venstre" = left:40, top:940. "Sentrert" = left:340, top:440.
9. Moderne fonter: "Inter", "Poppins", "Montserrat", "DM Sans". Elegante: "Playfair Display", "Cormorant Garamond", "Lora".`

export async function POST(request: NextRequest) {
  let body: AiEditRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON' }, { status: 400 })
  }

  const { prompt, elements, canvasSize, brandColors } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt er påkrevd' }, { status: 400 })
  }

  // Determine which API to use
  const useAnthropic = !!ANTHROPIC_API_KEY
  const useOpenRouter = !!OPENROUTER_API_KEY
  if (!useAnthropic && !useOpenRouter) {
    return NextResponse.json(
      { error: 'Ingen AI API-nøkkel konfigurert. Sett ANTHROPIC_API_KEY eller OPENROUTER_API_KEY.' },
      { status: 500 }
    )
  }

  const userMessage = `Nåværende elementer:
${JSON.stringify(elements, null, 2)}

Canvas: ${canvasSize.w}x${canvasSize.h}
${brandColors?.length ? `Merkevarefarger: ${brandColors.join(', ')}` : ''}

Instruksjon: ${prompt}`

  let responseText: string

  try {
    if (useAnthropic) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 4096,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('[ai-edit] Anthropic error:', res.status, errText)
        return NextResponse.json({ error: `AI-feil (${res.status})` }, { status: 502 })
      }

      const data = await res.json()
      responseText = data.content?.[0]?.text || ''
    } else {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://some.aiagenten.no',
          'X-Title': 'SoMe Overlay Editor',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('[ai-edit] OpenRouter error:', res.status, errText)
        return NextResponse.json({ error: `AI-feil (${res.status})` }, { status: 502 })
      }

      const data = await res.json()
      responseText = data.choices?.[0]?.message?.content || ''
    }
  } catch (err) {
    console.error('[ai-edit] fetch error:', err)
    return NextResponse.json({ error: 'Kunne ikke kontakte AI-tjenesten' }, { status: 502 })
  }

  // Parse the response — extract JSON array
  try {
    // Strip markdown code fences if present
    let cleaned = responseText.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(cleaned)

    // Validate: must be an array
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'AI returnerte ugyldig format (ikke en array)' }, { status: 502 })
    }

    // Basic validation of each element
    const validated: OverlayElement[] = parsed.map((el: OverlayElement) => ({
      id: el.id || `ai-${crypto.randomUUID().slice(0, 8)}`,
      type: el.type || 'text',
      left: typeof el.left === 'number' ? el.left : 0,
      top: typeof el.top === 'number' ? el.top : 0,
      width: typeof el.width === 'number' ? el.width : 200,
      height: typeof el.height === 'number' ? el.height : 100,
      angle: typeof el.angle === 'number' ? el.angle : 0,
      scaleX: typeof el.scaleX === 'number' ? el.scaleX : 1,
      scaleY: typeof el.scaleY === 'number' ? el.scaleY : 1,
      opacity: typeof el.opacity === 'number' ? Math.min(1, Math.max(0, el.opacity)) : 1,
      // Pass through optional fields
      ...(el.text !== undefined && { text: el.text }),
      ...(el.fontSize !== undefined && { fontSize: el.fontSize }),
      ...(el.fontFamily !== undefined && { fontFamily: el.fontFamily }),
      ...(el.fontWeight !== undefined && { fontWeight: el.fontWeight }),
      ...(el.fill !== undefined && { fill: el.fill }),
      ...(el.textAlign !== undefined && { textAlign: el.textAlign }),
      ...(el.shapeType !== undefined && { shapeType: el.shapeType }),
      ...(el.stroke !== undefined && { stroke: el.stroke }),
      ...(el.strokeWidth !== undefined && { strokeWidth: el.strokeWidth }),
      ...(el.rx !== undefined && { rx: el.rx }),
      ...(el.ry !== undefined && { ry: el.ry }),
      ...(el.brandToken !== undefined && { brandToken: el.brandToken }),
      ...(el.useBrandLogo !== undefined && { useBrandLogo: el.useBrandLogo }),
      ...(el.imageUrl !== undefined && { imageUrl: el.imageUrl }),
      ...(el.backgroundColor !== undefined && { backgroundColor: el.backgroundColor }),
      ...(el.gradient !== undefined && { gradient: el.gradient }),
    }))

    return NextResponse.json({ elements: validated })
  } catch (parseErr) {
    console.error('[ai-edit] JSON parse error:', parseErr, 'Response:', responseText.slice(0, 500))
    return NextResponse.json({ error: 'Kunne ikke tolke AI-svaret som JSON' }, { status: 502 })
  }
}
