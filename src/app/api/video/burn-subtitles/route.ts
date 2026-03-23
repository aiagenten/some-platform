import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

const WHISPER_URL = process.env.LOCAL_WHISPER_URL || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const { video_url, segments, org_id } = await request.json()

    if (!video_url || !segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'video_url and segments are required' },
        { status: 400 }
      )
    }

    if (!WHISPER_URL) {
      return NextResponse.json(
        { error: 'Burn subtitles service not configured (LOCAL_WHISPER_URL missing)' },
        { status: 503 }
      )
    }

    // Build upload path for Supabase
    const uploadPath = org_id
      ? `${org_id}/subtitled/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
      : null

    // Send to Railway — Railway uploads directly to Supabase (avoids Netlify body size limit)
    console.log('Burning subtitles via:', WHISPER_URL)
    const payload: Record<string, unknown> = { video_url, segments }

    if (uploadPath && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      payload.supabase_url = SUPABASE_URL
      payload.supabase_key = SUPABASE_SERVICE_KEY
      payload.upload_path = uploadPath
    }

    const res = await fetch(`${WHISPER_URL}/burn-subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Burn subtitles error:', res.status, errText)
      return NextResponse.json(
        { error: `Burn failed: ${res.status}` },
        { status: 500 }
      )
    }

    const contentType = res.headers.get('content-type') || ''

    // If Railway returned JSON (uploaded to Supabase directly)
    if (contentType.includes('application/json')) {
      const data = await res.json()
      return NextResponse.json(data)
    }

    // Fallback: binary response (shouldn't happen with Supabase upload)
    const videoBuffer = await res.arrayBuffer()
    return new Response(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="subtitled.mp4"',
      },
    })
  } catch (err) {
    console.error('Burn subtitles error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
