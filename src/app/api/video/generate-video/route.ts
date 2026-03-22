import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FAL_KEY = process.env.FAL_KEY

export async function POST(request: NextRequest) {
  try {
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const { start_image_url, end_image_url, motion_prompt, duration, aspect_ratio, video_id, org_id } = await request.json()

    if (!start_image_url || !org_id) {
      return NextResponse.json({ error: 'start_image_url and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

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

    // Submit to fal.ai queue (non-blocking)
    const queueResp = await fetch('https://queue.fal.run/fal-ai/kling-video/o1/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!queueResp.ok) {
      const errText = await queueResp.text()
      console.error('fal.ai queue error:', queueResp.status, errText)
      return NextResponse.json({ error: `Video queue failed: ${errText}` }, { status: 500 })
    }

    const queueData = await queueResp.json()
    const requestId = queueData.request_id

    if (video_id) {
      await supabase.from('videos').update({ 
        metadata: { fal_request_id: requestId },
      }).eq('id', video_id)
    }

    return NextResponse.json({ 
      success: true, 
      request_id: requestId,
      status_url: queueData.status_url,
    })
  } catch (err) {
    console.error('Generate video error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
