import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Forward the file to OpenAI Whisper API
    const whisperForm = new FormData()
    whisperForm.append('file', file)
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('response_format', 'verbose_json')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: whisperForm,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Whisper API error:', errorText)
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
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
