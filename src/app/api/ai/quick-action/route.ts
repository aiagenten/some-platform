// ── POST /api/ai/quick-action — One-shot AI Quick Actions ────────────────────
// Returns structured JSON that the frontend can apply directly to the timeline.
// No streaming — these are fast, structured responses.

import { NextRequest, NextResponse } from 'next/server'
import type {
  QuickActionRequest,
  QuickActionResult,
  QuickActionId,
} from '@/lib/ai-agents'

export const runtime = 'edge'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// ── LLM helper (non-streaming) ────────────────────────────────────────────────
async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = OPENROUTER_API_KEY || OPENAI_API_KEY
  if (!apiKey) throw new Error('No AI API key configured')

  if (OPENROUTER_API_KEY) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://some.aiagenten.no',
        'X-Title': 'SoMe Video Studio Quick Actions',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001', // Fast + cheap for structured tasks
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || '{}'
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || '{}'
  }
}

function parseJSON(raw: string): Record<string, unknown> {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {}
  }
}

// ── Action Handlers ───────────────────────────────────────────────────────────

async function handleRemoveDeadAir(req: QuickActionRequest): Promise<QuickActionResult> {
  const { context } = req
  const fps = context.editorState?.fps ?? 30
  const totalFrames = context.editorState?.totalDurationInFrames ?? 0
  const totalSeconds = totalFrames / fps

  // Without actual audio analysis, we give smart guidance
  // In a real implementation, this would call the /api/video/remove-silence route
  const systemPrompt = `You are a video editing AI. Given a video's timeline info, suggest likely silence/dead-air ranges for removal.
Return ONLY valid JSON: { "summary": string, "suggestions": string[], "silenceRanges": [{ "startFrame": number, "endFrame": number, "durationSeconds": number }] }
The silenceRanges are ESTIMATES based on typical video patterns — label them as such.`

  const userContent = `Video duration: ${totalSeconds.toFixed(1)} seconds at ${fps}fps.
Platform: ${context.platform || 'unknown'}
Project: ${context.projectTitle || 'untitled'}
Timeline tracks: ${JSON.stringify(context.timeline?.tracks?.map(t => ({ id: t.id, items: t.items.length })) ?? [])}

Generate estimated silence ranges and advice for removing dead air.`

  const raw = await callLLM(systemPrompt, userContent)
  const parsed = parseJSON(raw)

  return {
    action: 'remove-dead-air',
    summary: (parsed.summary as string) || 'Dead air removal requires audio analysis. Upload a video to enable automatic silence detection via the transcription pipeline.',
    suggestions: (parsed.suggestions as string[]) || [
      'Upload your video to V1 track first',
      'Use the transcription API to get word-level timestamps',
      'Silence gaps longer than 0.5s between words can then be cut automatically',
    ],
    silenceRanges: (parsed.silenceRanges as QuickActionResult['silenceRanges']) || [],
  }
}

async function handleAutoCaptions(req: QuickActionRequest): Promise<QuickActionResult> {
  const { context } = req
  const fps = context.editorState?.fps ?? 30
  const totalFrames = context.editorState?.totalDurationInFrames ?? 0

  // Check if there's existing video on V1 with a src
  const v1Track = context.editorState?.tracks.find(t => t.id === 'v1')
  const hasVideo = v1Track && v1Track.items.length > 0

  if (!hasVideo) {
    return {
      action: 'auto-captions',
      summary: 'No video found on V1 track. Add a video clip first, then auto-captions can be generated.',
      suggestions: [
        'Upload a video to the V1 (main video) track',
        'Auto-captions will use Whisper to transcribe speech',
        'Captions will be placed on the T1 caption track',
      ],
      captions: [],
    }
  }

  // Generate placeholder captions that fit the video duration
  // In production, this would call /api/video/transcribe then parse the SRT
  const segmentDurationSeconds = 4 // ~4s per caption segment
  const segmentFrames = segmentDurationSeconds * fps
  const numSegments = Math.ceil(totalFrames / segmentFrames)

  const captions: QuickActionResult['captions'] = Array.from({ length: numSegments }, (_, i) => ({
    from: i * segmentFrames,
    durationInFrames: Math.min(segmentFrames, totalFrames - i * segmentFrames),
    text: `[Caption ${i + 1} — transcription pending]`,
  }))

  return {
    action: 'auto-captions',
    summary: `Generated ${numSegments} caption placeholder segments. These will be replaced with real transcribed text once the video is processed through Whisper.`,
    suggestions: [
      'Caption placeholders added to T1 track',
      'Run transcription to get real speech-to-text',
      'Edit individual captions by clicking on them in the timeline',
      'Change caption style (sentences/karaoke/big-word) in the T1 track settings',
    ],
    captions,
  }
}

async function handleSuggestMusic(req: QuickActionRequest): Promise<QuickActionResult> {
  const { context } = req

  const systemPrompt = `You are a music supervisor for social media video content. Given a video project's context, suggest the perfect background music.
Return ONLY valid JSON: {
  "summary": string,
  "musicMood": string,
  "musicGenre": string,
  "suggestions": string[],
  "bpmRange": string,
  "energyLevel": "low" | "medium" | "high",
  "referenceArtists": string[]
}`

  const userContent = `Project: ${context.projectTitle || 'untitled'}
Platform: ${context.platform || 'unknown'}
Brand tone: ${context.brand?.tone || 'professional'}
Target audience: ${context.brand?.targetAudience || 'general'}
Clips: ${JSON.stringify(context.clips?.map(c => ({ label: c.label, type: c.type })) ?? [])}

Suggest the ideal background music style for this video.`

  const raw = await callLLM(systemPrompt, userContent)
  const parsed = parseJSON(raw)

  return {
    action: 'suggest-music',
    summary: (parsed.summary as string) || 'Music suggestion generated based on your project context.',
    musicMood: (parsed.musicMood as string) || 'uplifting',
    musicGenre: (parsed.musicGenre as string) || 'corporate pop',
    suggestions: (parsed.suggestions as string[]) || [
      `Mood: ${parsed.musicMood || 'uplifting'}`,
      `Genre: ${parsed.musicGenre || 'corporate pop'}`,
      `Energy: ${parsed.energyLevel || 'medium'}`,
      `BPM range: ${parsed.bpmRange || '100-120 BPM'}`,
      `Reference artists: ${(parsed.referenceArtists as string[])?.join(', ') || 'Hans Zimmer, Two Steps From Hell'}`,
    ],
  }
}

async function handleOptimizeForPlatform(req: QuickActionRequest): Promise<QuickActionResult> {
  const { context } = req
  const platform = context.platform

  if (!platform) {
    return {
      action: 'optimize-for-platform',
      summary: 'Specify a target platform to get optimization recommendations.',
      suggestions: ['Set the platform in your project settings first'],
    }
  }

  // Platform specs — authoritative, no LLM needed for this
  const PLATFORM_SPECS: Record<string, QuickActionResult['platformSettings']> = {
    instagram: {
      aspectRatio: '9:16',
      maxDurationSeconds: 90,
      resolution: '1080x1920',
      exportFormat: 'MP4 H.264',
      fps: 30,
      tips: [
        'First 3 seconds must grab attention — no slow intros',
        'Add captions (85% of Reels are watched without sound)',
        'Ideal length: 15–30 seconds for Reels',
        'Vertical (9:16) gets 30% more reach than square or horizontal',
        'Hook in the first frame — no black screen openings',
      ],
    },
    tiktok: {
      aspectRatio: '9:16',
      maxDurationSeconds: 600,
      resolution: '1080x1920',
      exportFormat: 'MP4 H.264',
      fps: 30,
      tips: [
        'Fast pacing — cut every 2-3 seconds minimum',
        'Start with the most interesting moment, not the beginning',
        'Use trending sounds when possible',
        'Text overlays help retain viewers',
        'TikTok rewards 100% completion rate — keep it tight',
      ],
    },
    linkedin: {
      aspectRatio: '16:9',
      maxDurationSeconds: 600,
      resolution: '1920x1080',
      exportFormat: 'MP4 H.264',
      fps: 30,
      tips: [
        'First 5 seconds should state the value proposition clearly',
        'Add captions — most LinkedIn videos are watched silently',
        'Professional tone, clean cuts, no flashy transitions',
        'Optimal length: 1–2 minutes for thought leadership content',
        'Include a clear CTA (comment/share/visit link)',
      ],
    },
    youtube: {
      aspectRatio: '16:9',
      maxDurationSeconds: 43200, // 12 hours
      resolution: '1920x1080',
      exportFormat: 'MP4 H.264/H.265',
      fps: 30,
      tips: [
        'Hook in first 15 seconds to prevent drop-off',
        'Chapters/timestamps boost engagement and SEO',
        'End screen with subscribe button in last 20 seconds',
        'Audio quality matters as much as video quality',
        'Export at highest quality — YouTube recompresses everything',
      ],
    },
    facebook: {
      aspectRatio: '1:1 or 16:9',
      maxDurationSeconds: 14400, // 4 hours
      resolution: '1080x1080',
      exportFormat: 'MP4 H.264',
      fps: 30,
      tips: [
        'Square (1:1) format performs best in feed',
        'Captions essential — 85% of Facebook video is watched without sound',
        'Optimal length: 1–3 minutes for feed videos',
        'Strong thumbnail increases click-through rate',
        'Live videos get 6x more interaction — consider going live',
      ],
    },
  }

  const specs = PLATFORM_SPECS[platform]
  if (!specs) {
    return {
      action: 'optimize-for-platform',
      summary: `Unknown platform: ${platform}`,
      suggestions: ['Supported platforms: instagram, tiktok, linkedin, youtube, facebook'],
    }
  }

  const fps = context.editorState?.fps ?? 30
  const totalFrames = context.editorState?.totalDurationInFrames ?? 0
  const currentDurationSeconds = totalFrames / fps
  const isOverDuration = currentDurationSeconds > specs.maxDurationSeconds

  const suggestions = [
    ...specs.tips,
    `Export: ${specs.resolution} @ ${specs.fps}fps, ${specs.exportFormat}`,
    `Aspect ratio: ${specs.aspectRatio}`,
  ]

  if (isOverDuration) {
    suggestions.unshift(
      `⚠️ Current duration (${currentDurationSeconds.toFixed(0)}s) exceeds ${platform} max (${specs.maxDurationSeconds}s) — trim it down`,
    )
  }

  return {
    action: 'optimize-for-platform',
    summary: `${platform.charAt(0).toUpperCase() + platform.slice(1)} optimization: ${specs.resolution}, max ${specs.maxDurationSeconds}s, ${specs.aspectRatio}`,
    suggestions,
    platformSettings: specs,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

const VALID_ACTIONS: QuickActionId[] = [
  'remove-dead-air',
  'auto-captions',
  'suggest-music',
  'optimize-for-platform',
]

export async function POST(request: NextRequest) {
  let body: QuickActionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, context } = body

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 },
    )
  }

  if (!context) {
    return NextResponse.json({ error: 'context is required' }, { status: 400 })
  }

  try {
    let result: QuickActionResult

    switch (action) {
      case 'remove-dead-air':
        result = await handleRemoveDeadAir(body)
        break
      case 'auto-captions':
        result = await handleAutoCaptions(body)
        break
      case 'suggest-music':
        result = await handleSuggestMusic(body)
        break
      case 'optimize-for-platform':
        result = await handleOptimizeForPlatform(body)
        break
      default:
        return NextResponse.json({ error: `Unhandled action: ${action}` }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error(`[/api/ai/quick-action] ${action} error:`, err)
    return NextResponse.json(
      { error: `Quick action failed: ${String(err)}` },
      { status: 500 },
    )
  }
}
