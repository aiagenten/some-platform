import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logUsage } from '@/lib/usage'
import { logAudit } from '@/lib/audit'

const FAL_KEY = process.env.FAL_KEY

/**
 * Enhance digital twin prompts with photorealistic quality modifiers.
 * Wraps the user's scene description with camera, lighting, and skin texture
 * instructions to avoid the "plasticky AI look".
 */
function enhancePrompt(userPrompt: string): string {
  // Check if user already included technical photography terms — don't double-wrap
  const hasPhotoTerms = /canon|nikon|sony|85mm|50mm|f\/\d|iso \d|film grain|skin texture|pores/i.test(userPrompt)
  if (hasPhotoTerms) return userPrompt

  // Detect scene type for appropriate lighting
  const isOutdoor = /outdoor|outside|forest|nature|trail|park|street|walk|beach|mountain|garden/i.test(userPrompt)
  const isStage = /stage|conference|keynote|presentation|event|podium|spotlight/i.test(userPrompt)

  const photoPrefix = 'Photorealistic photograph, shot on Canon EOS R5 with 85mm f/1.4 lens.'
  const skinRealism = 'Real skin texture with visible pores, subtle wrinkles, imperfections, age-appropriate features. No airbrushing, no smoothing. Authentic human face.'

  let lighting: string
  if (isOutdoor) {
    lighting = 'Golden hour natural sunlight with warm tones. Dappled light through trees. Subtle film grain, ISO 800+.'
  } else if (isStage) {
    lighting = 'Professional stage lighting with soft key light. Warm skin tones despite cool ambient. Subtle film grain, ISO 1600+.'
  } else {
    lighting = 'Natural window light with soft shadows, golden hour warmth. Subtle film grain, ISO 800+.'
  }

  const style = 'Muted Scandinavian color palette. Candid, authentic moment. Everyday clothing (wool, cotton, linen). No text on screens. No plastic skin. No perfect symmetry.'

  return `${photoPrefix} ${userPrompt}. ${skinRealism} ${lighting} ${style}`
}

/**
 * GET: Poll for queued generation result.
 * Called by frontend after POST returns { queued: true, request_id }.
 */
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

    const requestId = request.nextUrl.searchParams.get('request_id')
    const twinId = request.nextUrl.searchParams.get('twin_id')
    const prompt = request.nextUrl.searchParams.get('prompt') || ''
    const numImages = parseInt(request.nextUrl.searchParams.get('num_images') || '1')

    if (!requestId || !twinId) {
      return NextResponse.json({ error: 'request_id and twin_id are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify twin belongs to org
    const { data: twin } = await admin
      .from('digital_twins')
      .select('id, name')
      .eq('id', twinId)
      .eq('tenant_id', profile.org_id)
      .single()

    if (!twin) {
      return NextResponse.json({ error: 'Twin not found' }, { status: 404 })
    }

    // Check fal.ai queue status
    const statusResp = await fetch(
      `https://queue.fal.run/fal-ai/flux-lora/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    )

    if (!statusResp.ok) {
      return NextResponse.json({ status: 'polling', fal_status: 'unknown' })
    }

    const statusData = await statusResp.json()

    if (statusData.status === 'COMPLETED') {
      const resultResp = await fetch(
        `https://queue.fal.run/fal-ai/flux-lora/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      )

      if (!resultResp.ok) {
        return NextResponse.json({ error: 'Failed to fetch generation result' }, { status: 500 })
      }

      const resultData = await resultResp.json()

      // Persist images to Supabase Storage
      const saved = []
      for (let i = 0; i < resultData.images.length; i++) {
        const img = resultData.images[i]
        try {
          const imgResp = await fetch(img.url)
          if (!imgResp.ok) { saved.push(img); continue }
          const buffer = Buffer.from(await imgResp.arrayBuffer())
          const filename = `digital-twin/${twinId}/${Date.now()}-${i}.jpg`
          const { error: upErr } = await admin.storage
            .from('post-images')
            .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true })
          if (upErr) { saved.push(img); continue }
          const { data: { publicUrl } } = admin.storage.from('post-images').getPublicUrl(filename)
          await admin.from('media_assets').insert({
            org_id: profile.org_id,
            url: publicUrl,
            filename: filename.split('/').pop(),
            mime_type: 'image/jpeg',
            source: 'digital-twin',
            tags: ['digital-twin', twin.name],
            metadata: { twin_id: twinId, twin_name: twin.name, prompt, width: img.width, height: img.height, original_url: img.url },
          }).then(() => {}, (e: unknown) => console.error('media_assets insert error:', e))
          saved.push({ ...img, url: publicUrl, persisted: true })
        } catch (e) {
          console.error('Persist image error:', e)
          saved.push(img)
        }
      }

      logUsage({
        org_id: profile.org_id,
        type: 'image_generation',
        provider: 'fal',
        model: 'flux-lora',
        success: true,
        cost_estimate: 0.05 * numImages,
        metadata: { twin_id: twinId },
      })

      await logAudit({
        action: 'digital_twin.image_generated',
        resourceType: 'digital_twin',
        resourceId: twinId,
        resourceTitle: twin.name,
        metadata: { num_images: saved.length, prompt },
      })

      return NextResponse.json({
        success: true,
        status: 'completed',
        images: saved,
      })
    }

    if (statusData.status === 'FAILED') {
      logUsage({ org_id: profile.org_id, type: 'image_generation', provider: 'fal', model: 'flux-lora', success: false })
      return NextResponse.json({ status: 'failed', error: 'Generation failed' }, { status: 500 })
    }

    // Still in queue
    return NextResponse.json({
      status: 'polling',
      fal_status: statusData.status,
      queue_position: statusData.queue_position,
    })
  } catch (err) {
    console.error('Digital twin generate poll error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Polling feilet: ${message}` }, { status: 500 })
  }
}

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
        prompt: enhancePrompt(prompt),
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

    // Helper: persist images to Supabase Storage + media_assets table
    const persistImages = async (images: { url: string; width: number; height: number }[]) => {
      const saved = []
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        try {
          // Download from fal.ai
          const imgResp = await fetch(img.url)
          if (!imgResp.ok) { saved.push(img); continue }
          const buffer = Buffer.from(await imgResp.arrayBuffer())

          // Upload to Supabase Storage
          const filename = `digital-twin/${twin_id}/${Date.now()}-${i}.jpg`
          const { error: upErr } = await admin.storage
            .from('post-images')
            .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true })

          if (upErr) { console.error('Upload error:', upErr); saved.push(img); continue }

          const { data: { publicUrl } } = admin.storage.from('post-images').getPublicUrl(filename)

          // Save to media_assets table (media library)
          await admin.from('media_assets').insert({
            org_id: profile.org_id,
            url: publicUrl,
            filename: filename.split('/').pop(),
            mime_type: 'image/jpeg',
            source: 'digital-twin',
            tags: ['digital-twin', twin.name],
            metadata: { twin_id, twin_name: twin.name, prompt, width: img.width, height: img.height, original_url: img.url },
          }).then(() => {}, (e: unknown) => console.error('media_assets insert error:', e))

          saved.push({ ...img, url: publicUrl, persisted: true })
        } catch (e) {
          console.error('Persist image error:', e)
          saved.push(img)
        }
      }
      return saved
    }

    // If fal.ai returned images directly (rare), persist and return
    if (genData.images) {
      const persistedImages = await persistImages(genData.images)

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

      await logAudit({
        action: 'digital_twin.image_generated',
        resourceType: 'digital_twin',
        resourceId: twin_id,
        resourceTitle: twin.name,
        metadata: { num_images: persistedImages.length, prompt },
      })

      return NextResponse.json({
        success: true,
        images: persistedImages,
      })
    }

    // Queued — return request_id so frontend can poll via GET
    const requestId = genData.request_id
    if (!requestId) {
      return NextResponse.json({ error: 'No images or request_id returned' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      queued: true,
      request_id: requestId,
      twin_id,
    })
  } catch (err) {
    console.error('Digital twin generate error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Bildegenerering feilet: ${message}` }, { status: 500 })
  }
}
