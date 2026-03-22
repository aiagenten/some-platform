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

    // Check status (must use full model path matching the queue submission)
    const modelPath = 'fal-ai/kling-video/o1/image-to-video'
    const statusResp = await fetch(
      `https://queue.fal.run/${modelPath}/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    )

    if (!statusResp.ok) {
      const errText = await statusResp.text()
      console.error('fal.ai status error:', statusResp.status, errText)
      return NextResponse.json({ error: 'Failed to check status', detail: errText }, { status: 500 })
    }

    const statusData = await statusResp.json()

    if (statusData.status === 'COMPLETED') {
      // Fetch the result
      const resultResp = await fetch(
        `https://queue.fal.run/${modelPath}/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      )

      if (resultResp.ok) {
        const resultData = await resultResp.json()
        const videoUrl = resultData?.video?.url || null

        if (videoUrl && orgId) {
          // Download and store in Supabase
          const supabase = createAdminClient()
          try {
            const videoResponse = await fetch(videoUrl)
            if (videoResponse.ok) {
              const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
              const fileName = `${orgId}/raw-videos/${Date.now()}.mp4`
              const { error: uploadError } = await supabase
                .storage.from('videos')
                .upload(fileName, videoBuffer, { contentType: 'video/mp4', upsert: false })

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
                const storedUrl = urlData.publicUrl

                if (videoId) {
                  await supabase.from('videos').update({
                    video_url: storedUrl,
                    status: 'images_ready',
                  }).eq('id', videoId)
                }

                return NextResponse.json({
                  status: 'COMPLETED',
                  video_url: storedUrl,
                })
              }
            }
          } catch (uploadErr) {
            console.error('Video upload error:', uploadErr)
          }
        }

        return NextResponse.json({
          status: 'COMPLETED',
          video_url: videoUrl,
        })
      }
    }

    return NextResponse.json({
      status: statusData.status || 'IN_PROGRESS',
      queue_position: statusData.queue_position,
    })
  } catch (err) {
    console.error('Video status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
