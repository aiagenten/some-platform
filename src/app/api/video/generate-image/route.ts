import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { prompt, style_id, aspect_ratio, org_id } = await request.json()

    if (!prompt || !org_id) {
      return NextResponse.json({ error: 'prompt and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch org settings for image model and styles
    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', org_id)
      .single()

    const orgSettings = (orgData?.settings as Record<string, unknown>) || {}
    const imageModel = (orgSettings.image_model as string) || 'nano-banana'
    const activeStyleId = style_id || (orgSettings.active_image_style as string) || 'scandinavian-photo'
    const imageStyles = (orgSettings.image_styles as Array<{ id: string; name: string; prompt: string }>) || []

    // Fetch brand profile for colors
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const brandColorDesc = brandProfile?.colors?.length
      ? brandProfile.colors
          .filter((c: { hex: string; role: string }) => c.role && c.role !== 'neutral_dark' && c.role !== 'neutral_light')
          .map((c: { hex: string; role: string }) => `${c.role}: ${c.hex}`)
          .join(', ')
      : 'professional, clean colors'

    // Build the full image prompt using the selected style
    const defaultStylePrompt = 'Photorealistic photograph, shot on Canon EOS R5 with 85mm f/1.4 lens. {situation}. Scandinavian setting. Natural light. No text on screens. No watermarks.'
    const activeStyle = imageStyles.find(s => s.id === activeStyleId)
    const stylePrompt = activeStyle?.prompt || defaultStylePrompt
    const styledPrompt = stylePrompt.replace(/\{situation\}/g, prompt)

    const imageGenPrompt = `${styledPrompt}\n\nBrand colors for subtle accent/props: ${brandColorDesc}\nIndustry: ${brandProfile?.description || 'technology and business'}\n\nIMPORTANT: No text overlays, no UI elements, no logos.`

    // Map aspect_ratio to size
    const sizeMap: Record<string, string> = {
      '9:16': '1024x1536',
      '1:1': '1024x1024',
      '16:9': '1536x1024',
    }

    let imageUrl: string | null = null
    let b64: string | null = null
    let mimeType = 'image/png'

    if (imageModel === 'gpt-image' && OPENAI_API_KEY) {
      const size = sizeMap[aspect_ratio || '9:16'] || '1024x1536'
      const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: `${imageGenPrompt}\n\nDO NOT include any text, watermarks, or logos in the image.`,
          n: 1,
          size,
          quality: 'medium',
        }),
      })

      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        b64 = imageData.data?.[0]?.b64_json || null
        if (!b64 && imageData.data?.[0]?.url) {
          imageUrl = imageData.data[0].url
        }
      } else {
        const errText = await imageResponse.text()
        console.error('GPT Image error:', errText)
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
      }
    } else {
      // Nano Banana (Gemini) via OpenRouter
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
            content: [{ type: 'text', text: `Generate an image for a video. DO NOT include any text in the image.\n\n${imageGenPrompt}` }],
          }],
        }),
      })

      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        const message = imageData.choices?.[0]?.message
        const images = message?.images || []
        if (images.length > 0) {
          const imgUrl = images[0]?.image_url?.url
          if (imgUrl?.startsWith('data:')) {
            const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/)
            if (match) { mimeType = match[1]; b64 = match[2] }
          } else if (imgUrl) {
            imageUrl = imgUrl
          }
        }
        // Fallback: check content for inline images
        if (!b64 && !imageUrl) {
          const content = message?.content
          if (Array.isArray(content)) {
            for (const part of content) {
              if (part.type === 'image_url' && part.image_url?.url) {
                if (part.image_url.url.startsWith('data:')) {
                  const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
                  if (match) { mimeType = match[1]; b64 = match[2] }
                } else {
                  imageUrl = part.image_url.url
                }
              }
            }
          } else if (typeof content === 'string') {
            const b64Match = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/)
            if (b64Match) { mimeType = `image/${b64Match[1]}`; b64 = b64Match[2] }
          }
        }
      } else {
        const errText = await imageResponse.text()
        console.error('Nano Banana error:', errText)
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
      }
    }

    // Upload base64 to Supabase Storage
    if (b64 && !imageUrl) {
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
      const fileName = `${org_id}/start-images/${Date.now()}.${ext}`
      const buffer = Buffer.from(b64, 'base64')

      const { error: uploadError } = await supabase
        .storage.from('videos')
        .upload(fileName, buffer, { contentType: mimeType, upsert: false })

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      } else {
        console.error('Upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, image_url: imageUrl })
  } catch (err) {
    console.error('Generate image error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
