import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logUsage } from '@/lib/usage'

const FAL_KEY = process.env.FAL_KEY

export async function POST(request: NextRequest) {
  try {
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 })

    const { twin_id } = await request.json()
    if (!twin_id) {
      return NextResponse.json({ error: 'twin_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch twin and verify ownership
    const { data: twin, error: twinErr } = await admin
      .from('digital_twins')
      .select('*')
      .eq('id', twin_id)
      .eq('tenant_id', profile.org_id)
      .single()

    if (twinErr || !twin) {
      return NextResponse.json({ error: 'Twin not found' }, { status: 404 })
    }

    const trainingImages = twin.training_images as string[]
    if (!trainingImages?.length) {
      return NextResponse.json({ error: 'No training images uploaded' }, { status: 400 })
    }

    // Create a zip URL from images for fal.ai
    // fal.ai accepts images_data_url as a zip or individual URLs
    // We'll pass the array directly as image URLs
    const startTime = Date.now()
    const queueResp = await fetch('https://queue.fal.run/fal-ai/flux-lora-fast-training', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images_data_url: trainingImages,
        trigger_word: twin.trigger_word,
        steps: 1000,
      }),
    })

    if (!queueResp.ok) {
      const errText = await queueResp.text()
      console.error('fal.ai training queue error:', queueResp.status, errText)
      await admin.from('digital_twins').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', twin_id)
      logUsage({ org_id: profile.org_id, type: 'image_generation', provider: 'fal', model: 'flux-lora-fast-training', success: false, duration_ms: Date.now() - startTime })
      return NextResponse.json({ error: `Training queue failed: ${errText}` }, { status: 500 })
    }

    const queueData = await queueResp.json()
    const requestId = queueData.request_id

    await admin.from('digital_twins').update({
      status: 'training',
      fal_training_request_id: requestId,
      updated_at: new Date().toISOString(),
    }).eq('id', twin_id)

    logUsage({
      org_id: profile.org_id,
      type: 'image_generation',
      provider: 'fal',
      model: 'flux-lora-fast-training',
      success: true,
      duration_ms: Date.now() - startTime,
      cost_estimate: 2.0,
      metadata: { twin_id, images_count: trainingImages.length },
    })

    return NextResponse.json({ success: true, request_id: requestId })
  } catch (err) {
    console.error('Train digital twin error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
