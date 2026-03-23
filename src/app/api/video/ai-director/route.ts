import { NextRequest, NextResponse } from 'next/server'
import type { EditorState, DirectorOperation, TrackItem } from '@/lib/editor-state'
import { uid } from '@/lib/editor-state'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

type AgentType = 'director' | 'picasso' | 'dicaprio'

type RequestBody = {
  prompt: string
  editorState: EditorState
  agentType?: AgentType
  selectedTimeRange?: { startFrame: number; endFrame: number } | null
  isQuickAction?: boolean
  quickActionId?: string
}

// ── Agent system prompts ───────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  director: `You are the Director AI for a professional video editor. Your job is to analyze the editor state and generate precise editing operations.

LANGUAGE RULE: Always respond in the same language as the user. If they write in Norwegian, respond in Norwegian. If they write in English, respond in English.

You MUST respond with valid JSON in exactly this format:
{
  "message": "Human-readable explanation of what you did",
  "operations": [/* array of DirectorOperation objects */]
}

Available operation types:
- add-track-item: { "type": "add-track-item", "track": "t1|v2|a2|v1|a1", "item": { TrackItem object } }
- remove-track-item: { "type": "remove-track-item", "trackId": "t1", "itemId": "item-id" }
- update-item: { "type": "update-item", "trackId": "t1", "itemId": "item-id", "changes": { ...partial TrackItem } }
- add-captions: { "type": "add-captions", "trackId": "t1", "items": [ ...TrackItem array ] }
- clear-track: { "type": "clear-track", "trackId": "t1" }
- set-total-duration: { "type": "set-total-duration", "durationInFrames": 900 }

TrackItem fields:
- id: string (generate a random short id)
- type: "video"|"animation"|"caption"|"audio"|"image"|"overlay"
- from: number (frame start, integer)
- durationInFrames: number (integer, minimum 30)
- src: string (optional URL)
- text: string (optional, for captions)
- captionStyle: "sentences"|"karaoke"|"big-word"
- captionPosition: "bottom"|"center"|"top"
- captionColor: string (hex color, e.g. "#ffffff")
- captionBgColor: string (e.g. "rgba(0,0,0,0.6)")
- overlayType: "logo-watermark"|"lower-third"|"full-branded"
- volume: number (0-1 for audio)
- label: string (display name on timeline)

The editor uses 30 fps. Total duration is in frames.
Track IDs: v1=main video, v2=overlays, t1=captions, a1=original audio, a2=background music

For "add captions" quick action: Create multiple caption items on t1 track. Since we don't have real transcript, create a placeholder caption covering the whole duration with text "Caption text here" and captionStyle "sentences".

For "add logo" quick action: Add an overlay item to v2 track covering the full duration with overlayType "logo-watermark".

For "add music": Add an audio item to a2 track covering the full duration with label "Background Music" and volume 0.3. Note: actual music URL needs to be generated separately.

For "remove dead air": Explain that this requires Whisper transcription and ffmpeg processing. Return a message explaining this and empty operations array.

Always generate valid JSON. Never add markdown code blocks around the JSON.`,

  picasso: `You are Picasso AI, a visual design agent for a professional video editor. You specialize in visual overlays, animations, brand elements, and image generation.

LANGUAGE RULE: Always respond in the same language as the user. If they write in Norwegian, respond in Norwegian. If they write in English, respond in English.

You MUST respond with valid JSON:
{
  "message": "Human-readable explanation",
  "operations": [/* DirectorOperation array */]
}

Focus on V2 overlay track items. Use overlayType: "logo-watermark", "lower-third", or "full-branded".
For visual effects and branding requests, add overlay items to the v2 track.

Always generate valid JSON. Never add markdown code blocks.`,

  dicaprio: `You are DiCaprio AI, a video generation and motion specialist. You handle video generation, transitions, and motion effects.

LANGUAGE RULE: Always respond in the same language as the user. If they write in Norwegian, respond in Norwegian. If they write in English, respond in English.

You MUST respond with valid JSON:
{
  "message": "Human-readable explanation",
  "operations": [/* DirectorOperation array */]
}

For video generation requests, explain what would be generated and add placeholder items with appropriate labels.
Always generate valid JSON. Never add markdown code blocks.`,
}

// ── Handle quick actions with specialized logic ────────────────────────────────

async function handleQuickAction(
  quickActionId: string,
  editorState: EditorState,
): Promise<{ message: string; operations: DirectorOperation[] }> {
  const total = editorState.totalDurationInFrames

  switch (quickActionId) {
    case 'add-logo': {
      const ops: DirectorOperation[] = [
        {
          type: 'add-track-item',
          track: 'v2',
          item: {
            id: uid(),
            type: 'overlay',
            from: 0,
            durationInFrames: total,
            overlayType: 'logo-watermark',
            label: 'Logo Watermark',
          },
        },
      ]
      return { message: 'Added logo watermark overlay to V2 track.', operations: ops }
    }

    case 'add-captions': {
      // Create a placeholder caption for the full video
      const ops: DirectorOperation[] = [
        {
          type: 'clear-track',
          trackId: 't1',
        },
        {
          type: 'add-track-item',
          track: 't1',
          item: {
            id: uid(),
            type: 'caption',
            from: 0,
            durationInFrames: total,
            text: 'Captions will appear here after transcription',
            captionStyle: 'sentences',
            captionPosition: 'bottom',
            captionColor: '#ffffff',
            captionBgColor: 'rgba(0,0,0,0.6)',
            label: 'Captions',
          },
        },
      ]
      return {
        message:
          'Added caption placeholder to T1 track. To get real captions, upload a video and the system will transcribe it automatically.',
        operations: ops,
      }
    }

    case 'add-music': {
      const ops: DirectorOperation[] = [
        {
          type: 'add-track-item',
          track: 'a2',
          item: {
            id: uid(),
            type: 'audio',
            from: 0,
            durationInFrames: total,
            volume: 0.3,
            label: 'Background Music (generating...)',
          },
        },
      ]
      return {
        message: 'Added music placeholder to A2 track. Use the music generation API to create actual background music.',
        operations: ops,
      }
    }

    case 'remove-dead-air': {
      return {
        message:
          'Fjerning av pauser krever Whisper-transkripsjon av videoen. Last opp en video til V1 først, så kan jeg prosessere den gjennom transkripsjons-API-et for å finne stillepartier.',
        operations: [],
      }
    }

    case 'optimize': {
      // Pass to LLM for analysis — return early to let the main LLM handler take over
      return {
        message:
          'Analyser videoen din og gi meg beskjed om hva du vil optimalisere — pacing, klipperekkefølge, timing eller noe annet.',
        operations: [],
      }
    }

    default:
      return { message: 'Ukjent hurtighandling', operations: [] }
  }
}

// ── Main route handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { prompt, editorState, agentType = 'director', isQuickAction, quickActionId } = body

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    // Handle specific quick actions without LLM (faster, cheaper)
    if (isQuickAction && quickActionId && ['add-logo', 'add-captions', 'add-music', 'remove-dead-air', 'optimize'].includes(quickActionId)) {
      const result = await handleQuickAction(quickActionId, editorState)
      return NextResponse.json(result)
    }

    // Determine which LLM API to use
    const apiKey = OPENROUTER_API_KEY || ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No AI API key configured (OPENROUTER_API_KEY or ANTHROPIC_API_KEY)' },
        { status: 500 },
      )
    }

    const systemPrompt = SYSTEM_PROMPTS[agentType]

    // Build context summary (avoid sending full state if huge)
    const trackSummary = editorState.tracks.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      itemCount: t.items.length,
      items: t.items.map(i => ({
        id: i.id,
        type: i.type,
        from: i.from,
        duration: i.durationInFrames,
        label: i.label,
        text: i.text,
      })),
    }))

    const userContent = `
Current editor state:
- FPS: ${editorState.fps}
- Total duration: ${editorState.totalDurationInFrames} frames (${(editorState.totalDurationInFrames / editorState.fps).toFixed(1)} seconds)
- Brand: ${editorState.brand.brandName}
- Tracks:
${JSON.stringify(trackSummary, null, 2)}

User request: ${prompt}

Respond with JSON only (no markdown, no code blocks).`

    let response: Response
    let model: string

    if (OPENROUTER_API_KEY) {
      model = 'anthropic/claude-sonnet-4-5'
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://some.aiagenten.no',
          'X-Title': 'SoMe Video Studio',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      })
    } else {
      // Direct Anthropic API
      model = 'claude-sonnet-4-5'
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      })
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI API error:', errText)
      return NextResponse.json({ error: `AI API error: ${response.status}` }, { status: 502 })
    }

    const aiData = await response.json()

    let rawContent: string
    if (OPENROUTER_API_KEY) {
      rawContent = aiData.choices?.[0]?.message?.content || '{}'
    } else {
      rawContent = aiData.content?.[0]?.text || '{}'
    }

    // Parse and validate the response
    let parsed: { message?: string; operations?: DirectorOperation[] }
    try {
      // Strip any accidental markdown code blocks
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Failed to parse AI response:', rawContent, parseErr)
      return NextResponse.json({
        message: rawContent,
        operations: [],
      })
    }

    // Ensure operations have IDs
    const operations = (parsed.operations || []).map((op: DirectorOperation) => {
      if (op.type === 'add-track-item' && op.item && !op.item.id) {
        return { ...op, item: { ...op.item, id: uid() } }
      }
      if (op.type === 'add-captions') {
        return {
          ...op,
          items: (op.items || []).map((item: TrackItem) =>
            item.id ? item : { ...item, id: uid() },
          ),
        }
      }
      return op
    })

    return NextResponse.json({
      message: parsed.message || 'Done.',
      operations,
    })
  } catch (err) {
    console.error('ai-director error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
