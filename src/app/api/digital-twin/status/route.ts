import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FAL_KEY = process.env.FAL_KEY

export async function GET(request: NextRequest) {
  try {
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 })

    const twinId = request.nextUrl.searchParams.get('twin_id')
    if (!twinId) {
      return NextResponse.json({ error: 'twin_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: twin, error: twinErr } = await admin
      .from('digital_twins')
      .select('*')
      .eq('id', twinId)
      .eq('tenant_id', profile.org_id)
      .single()

    if (twinErr || !twin) {
      return NextResponse.json({ error: 'Twin not found' }, { status: 404 })
    }

    if (twin.status !== 'training' || !twin.fal_training_request_id) {
      return NextResponse.json({ status: twin.status, twin })
    }

    // Poll fal.ai for training status
    const statusResp = await fetch(
      `https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${twin.fal_training_request_id}/status`,
      {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
      }
    )

    if (!statusResp.ok) {
      return NextResponse.json({ status: twin.status, fal_status: 'unknown' })
    }

    const statusData = await statusResp.json()

    if (statusData.status === 'COMPLETED') {
      // Fetch the result
      const resultResp = await fetch(
        `https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${twin.fal_training_request_id}`,
        {
          headers: { 'Authorization': `Key ${FAL_KEY}` },
        }
      )

      if (resultResp.ok) {
        const resultData = await resultResp.json()
        const loraUrl = resultData.diffusers_lora_file?.url

        if (loraUrl) {
          await admin.from('digital_twins').update({
            status: 'ready',
            lora_url: loraUrl,
            sample_outputs: resultData.sample_images || null,
            updated_at: new Date().toISOString(),
          }).eq('id', twinId)

          return NextResponse.json({
            status: 'ready',
            lora_url: loraUrl,
            sample_outputs: resultData.sample_images || null,
          })
        }
      }
    }

    if (statusData.status === 'FAILED') {
      await admin.from('digital_twins').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', twinId)

      return NextResponse.json({ status: 'failed' })
    }

    return NextResponse.json({
      status: 'training',
      fal_status: statusData.status,
      queue_position: statusData.queue_position,
    })
  } catch (err) {
    console.error('Digital twin status error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Status-sjekk feilet: ${message}` }, { status: 500 })
  }
}
