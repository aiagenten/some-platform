import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 300

const WHISPER_URL = process.env.LOCAL_WHISPER_URL || ''

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
        { error: 'Burn subtitles service not configured' },
        { status: 503 }
      )
    }

    // Proxy to Railway whisper-api server (has ffmpeg)
    console.log('Burning subtitles via:', WHISPER_URL)
    const res = await fetch(`${WHISPER_URL}/burn-subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url, segments }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Burn subtitles error:', res.status, errText)
      return NextResponse.json(
        { error: `Burn failed: ${res.status}` },
        { status: 500 }
      )
    }

    // Get the video binary back
    const videoBuffer = await res.arrayBuffer()

    // Upload to Supabase Storage if org_id provided
    if (org_id) {
      const supabase = createAdminClient()
      const fileName = `${org_id}/subtitled/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, Buffer.from(videoBuffer), {
          contentType: 'video/mp4',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload processed video' }, { status: 500 })
      }

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      return NextResponse.json({ success: true, url: urlData.publicUrl })
    }

    // Return video directly if no org_id
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
