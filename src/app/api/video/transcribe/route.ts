import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // 5 min timeout for large videos

// Local Whisper server URL (fallback to OpenAI API)
const LOCAL_WHISPER_URL = process.env.LOCAL_WHISPER_URL || ''
const LOCAL_WHISPER_TOKEN = process.env.LOCAL_WHISPER_TOKEN || ''

async function transcribeLocal(videoUrl: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (LOCAL_WHISPER_TOKEN) {
    headers['Authorization'] = `Bearer ${LOCAL_WHISPER_TOKEN}`
  }

  return fetch(`${LOCAL_WHISPER_URL}/transcribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ video_url: videoUrl, language: 'no' }),
  })
}

async function transcribeOpenAI(videoUrl: string, apiKey: string): Promise<Response | { error: string; status: number }> {
  // Download the video from Supabase Storage
  console.log('Downloading video from:', videoUrl.substring(0, 80) + '...')
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    return { error: 'Could not download video', status: 400 }
  }

  const videoBuffer = await videoRes.arrayBuffer()
  const videoSize = videoBuffer.byteLength

  // Whisper API limit is 25MB
  if (videoSize > 25 * 1024 * 1024) {
    return { error: `Video is too large for OpenAI API (${(videoSize / 1024 / 1024).toFixed(0)}MB, max 25MB). Local Whisper server not available.`, status: 413 }
  }

  const audioBlob = new Blob([videoBuffer], { type: 'video/mp4' })
  const urlPath = new URL(videoUrl).pathname
  const fileName = urlPath.split('/').pop() || 'video.mp4'

  // Forward to OpenAI Whisper API
  const whisperForm = new FormData()
  whisperForm.append('file', audioBlob, fileName)
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('response_format', 'verbose_json')
  whisperForm.append('language', 'no')

  console.log(`Sending ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB to Whisper API...`)

  return fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: whisperForm,
  })
}

export async function POST(request: NextRequest) {
  try {
    // Support both JSON body (video_url) and FormData (file)
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const { video_url } = await request.json()
      if (!video_url) {
        return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
      }

      // Try local Whisper server first (handles any size, no API limits)
      if (LOCAL_WHISPER_URL) {
        console.log('Using local Whisper server:', LOCAL_WHISPER_URL)
        try {
          const localRes = await transcribeLocal(video_url)
          if (localRes.ok) {
            const data = await localRes.json()
            return NextResponse.json(data)
          }
          console.warn('Local Whisper failed:', localRes.status, await localRes.text())
        } catch (err) {
          console.warn('Local Whisper unreachable, falling back to OpenAI:', err)
        }
      }

      // Fallback to OpenAI API
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'No transcription service available (no local Whisper, no OpenAI key)' }, { status: 500 })
      }

      const result = await transcribeOpenAI(video_url, apiKey)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }

      if (!result.ok) {
        const errorText = await result.text()
        console.error('OpenAI Whisper API error:', result.status, errorText)
        return NextResponse.json({ error: `Transcription failed: ${result.status}` }, { status: 500 })
      }

      const transcription = await result.json()
      return NextResponse.json({
        success: true,
        text: transcription.text,
        segments: transcription.segments,
        words: transcription.words,
        language: transcription.language,
        duration: transcription.duration,
      })
    } else {
      // FormData upload — only OpenAI for now
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
      }

      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 })
      }

      const whisperForm = new FormData()
      whisperForm.append('file', file, file.name)
      whisperForm.append('model', 'whisper-1')
      whisperForm.append('response_format', 'verbose_json')
      whisperForm.append('language', 'no')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: whisperForm,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Whisper API error:', response.status, errorText)
        return NextResponse.json({ error: `Transcription failed: ${response.status}` }, { status: 500 })
      }

      const transcription = await response.json()
      return NextResponse.json({
        success: true,
        text: transcription.text,
        segments: transcription.segments,
        words: transcription.words,
        language: transcription.language,
        duration: transcription.duration,
      })
    }
  } catch (err) {
    console.error('Transcribe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
