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

    const { twin_id, prompt, image_size, num_images } = await request.json()
    if (!twin_id || !prompt) {
      return NextResponse.json({ error: 'twin_id and prompt are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: twin, error: twinErr } = await admin
      .from('digital_twins')
      .select('*')
      .eq('id', twin_id)
      .eq('tenant_id', profile.org_id)
      .single()

    if (twinErr || !twin) {
      return NextResponse.json({ error: 'Twin not found' }, { status: 404 })
    }

    if (twin.status !== 'ready' || !twin.lora_url) {
      return NextResponse.json({ error: 'Twin is not ready for generation' }, { status: 400 })
    }

    const startTime = Date.now()
    const genResp = await fetch('https://queue.fal.run/fal-ai/flux-lora', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        loras: [{ path: twin.lora_url, scale: twin.lora_scale || 1.0 }],
        image_size: image_size || 'landscape_16_9',
        num_images: num_images || 1,
      }),
    })

    if (!genResp.ok) {
      const errText = await genResp.text()
      console.error('fal.ai generation error:', genResp.status, errText)
      logUsage({ org_id: profile.org_id, type: 'image_generation', provider: 'fal', model: 'flux-lora', success: false, duration_ms: Date.now() - startTime })
      return NextResponse.json({ error: `Generation failed: ${errText}` }, { status: 500 })
    }

    const genData = await genResp.json()

    // If queued, we need to poll — but flux-lora via queue returns request_id
    // Check if we got images directly or a request_id
    if (genData.images) {
      logUsage({
        org_id: profile.org_id,
        type: 'image_generation',
        provider: 'fal',
        model: 'flux-lora',
        success: true,
        duration_ms: Date.now() - startTime,
        cost_estimate: 0.05 * (num_images || 1),
        metadata: { twin_id },
      })

      return NextResponse.json({
        success: true,
        images: genData.images,
      })
    }

    // Queued — poll for result
    const requestId = genData.request_id
    if (!requestId) {
      return NextResponse.json({ error: 'No images or request_id returned' }, { status: 500 })
    }

    // Poll up to 120 seconds
    const maxWait = 120_000
    const pollInterval = 3_000
    const deadline = Date.now() + maxWait

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollInterval))

      const statusResp = await fetch(
        `https://queue.fal.run/fal-ai/flux-lora/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      )
      if (!statusResp.ok) continue

      const statusData = await statusResp.json()

      if (statusData.status === 'COMPLETED') {
        const resultResp = await fetch(
          `https://queue.fal.run/fal-ai/flux-lora/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_KEY}` } }
        )

        if (resultResp.ok) {
          const resultData = await resultResp.json()
          logUsage({
            org_id: profile.org_id,
            type: 'image_generation',
            provider: 'fal',
            model: 'flux-lora',
            success: true,
            duration_ms: Date.now() - startTime,
            cost_estimate: 0.05 * (num_images || 1),
            metadata: { twin_id },
          })

          return NextResponse.json({
            success: true,
            images: resultData.images,
          })
        }
      }

      if (statusData.status === 'FAILED') {
        logUsage({ org_id: profile.org_id, type: 'image_generation', provider: 'fal', model: 'flux-lora', success: false, duration_ms: Date.now() - startTime })
        return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
      }
    }

    logUsage({ org_id: profile.org_id, type: 'image_generation', provider: 'fal', model: 'flux-lora', success: false, duration_ms: Date.now() - startTime })
    return NextResponse.json({ error: 'Generation timed out' }, { status: 504 })
  } catch (err) {
    console.error('Digital twin generate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
