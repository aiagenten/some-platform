import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fal } from '@fal-ai/client'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

export async function POST(request: NextRequest) {
  try {
    const { product_id, scene_prompt, org_id } = await request.json()

    if (!product_id || !scene_prompt || !org_id) {
      return NextResponse.json(
        { error: 'product_id, scene_prompt, and org_id are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Fetch the product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('org_id', org_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Create placement record
    const { data: placement, error: insertError } = await supabase
      .from('product_placements')
      .insert({
        org_id,
        product_id,
        scene_prompt,
        status: 'generating',
      })
      .select()
      .single()

    if (insertError || !placement) {
      console.error('Insert placement error:', insertError)
      return NextResponse.json({ error: 'Failed to create placement record' }, { status: 500 })
    }

    // Check org settings for image model preference
    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', org_id)
      .single()

    const orgSettings = (orgData?.settings as Record<string, unknown>) || {}
    const imageModel = (orgSettings.image_model as string) || 'flux-kontext'

    const editPrompt = `Place this product naturally into the following scene: ${scene_prompt}. The product should look realistic, properly lit, and naturally integrated into the environment. Photorealistic product photography. No text overlays, no UI elements.`

    let imageUrl: string | null = null
    let modelUsed = 'flux-kontext'

    // Strategy 1: GPT Image (if org prefers it)
    if (imageModel === 'gpt-image' && OPENAI_API_KEY) {
      try {
        const imgResp = await fetch(product.image_url)
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
        const imgBlob = new Blob([imgBuffer], { type: 'image/png' })

        const formData = new FormData()
        formData.append('model', 'gpt-image-1')
        formData.append('prompt', editPrompt)
        formData.append('image[]', imgBlob, 'product.png')
        formData.append('size', '1024x1024')
        formData.append('quality', 'medium')
        formData.append('n', '1')

        const editResponse = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        })

        if (editResponse.ok) {
          const editData = await editResponse.json()
          const b64 = editData.data?.[0]?.b64_json
          if (b64) {
            const fileName = `${org_id}/product-placements/${Date.now()}.png`
            const buffer = Buffer.from(b64, 'base64')
            const { error: uploadError } = await supabase
              .storage.from('post-images')
              .upload(fileName, buffer, { contentType: 'image/png', upsert: false })
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName)
              imageUrl = urlData.publicUrl
              modelUsed = 'gpt-image'
            }
          } else if (editData.data?.[0]?.url) {
            imageUrl = editData.data[0].url
            modelUsed = 'gpt-image'
          }
        } else {
          const errText = await editResponse.text()
          console.error('GPT Image edit error:', editResponse.status, errText)
        }
      } catch (gptErr) {
        console.error('GPT Image error:', gptErr)
      }
    }

    // Strategy 2: Flux Kontext via fal.ai
    if (!imageUrl && process.env.FAL_KEY) {
      try {
        const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
          input: {
            prompt: editPrompt,
            image_url: product.image_url,
            guidance_scale: 3.5,
            num_images: 1,
            output_format: 'jpeg',
            seed: Math.floor(Math.random() * 999999),
          },
          logs: false,
        }) as { data: { images?: Array<{ url?: string }> } }

        const resultUrl = result?.data?.images?.[0]?.url
        if (resultUrl) {
          const imgResp = await fetch(resultUrl)
          const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
          const fileName = `${org_id}/product-placements/${Date.now()}.jpg`
          const { error: uploadError } = await supabase
            .storage.from('post-images')
            .upload(fileName, imgBuffer, { contentType: 'image/jpeg', upsert: false })
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
            modelUsed = 'flux-kontext'
          }
        }
      } catch (falErr) {
        console.error('Flux Kontext error:', falErr)
      }
    }

    if (!imageUrl) {
      // Update placement as failed
      await supabase
        .from('product_placements')
        .update({ status: 'failed', error_message: 'Could not generate image with any available model' })
        .eq('id', placement.id)

      return NextResponse.json({ error: 'Could not generate scene image with any available model' }, { status: 500 })
    }

    // Update placement with result
    const { data: updated, error: updateError } = await supabase
      .from('product_placements')
      .update({
        result_image_url: imageUrl,
        status: 'completed',
        model_used: modelUsed,
      })
      .eq('id', placement.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update placement error:', updateError)
    }

    return NextResponse.json({ success: true, placement: updated })
  } catch (err) {
    console.error('Product placement generate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
