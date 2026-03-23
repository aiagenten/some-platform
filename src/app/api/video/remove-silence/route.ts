import { NextRequest, NextResponse } from 'next/server'

const WHISPER_URL = process.env.NEXT_PUBLIC_WHISPER_URL || process.env.LOCAL_WHISPER_URL || ''
const WHISPER_TOKEN = process.env.WHISPER_TOKEN || process.env.LOCAL_WHISPER_TOKEN || ''

export const maxDuration = 300

type Segment = {
  start: number
  end: number
  type: 'speech' | 'silence'
}

export async function POST(request: NextRequest) {
  try {
    const { video_url } = await request.json()

    if (!video_url) {
      return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
    }

    if (!WHISPER_URL) {
      return NextResponse.json(
        { error: 'Whisper URL not configured (NEXT_PUBLIC_WHISPER_URL)' },
        { status: 500 },
      )
    }

    // Step 1: Transcribe with word-level timestamps
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (WHISPER_TOKEN) headers['Authorization'] = `Bearer ${WHISPER_TOKEN}`

    const transcribeResp = await fetch(`${WHISPER_URL}/transcribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ video_url, language: 'no', word_timestamps: true }),
    })

    if (!transcribeResp.ok) {
      const err = await transcribeResp.text()
      return NextResponse.json({ error: `Transcription failed: ${err}` }, { status: 502 })
    }

    const transcribeData = await transcribeResp.json()
    const words: { word: string; start: number; end: number }[] = transcribeData.words || []

    if (!words.length) {
      return NextResponse.json({ segments: [], message: 'No words found in transcript' })
    }

    // Step 2: Identify silence gaps between words
    const SILENCE_THRESHOLD = 0.5 // seconds
    const segments: Segment[] = []

    // Before first word
    if (words[0].start > SILENCE_THRESHOLD) {
      segments.push({ start: 0, end: words[0].start, type: 'silence' })
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const nextWord = words[i + 1]

      // Speech segment for this word
      segments.push({ start: word.start, end: word.end, type: 'speech' })

      // Gap to next word
      if (nextWord && nextWord.start - word.end > SILENCE_THRESHOLD) {
        segments.push({ start: word.end, end: nextWord.start, type: 'silence' })
      }
    }

    // After last word (if video has trailing silence)
    // We don't know total video duration here without probing it
    const lastWord = words[words.length - 1]
    segments.push({ start: lastWord.start, end: lastWord.end, type: 'speech' })

    return NextResponse.json({
      segments,
      words,
      silenceCount: segments.filter(s => s.type === 'silence').length,
      speechCount: segments.filter(s => s.type === 'speech').length,
    })
  } catch (err) {
    console.error('remove-silence error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
