import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createAdminClient } from '@/lib/supabase/admin'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(request: NextRequest) {
  try {
    const { start_image_url, end_image_url, motion_prompt, duration, aspect_ratio, video_id, org_id } = await request.json()

    if (!start_image_url || !org_id) {
      return NextResponse.json({ error: 'start_image_url and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Update video status
    if (video_id) {
      await supabase.from('videos').update({ status: 'generating_video' }).eq('id', video_id)
    }

    const input: Record<string, unknown> = {
      prompt: motion_prompt || 'Smooth cinematic camera movement',
      image_url: start_image_url,
      duration: String(duration || 5),
      aspect_ratio: aspect_ratio || '9:16',
    }

    if (end_image_url) {
      input.tail_image_url = end_image_url
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe('fal-ai/kling-video/o1/image-to-video', { input } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoUrl = (result as any)?.data?.video?.url || (result as any)?.video?.url || null

    if (!videoUrl) {
      console.error('No video URL in result:', JSON.stringify(result).substring(0, 500))
      if (video_id) {
        await supabase.from('videos').update({ status: 'failed', metadata: { error: 'No video URL returned' } }).eq('id', video_id)
      }
      return NextResponse.json({ error: 'Video generation failed - no URL returned' }, { status: 500 })
    }

    // Download and upload to Supabase Storage
    let storedVideoUrl = videoUrl
    try {
      const videoResponse = await fetch(videoUrl)
      if (videoResponse.ok) {
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
        const fileName = `${org_id}/raw-videos/${Date.now()}.mp4`
        const { error: uploadError } = await supabase
          .storage.from('videos')
          .upload(fileName, videoBuffer, { contentType: 'video/mp4', upsert: false })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
          storedVideoUrl = urlData.publicUrl
        }
      }
    } catch (uploadErr) {
      console.error('Video upload error:', uploadErr)
      // Keep the original fal.ai URL as fallback
    }

    // Update video record
    if (video_id) {
      await supabase.from('videos').update({
        video_url: storedVideoUrl,
        status: 'images_ready',
      }).eq('id', video_id)
    }

    return NextResponse.json({ success: true, video_url: storedVideoUrl })
  } catch (err) {
    console.error('Generate video error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
