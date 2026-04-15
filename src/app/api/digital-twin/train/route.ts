import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logUsage } from '@/lib/usage'
import { logAudit } from '@/lib/audit'

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

    // fal.ai flux-lora-fast-training requires images_data_url (URL to a zip file)
    // Step 1: Download all images, zip them, upload zip to Supabase Storage
    const startTime = Date.now()

    // Fetch all images in parallel with 30s timeout each. Fail fast if any
    // image is missing — a partial zip would produce a corrupted LoRA run.
    let downloaded: ArrayBuffer[]
    try {
      downloaded = await Promise.all(
        trainingImages.map(async (url, i) => {
          const imgResp = await fetch(url, { signal: AbortSignal.timeout(30_000) })
          if (!imgResp.ok) throw new Error(`Failed to download image ${i + 1}`)
          return imgResp.arrayBuffer()
        })
      )
    } catch (e) {
      console.error('Training image fetch error:', e)
      await admin.from('digital_twins').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', twin_id)
      const msg = e instanceof Error ? e.message : 'Could not download training images'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // All images downloaded — build zip
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    downloaded.forEach((buffer, i) => {
      zip.file(`img_${String(i + 1).padStart(2, '0')}.jpeg`, buffer)
    })

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    // Upload zip to Supabase Storage
    const zipPath = `${profile.org_id}/training-${twin_id}.zip`
    const { error: uploadErr } = await admin.storage
      .from('training-images')
      .upload(zipPath, zipBuffer, { contentType: 'application/zip', upsert: true })

    if (uploadErr) {
      console.error('Zip upload error:', uploadErr)
      await admin.from('digital_twins').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', twin_id)
      return NextResponse.json({ error: 'Failed to upload training zip' }, { status: 500 })
    }

    const { data: { publicUrl: zipUrl } } = admin.storage.from('training-images').getPublicUrl(zipPath)

    const queueResp = await fetch('https://queue.fal.run/fal-ai/flux-lora-fast-training', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images_data_url: zipUrl,
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

    await logAudit({
      action: 'digital_twin.training_started',
      resourceType: 'digital_twin',
      resourceId: twin_id,
      resourceTitle: twin.name,
      metadata: { images_count: trainingImages.length, request_id: requestId },
    })

    return NextResponse.json({ success: true, request_id: requestId })
  } catch (err) {
    console.error('Train digital twin error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Trening feilet: ${message}` }, { status: 500 })
  }
}
