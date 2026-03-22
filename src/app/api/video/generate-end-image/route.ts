import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fal } from '@fal-ai/client'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

export async function POST(request: NextRequest) {
  try {
    const { start_image_url, angle_prompt, aspect_ratio, org_id } = await request.json()

    if (!start_image_url || !angle_prompt || !org_id) {
      return NextResponse.json({ error: 'start_image_url, angle_prompt, and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', org_id)
      .single()

    const orgSettings = (orgData?.settings as Record<string, unknown>) || {}
    const imageModel = (orgSettings.image_model as string) || 'nano-banana'

    const editPrompt = `Same scene and subject as the reference image, but viewed from a different perspective: ${angle_prompt}. Maintain identical lighting, colors, subject appearance, clothing, and environment. Photorealistic. No text, no UI elements.`

    let imageUrl: string | null = null

    // Strategy 1: GPT Image with image editing (best for angle changes)
    if (imageModel === 'gpt-image' && OPENAI_API_KEY) {
      const sizeMap: Record<string, string> = {
        '9:16': '1024x1536',
        '1:1': '1024x1024',
        '16:9': '1536x1024',
      }
      const size = sizeMap[aspect_ratio || '9:16'] || '1024x1536'

      // Download reference image for GPT edit
      const imgResp = await fetch(start_image_url)
      const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
      const imgBlob = new Blob([imgBuffer], { type: 'image/png' })

      const formData = new FormData()
      formData.append('model', 'gpt-image-1')
      formData.append('prompt', editPrompt)
      formData.append('image[]', imgBlob, 'reference.png')
      formData.append('size', size)
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
          const fileName = `${org_id}/end-images/${Date.now()}.png`
          const buffer = Buffer.from(b64, 'base64')
          const { error: uploadError } = await supabase
            .storage.from('videos')
            .upload(fileName, buffer, { contentType: 'image/png', upsert: false })
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
          }
        } else if (editData.data?.[0]?.url) {
          imageUrl = editData.data[0].url
        }
      } else {
        const errText = await editResponse.text()
        console.error('GPT Image edit error:', editResponse.status, errText)
      }
    }

    // Strategy 2: Flux Kontext via fal.ai (image-to-image editing, preserves subject)
    if (!imageUrl && process.env.FAL_KEY) {
      try {
        const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
          input: {
            prompt: editPrompt,
            image_url: start_image_url,
            guidance_scale: 3.5,
            num_images: 1,
            output_format: 'jpeg',
            seed: Math.floor(Math.random() * 999999),
          },
          logs: false,
        }) as { data: { images?: Array<{ url?: string }> } }

        const resultUrl = result?.data?.images?.[0]?.url
        if (resultUrl) {
          // Download and upload to our storage
          const imgResp = await fetch(resultUrl)
          const imgBuffer = Buffer.from(await imgResp.arrayBuffer())
          const fileName = `${org_id}/end-images/${Date.now()}.jpg`
          const { error: uploadError } = await supabase
            .storage.from('videos')
            .upload(fileName, imgBuffer, { contentType: 'image/jpeg', upsert: false })
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
          }
        }
      } catch (falErr) {
        console.error('Flux Kontext error:', falErr)
      }
    }

    // Strategy 3: Fallback to Gemini (least reliable for angle changes)
    if (!imageUrl) {
      const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
      if (OPENROUTER_API_KEY) {
        const imageResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://some.aiagenten.no',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image',
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: start_image_url } },
                { type: 'text', text: `Create a completely NEW image showing the exact same scene, person, and setting but from this perspective: ${angle_prompt}. This must be a DIFFERENT image, not the same photo. Generate a new photograph.` },
              ],
            }],
          }),
        })

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          const message = imageData.choices?.[0]?.message
          let b64: string | null = null
          let mimeType = 'image/png'

          const images = message?.images || []
          if (images.length > 0) {
            const imgUrl = images[0]?.image_url?.url
            if (imgUrl?.startsWith('data:')) {
              const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/)
              if (match) { mimeType = match[1]; b64 = match[2] }
            } else if (imgUrl) { imageUrl = imgUrl }
          }
          if (!b64 && !imageUrl) {
            const content = message?.content
            if (Array.isArray(content)) {
              for (const part of content) {
                if (part.type === 'image_url' && part.image_url?.url) {
                  if (part.image_url.url.startsWith('data:')) {
                    const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
                    if (match) { mimeType = match[1]; b64 = match[2] }
                  } else { imageUrl = part.image_url.url }
                }
              }
            }
          }
          if (b64 && !imageUrl) {
            const ext = mimeType.includes('png') ? 'png' : 'jpg'
            const fileName = `${org_id}/end-images/${Date.now()}.${ext}`
            const buffer = Buffer.from(b64, 'base64')
            const { error: uploadError } = await supabase
              .storage.from('videos').upload(fileName, buffer, { contentType: mimeType, upsert: false })
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
              imageUrl = urlData.publicUrl
            }
          }
        }
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Could not generate end image with any available model' }, { status: 500 })
    }

    return NextResponse.json({ success: true, image_url: imageUrl })
  } catch (err) {
    console.error('Generate end image error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
