import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FAL_KEY = process.env.FAL_KEY

export async function GET(request: NextRequest) {
  try {
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const requestId = request.nextUrl.searchParams.get('request_id')
    const orgId = request.nextUrl.searchParams.get('org_id')
    const videoId = request.nextUrl.searchParams.get('video_id')

    if (!requestId) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
    }

    // Check status — fal.ai uses short base path for status
    const statusResp = await fetch(
      `https://queue.fal.run/fal-ai/minimax-music/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    )

    if (!statusResp.ok) {
      const errText = await statusResp.text()
      console.error('fal.ai music status error:', statusResp.status, errText)
      return NextResponse.json({ error: 'Failed to check status', detail: errText }, { status: 500 })
    }

    const statusData = await statusResp.json()

    if (statusData.status === 'COMPLETED') {
      // Fetch the result
      const resultResp = await fetch(
        `https://queue.fal.run/fal-ai/minimax-music/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      )

      if (resultResp.ok) {
        const resultData = await resultResp.json()
        const musicUrl = resultData?.audio?.url || null

        if (musicUrl && orgId) {
          const supabase = createAdminClient()
          try {
            const musicResponse = await fetch(musicUrl)
            if (musicResponse.ok) {
              const musicBuffer = Buffer.from(await musicResponse.arrayBuffer())
              const fileName = `${orgId}/music/${Date.now()}.mp3`
              const { error: uploadError } = await supabase
                .storage.from('videos')
                .upload(fileName, musicBuffer, { contentType: 'audio/mpeg', upsert: false })

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
                const storedUrl = urlData.publicUrl

                if (videoId) {
                  await supabase.from('videos').update({
                    music_url: storedUrl,
                  }).eq('id', videoId)
                }

                return NextResponse.json({
                  status: 'COMPLETED',
                  music_url: storedUrl,
                })
              }
            }
          } catch (uploadErr) {
            console.error('Music upload error:', uploadErr)
          }
        }

        return NextResponse.json({
          status: 'COMPLETED',
          music_url: musicUrl,
        })
      }
    }

    return NextResponse.json({
      status: statusData.status || 'IN_PROGRESS',
      queue_position: statusData.queue_position,
    })
  } catch (err) {
    console.error('Music status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
