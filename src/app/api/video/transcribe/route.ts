import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // 5 min timeout for large videos

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Support both JSON body (video_url) and FormData (file)
    const contentType = request.headers.get('content-type') || ''
    let audioBlob: Blob
    let fileName = 'audio.mp4'

    if (contentType.includes('application/json')) {
      const { video_url } = await request.json()
      if (!video_url) {
        return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
      }

      // Download the video from Supabase Storage
      console.log('Downloading video from:', video_url.substring(0, 80) + '...')
      const videoRes = await fetch(video_url)
      if (!videoRes.ok) {
        return NextResponse.json({ error: 'Could not download video' }, { status: 400 })
      }

      const videoBuffer = await videoRes.arrayBuffer()
      const videoSize = videoBuffer.byteLength

      // Whisper API limit is 25MB — if video is larger, we need to inform the user
      if (videoSize > 25 * 1024 * 1024) {
        // Try sending just the first 24MB — Whisper can still transcribe partial audio
        // For proper solution, we'd extract audio server-side with ffmpeg
        console.log(`Video is ${(videoSize / 1024 / 1024).toFixed(1)}MB, truncating to 24MB for Whisper`)
        audioBlob = new Blob([videoBuffer.slice(0, 24 * 1024 * 1024)], { type: 'video/mp4' })
      } else {
        audioBlob = new Blob([videoBuffer], { type: 'video/mp4' })
      }

      // Extract filename from URL
      const urlPath = new URL(video_url).pathname
      fileName = urlPath.split('/').pop() || 'video.mp4'
    } else {
      // FormData upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 })
      }
      audioBlob = file
      fileName = file.name
    }

    // Forward to OpenAI Whisper API
    const whisperForm = new FormData()
    whisperForm.append('file', audioBlob, fileName)
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('response_format', 'verbose_json')
    whisperForm.append('language', 'no') // Norwegian

    console.log(`Sending ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB to Whisper API...`)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
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
  } catch (err) {
    console.error('Transcribe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
