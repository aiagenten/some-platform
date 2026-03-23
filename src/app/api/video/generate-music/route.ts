import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logUsage } from '@/lib/usage'

const FAL_KEY = process.env.FAL_KEY

export async function POST(request: NextRequest) {
  try {
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const { music_prompt, duration, video_id, org_id } = await request.json()

    if (!music_prompt || !org_id) {
      return NextResponse.json({ error: 'music_prompt and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (video_id) {
      await supabase.from('videos').update({ status: 'generating_music' }).eq('id', video_id)
    }

    // Submit to fal.ai queue (non-blocking)
    const musicGenStart = Date.now()
    const queueResp = await fetch('https://queue.fal.run/fal-ai/minimax-music/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: music_prompt,
        duration_seconds: duration || 5,
      }),
    })

    if (!queueResp.ok) {
      const errText = await queueResp.text()
      console.error('fal.ai music queue error:', queueResp.status, errText)
      logUsage({ org_id, type: 'music_generation', provider: 'fal', model: 'minimax-music/v2', success: false, duration_ms: Date.now() - musicGenStart })
      return NextResponse.json({ error: `Music queue failed: ${errText}` }, { status: 500 })
    }

    const queueData = await queueResp.json()
    const requestId = queueData.request_id
    logUsage({ org_id, type: 'music_generation', provider: 'fal', model: 'minimax-music/v2', success: true, duration_ms: Date.now() - musicGenStart, cost_estimate: 0.05 })

    if (video_id) {
      await supabase.from('videos').update({
        metadata: { fal_music_request_id: requestId },
        music_prompt,
      }).eq('id', video_id)
    }

    return NextResponse.json({
      success: true,
      request_id: requestId,
    })
  } catch (err) {
    console.error('Generate music error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
