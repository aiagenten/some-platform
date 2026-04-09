import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logUsage } from '@/lib/usage'
import { logAudit } from '@/lib/audit'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Map format names to prompt-bibliotek keys
const FORMAT_TO_PROMPT_KEY: Record<string, string> = {
  feed: 'instagram_feed',
  carousel: 'instagram_carousel',
  karusell: 'instagram_carousel',
  reel: 'instagram_reel',
  story: 'instagram_feed', // Use feed template for stories
}

const PLATFORM_FORMAT_MAP: Record<string, Record<string, string>> = {
  instagram: {
    feed: 'instagram_feed',
    carousel: 'instagram_carousel',
    karusell: 'instagram_carousel',
    reel: 'instagram_reel',
    story: 'instagram_feed',
  },
  facebook: {
    feed: 'facebook_post',
    story: 'facebook_post',
    video: 'facebook_post',
  },
  linkedin: {
    feed: 'linkedin_post',
    article: 'linkedin_post',
  },
}

// Load content templates
import promptBibliotek from '../../../../../content-templates/s2-some-prompt-bibliotek.json'
// Image prompts template (reserved for custom style presets)
// import imagePrompts from '../../../../../content-templates/s4-image-prompts.json'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { org_id, platform, format, topic, regenerate_text, regenerate_image, post_id, image_model, image_style_id, reference_image_url, selected_overlay, generate_text_only, slide_count: requestedSlideCount, carousel_slide_index } = body
    const isCarousel = format === 'carousel' || format === 'karusell'
    const slideCount = isCarousel ? Math.min(Math.max(requestedSlideCount || 5, 3), 10) : 1

    if (!org_id || !platform || !format) {
      return NextResponse.json(
        { error: 'org_id, platform, and format are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Fetch brand profile
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Fetch org name and settings
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, settings')
      .eq('id', org_id)
      .single()

    // Get image generation settings
    const orgSettings = (orgData?.settings as Record<string, unknown>) || {}
    const configuredImageModel = (orgSettings.image_model as string) || 'nano-banana'
    const activeStyleId = (orgSettings.active_image_style as string) || 'scandinavian-photo'
    const imageStyles = (orgSettings.image_styles as Array<{ id: string; name: string; prompt: string }>) || []

    // Fetch brand learnings
    const { data: learnings } = await supabase
      .from('brand_learnings')
      .select('rule, learning_type')
      .eq('org_id', org_id)
      .eq('active', true)
      .order('confidence', { ascending: false })
      .limit(10)

    // Build template variables
    const brandName = orgData?.name || brandProfile?.tagline?.split(' ').slice(0, 3).join(' ') || 'din bedrift'
    const tone = brandProfile?.tone
      ? `${brandProfile.tone}${brandProfile.voice_description ? ' — ' + brandProfile.voice_description : ''}`
      : 'Profesjonell og vennlig'
    const targetAudience = brandProfile?.target_audience || 'Norske bedriftseiere og beslutningstagere'
    const dos = brandProfile?.do_list?.length
      ? brandProfile.do_list.map((d: string) => `- ${d}`).join('\n')
      : '- Vær autentisk\n- Del verdi'
    const donts = brandProfile?.dont_list?.length
      ? brandProfile.dont_list.map((d: string) => `- ${d}`).join('\n')
      : '- Ikke bruk klisjer\n- Ikke vær selgende'
    const learningsList = learnings?.length
      ? learnings.map((l) => `- [${l.learning_type}] ${l.rule}`).join('\n')
      : 'Ingen tidligere innsikter enda.'

    const topicText = topic || 'et relevant tema for målgruppen'

    // Find the right prompt template
    const promptKey = PLATFORM_FORMAT_MAP[platform]?.[format] || FORMAT_TO_PROMPT_KEY[format] || 'instagram_feed'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const promptTemplate = (promptBibliotek as Record<string, any>).prompts[promptKey]

    if (!promptTemplate) {
      return NextResponse.json(
        { error: `No prompt template found for ${platform}/${format}` },
        { status: 400 }
      )
    }

    // Replace variables in prompt
    const filledPrompt = promptTemplate.prompt
      .replace(/\{brand_name\}/g, brandName)
      .replace(/\{tone\}/g, tone)
      .replace(/\{topic\}/g, topicText)
      .replace(/\{target_audience\}/g, targetAudience)
      .replace(/\{dos\}/g, dos)
      .replace(/\{donts\}/g, donts)
      .replace(/\{learnings\}/g, learningsList)

    // Generate text via OpenRouter (Gemini Flash)
    let generatedText = null
    let generatedCaption = null
    let generatedHashtags: string[] = []
    let bestTime: string | null = null
    let imageSuggestion: string | null = null
    let generatedHeadline: string | null = null
    let generatedSubtitle: string | null = null
    let generatedCTA: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let carouselSlides: any[] | null = null

    if (!regenerate_image) {
      const platformRules: Record<string, string> = {
        instagram: `INSTAGRAM-REGLER (2025/2026 best practices):
- Tekst: 150-300 ord. Hook i første linje (vises uten "mer"-klikk).
- Emojier: bruk sparsomt og naturlig, aldri på rad.
- Hashtags: 3-5 relevante hashtags MAKS. Returneres separat i "hashtags"-feltet, ALDRI i selve teksten. Hvis innholdet er selvforklarende, dropp hashtags helt — algoritmen prioriterer innhold over hashtags.
- Ingen lenker i teksten (Instagram klikker ikke dem).
- Avslutt med en CTA eller spørsmål.`,
        facebook: `FACEBOOK-REGLER (2025/2026 best practices):
- Tekst: 100-250 ord. Kortere innlegg gir bedre rekkevidde.
- Emojier: tillatt, men ikke overdrev.
- Hashtags: UNNGÅ hashtags på Facebook — de gir ingen rekkeviddefordel og ser usprofesjonelt ut. Returner tom "hashtags"-array.
- Lenker fungerer, men begrens til én.
- Personlig og konversasjonelt tone fungerer best.`,
        linkedin: `LINKEDIN-REGLER (2025/2026 best practices):
- Tekst: 150-300 ord. Første linje er avgjørende — vises uten "se mer".
- Struktur: Hook → Verdi/innsikt → Avslutning med spørsmål/refleksjon.
- INGEN emojier i starten av linjer (klisjé på LinkedIn).
- Bruk linjeskift aktivt — korte avsnitt øker lesbarheten.
- Hashtags: UNNGÅ hashtags på LinkedIn — best practice er nå uten. Returner tom "hashtags"-array. LinkedIn-algoritmen belønner innholdet, ikke hashtags.
- Del personlige erfaringer og konkrete innsikter — ikke reklame.
- Ingen klisjeer som "Spent to announce", "I'm humbled", "Game-changer".`,
      }

      const systemPrompt = `Du er en ekspert SoMe-strateg for norske bedrifter. Du skriver for ${brandName}.

${platformRules[platform] || platformRules.instagram}

ABSOLUTTE REGLER:
- Skriv ALLTID på norsk (bokmål)
- Returner KUN gyldig JSON — ingen markdown, ingen forklaring utenfor JSON
- Teksten skal være klar til å poste direkte — ingen instruksjoner, ingen "Hook:"-labels, ingen seksjonsoverskrifter
- Skriv som et menneske, ikke som en AI

Returner dette JSON-formatet:
{
  "text": "Selve post-teksten klar til posting. Ingen hashtags her.",
  "headline": "Kort, fengende overskrift for bildet (maks 6-8 ord). Skal oppsummere kjernebudskapet.",
  "subtitle": "Én kort setning som utdyper overskriften (maks 15 ord).",
  "cta_text": "Kort CTA-tekst for knapp (2-4 ord, f.eks. 'Les mer', 'Bestill nå', 'Se tilbudet'). Tilpass til innholdet.",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "best_time": "Tirsdag-torsdag kl 08-10 eller 17-19",
  "image_suggestion": "Kort beskrivelse av hvilket bilde som vil fungere godt"
}` + (isCarousel && !carousel_slide_index ? `

TILLEGG FOR KARUSELL: Dette er en karusell med ${slideCount} slides.
Returner OGSÅ et "slides"-felt i JSON med en array på ${slideCount} objekter.
Hver slide følger en storytelling-flyt: Hook → Verdi → Verdi → ... → CTA.

Slide-struktur:
{
  "slides": [
    {
      "slide_index": 0,
      "headline": "Fengende hook-overskrift (slide 1 = oppmerksomhet)",
      "subtitle": "Kort undertekst",
      "cta_text": "",
      "text_content": "Kort tekst for denne sliden (1-2 setninger)",
      "image_suggestion": "Beskrivelse av bilde for denne sliden"
    },
    ...siste slide skal ha CTA
  ]
}

Slide 1 = Hook (fanger oppmerksomhet). Slides 2-${slideCount - 1} = Verdiinnhold. Slide ${slideCount} = CTA (oppfordring til handling).
Hver slide skal ha unikt innhold som bygger på forrige.` : '')

      const textGenStart = Date.now()
      const textResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://some.aiagenten.no',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: filledPrompt }
          ],
          temperature: 0.8,
          max_tokens: 2000,
        }),
      })

      if (!textResponse.ok) {
        const errText = await textResponse.text()
        console.error('OpenRouter error:', errText)
        logUsage({ org_id, type: 'text_generation', provider: 'openrouter', model: 'google/gemini-2.0-flash-001', success: false, duration_ms: Date.now() - textGenStart })
        return NextResponse.json(
          { error: 'Failed to generate text content' },
          { status: 500 }
        )
      }

      const textData = await textResponse.json()
      logUsage({ org_id, type: 'text_generation', provider: 'openrouter', model: 'google/gemini-2.0-flash-001', success: true, duration_ms: Date.now() - textGenStart, cost_estimate: 0.003 })
      const fullText = textData.choices?.[0]?.message?.content || ''

      // Parse structured JSON response
      try {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          // Fix literal newlines inside JSON string values before parsing
          const fixedJson = jsonMatch[0]
            .replace(/("(?:[^"\\]|\\.)*")|[\n\r]/g, (_match: string, strGroup: string) => {
              if (strGroup) return strGroup // inside a string — keep as-is (already escaped)
              return ' ' // outside strings — replace newlines with space
            })
            // Also fix unescaped newlines inside string values by a simpler approach
            .replace(/"text"\s*:\s*"([\s\S]*?)(?<!\\)",/g, (_: string, txt: string) =>
              `"text": "${txt.replace(/\n/g, '\\n').replace(/\r/g, '')}",`
            )

          let parsed: Record<string, unknown> = {}
          try {
            parsed = JSON.parse(fixedJson)
          } catch {
            // More aggressive fix: extract fields with regex
            const textMatch = fullText.match(/"text"\s*:\s*"([\s\S]*?)",\s*"hashtags"/)
            const hashtagsMatch = fullText.match(/"hashtags"\s*:\s*(\[[\s\S]*?\])/)
            const bestTimeMatch = fullText.match(/"best_time"\s*:\s*"([^"]*)"/)
            const imageSuggMatch = fullText.match(/"image_suggestion"\s*:\s*"([^"]*)"/)

            if (textMatch) {
              parsed.text = textMatch[1].replace(/\\n/g, '\n')
              parsed.hashtags = hashtagsMatch ? JSON.parse(hashtagsMatch[1]) : []
              parsed.best_time = bestTimeMatch?.[1] || null
              parsed.image_suggestion = imageSuggMatch?.[1] || null
            }
          }

          if (parsed.text) {
            generatedText = (parsed.text as string)
              .replace(/\\n/g, '\n')
              .split('\n').map(line => line.trimStart()).join('\n')
            generatedCaption = generatedText
            generatedHashtags = (parsed.hashtags as string[]) || []
            bestTime = (parsed.best_time as string) || null
            imageSuggestion = (parsed.image_suggestion as string) || null
            generatedHeadline = (parsed.headline as string) || null
            generatedSubtitle = (parsed.subtitle as string) || null
            generatedCTA = (parsed.cta_text as string) || null
            // Extract carousel slides if present
            if (isCarousel && Array.isArray(parsed.slides)) {
              carouselSlides = parsed.slides.map((s: Record<string, unknown>, i: number) => ({
                slide_index: (s.slide_index as number) ?? i,
                headline: (s.headline as string) || '',
                subtitle: (s.subtitle as string) || '',
                cta_text: (s.cta_text as string) || '',
                text_content: (s.text_content as string) || '',
                image_suggestion: (s.image_suggestion as string) || '',
                image_url: null,
                overlay_image_url: null,
              }))
            }
          } else {
            generatedText = extractCaption(fullText)
            generatedCaption = generatedText
            generatedHashtags = extractHashtags(fullText)
          }
        } else {
          generatedText = extractCaption(fullText)
          generatedCaption = generatedText
          generatedHashtags = extractHashtags(fullText)
        }
      } catch {
        generatedText = extractCaption(fullText)
        generatedCaption = generatedText
        generatedHashtags = extractHashtags(fullText)
      }
    }

    // Generate image via OpenRouter (Nano Banana / GPT Image)
    let imageUrl = null
    let imageError: string | null = null

    if (!regenerate_text && !generate_text_only) {
      // Build image prompt from the generated text context
      const brandColorDesc = brandProfile?.colors?.length
        ? brandProfile.colors
            .filter((c: { hex: string; role: string }) => c.role && c.role !== 'neutral_dark' && c.role !== 'neutral_light')
            .map((c: { hex: string; role: string }) => `${c.role}: ${c.hex}`)
            .join(', ')
        : 'professional, clean colors'

      // Get the active image style from org settings, or use default
      const defaultStylePrompt = `Photorealistic photograph, shot on Canon EOS R5 with 85mm f/1.4 lens. {situation}. Scandinavian setting: white walls, light wood, natural materials. Natural window light, golden hour warmth. Real skin texture, everyday clothing. Candid moment. Subtle film grain. Muted Scandinavian color palette. No text on screens. No watermarks.`

      // Use request style if provided, otherwise fall back to org default
      const styleToUse = image_style_id || activeStyleId
      const activeStyle = imageStyles.find(s => s.id === styleToUse)
      const stylePrompt = activeStyle?.prompt || defaultStylePrompt

      const imageContext = imageSuggestion || generatedText?.substring(0, 200) || topic || 'professional business scene'

      // Replace {situation} placeholder in style prompt
      const styledPrompt = stylePrompt.replace(/\{situation\}/g, imageContext)

      // Fetch style guide images for this org
      const { data: styleGuideImages } = await supabase
        .from('media_assets')
        .select('url')
        .eq('org_id', org_id)
        .eq('is_style_guide', true)
        .limit(3)

      let imageGenPrompt: string
      if (reference_image_url) {
        // Reference image mode — generate similar image in different angle
        imageGenPrompt = `Create an image in the SAME style, with the SAME character(s) and visual feel, but from a DIFFERENT angle or setting.

Style reference: ${styledPrompt}
Brand colors for subtle accent/props: ${brandColorDesc}
Industry: ${brandProfile?.description || 'technology and business'}

IMPORTANT: No text overlays, no UI elements, no logos. Match the style and mood of the reference image closely.`
      } else {
        imageGenPrompt = `${styledPrompt}

Brand colors for subtle accent/props: ${brandColorDesc}
Industry: ${brandProfile?.description || 'technology and business'}

IMPORTANT: No text overlays, no UI elements, no logos.`
      }

      // Add style guide context if available
      if (styleGuideImages?.length && !reference_image_url) {
        imageGenPrompt += `\n\nStyle reference images are provided. Match their visual style, color palette, and mood closely.`
      }

      // Use configured model from org settings, or override from request body
      const selectedImageModel = image_model || configuredImageModel

      try {
        let b64: string | null = null
        let mimeType = 'image/png'
        const imageGenStart = Date.now()

        if (selectedImageModel === 'gpt-image' && OPENAI_API_KEY) {
          // GPT Image 1.5 via OpenAI API
          const size = platform === 'linkedin' ? '1536x1024' : '1024x1024'
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
            logUsage({ org_id, type: 'image_generation', provider: 'openai', model: 'gpt-image-1', success: true, duration_ms: Date.now() - imageGenStart, cost_estimate: 0.04 })
          } else {
            console.error('GPT Image error:', imageResponse.status, await imageResponse.text())
            logUsage({ org_id, type: 'image_generation', provider: 'openai', model: 'gpt-image-1', success: false, duration_ms: Date.now() - imageGenStart })
          }
        } else {
          // Nano Banana (Gemini) via OpenRouter — supports multimodal with reference images
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const messageContent: any[] = []

          // Add reference image if provided
          if (reference_image_url) {
            messageContent.push({
              type: 'image_url',
              image_url: { url: reference_image_url }
            })
          }

          // Add style guide images as reference
          if (styleGuideImages?.length && !reference_image_url) {
            for (const sg of styleGuideImages) {
              messageContent.push({
                type: 'image_url',
                image_url: { url: sg.url }
              })
            }
          }

          // Add the text prompt
          messageContent.push({
            type: 'text',
            text: `Generate an image for a social media post. DO NOT include any text in the image. Just the photograph.\n\n${imageGenPrompt}`
          })

          const imageResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://some.aiagenten.no',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image',
              messages: [
                {
                  role: 'user',
                  content: messageContent,
                }
              ],
            }),
          })

          if (imageResponse.ok) {
            const imageData = await imageResponse.json()
            const message = imageData.choices?.[0]?.message

            // OpenRouter returns images in message.images array (separate from content)
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
            logUsage({ org_id, type: 'image_generation', provider: 'gemini', model: 'google/gemini-2.5-flash-image', success: true, duration_ms: Date.now() - imageGenStart, cost_estimate: 0.02 })
          } else {
            const errText = await imageResponse.text()
            console.error('Nano Banana error:', imageResponse.status, errText)
            imageError = `Nano Banana ${imageResponse.status}: ${errText.substring(0, 200)}`
            logUsage({ org_id, type: 'image_generation', provider: 'gemini', model: 'google/gemini-2.5-flash-image', success: false, duration_ms: Date.now() - imageGenStart })
          }
        }

        // Upload base64 image to Supabase
        if (b64 && !imageUrl) {
          const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
          const fileName = `generated/${org_id}/${Date.now()}.${ext}`
          const buffer = Buffer.from(b64, 'base64')

          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('post-images')
            .upload(fileName, buffer, { contentType: mimeType, upsert: false })

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
          } else {
            console.error('Image upload error:', uploadError)
            imageError = `Upload error: ${uploadError.message}`
          }
        }
      } catch (imgErr) {
        console.error('Image generation error:', imgErr)
        imageError = `Exception: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`
      }
    }

    // Carousel: generate images for each slide in parallel
    if (isCarousel && carouselSlides && !regenerate_text && !generate_text_only && typeof carousel_slide_index !== 'number') {
      const brandColorDesc = brandProfile?.colors?.length
        ? brandProfile.colors
            .filter((c: { hex: string; role: string }) => c.role && c.role !== 'neutral_dark' && c.role !== 'neutral_light')
            .map((c: { hex: string; role: string }) => `${c.role}: ${c.hex}`)
            .join(', ')
        : 'professional, clean colors'

      const defaultStylePrompt = `Photorealistic photograph, shot on Canon EOS R5 with 85mm f/1.4 lens. {situation}. Scandinavian setting: white walls, light wood, natural materials. Natural window light, golden hour warmth. Real skin texture, everyday clothing. Candid moment. Subtle film grain. Muted Scandinavian color palette. No text on screens. No watermarks.`
      const styleToUse = image_style_id || activeStyleId
      const activeStyle = imageStyles.find(s => s.id === styleToUse)
      const stylePrompt = activeStyle?.prompt || defaultStylePrompt
      const selectedImageModel = image_model || configuredImageModel

      // Generate images for all slides concurrently
      const slideImagePromises = carouselSlides.map(async (slide, idx) => {
        try {
          const slideContext = slide.image_suggestion || slide.text_content || slide.headline || `Slide ${idx + 1} of carousel`
          const styledPrompt = stylePrompt.replace(/\{situation\}/g, slideContext)
          const slideImagePrompt = `${styledPrompt}\n\nBrand colors for subtle accent/props: ${brandColorDesc}\nIndustry: ${brandProfile?.description || 'technology and business'}\n\nIMPORTANT: No text overlays, no UI elements, no logos. This is slide ${idx + 1} of ${carouselSlides!.length} in a cohesive carousel — keep a consistent visual style across all slides.`

          let b64: string | null = null
          let mimeType = 'image/png'
          let slideImageUrl: string | null = null

          if (selectedImageModel === 'gpt-image' && OPENAI_API_KEY) {
            const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'gpt-image-1', prompt: `${slideImagePrompt}\n\nDO NOT include any text, watermarks, or logos in the image.`, n: 1, size: '1024x1024', quality: 'medium' }),
            })
            if (imageResponse.ok) {
              const imageData = await imageResponse.json()
              b64 = imageData.data?.[0]?.b64_json || null
              if (!b64 && imageData.data?.[0]?.url) slideImageUrl = imageData.data[0].url
            }
          } else {
            const imageResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://some.aiagenten.no' },
              body: JSON.stringify({ model: 'google/gemini-2.5-flash-image', messages: [{ role: 'user', content: [{ type: 'text', text: `Generate an image for a social media post. DO NOT include any text in the image. Just the photograph.\n\n${slideImagePrompt}` }] }] }),
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
                } else if (imgUrl) { slideImageUrl = imgUrl }
              }
              if (!b64 && !slideImageUrl) {
                const content = message?.content
                if (Array.isArray(content)) {
                  for (const part of content) {
                    if (part.type === 'image_url' && part.image_url?.url?.startsWith('data:')) {
                      const match = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
                      if (match) { mimeType = match[1]; b64 = match[2] }
                    } else if (part.type === 'image_url' && part.image_url?.url) {
                      slideImageUrl = part.image_url.url
                    }
                  }
                } else if (typeof content === 'string') {
                  const b64Match = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/)
                  if (b64Match) { mimeType = `image/${b64Match[1]}`; b64 = b64Match[2] }
                }
              }
            }
          }

          // Upload to Supabase
          if (b64 && !slideImageUrl) {
            const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
            const fileName = `generated/${org_id}/${Date.now()}-slide${idx}.${ext}`
            const buffer = Buffer.from(b64, 'base64')
            const { data: uploadData, error: uploadError } = await supabase.storage.from('post-images').upload(fileName, buffer, { contentType: mimeType, upsert: false })
            if (!uploadError && uploadData) {
              const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName)
              slideImageUrl = urlData.publicUrl
            }
          }
          return slideImageUrl
        } catch (err) {
          console.error(`Carousel slide ${idx} image error:`, err)
          return null
        }
      })

      const slideImages = await Promise.all(slideImagePromises)
      for (let i = 0; i < carouselSlides.length; i++) {
        carouselSlides[i].image_url = slideImages[i] || null
      }
      // Use first slide image as the main post image
      imageUrl = slideImages.find(u => u !== null) || imageUrl
    }

    // If text-only mode (for manual uploads), return generated text without saving
    if (generate_text_only) {
      return NextResponse.json({
        success: true,
        generated: {
          text: generatedText,
          caption: generatedCaption,
          headline: generatedHeadline,
          subtitle: generatedSubtitle,
          cta_text: generatedCTA,
          hashtags: generatedHashtags,
          image_url: null,
          image_error: null,
          best_time: bestTime,
          image_suggestion: imageSuggestion,
          carousel_slides: carouselSlides,
        },
      })
    }

    // Auto-schedule: compute suggested_time based on weekly goals + best practices
    let suggestedTime = bestTime
    let scheduledFor: string | null = null
    if (!regenerate_text && !regenerate_image) {
      try {
        const computedTime = await computeSuggestedTime(supabase, org_id, platform, bestTime)
        if (computedTime) {
          suggestedTime = computedTime
          // Parse ISO date from suggested time string like "Tirsdag kl 09:00 (2026-03-25)"
          scheduledFor = parseScheduledFromSuggested(computedTime)
        }
      } catch (err) {
        console.error('Auto-schedule error:', err)
      }
    }

    // Save or update post in social_posts
    let postData
    if (post_id && (regenerate_text || regenerate_image)) {
      // Update existing post
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (generatedText) {
        updates.content_text = generatedText
        updates.caption = generatedCaption
        updates.hashtags = generatedHashtags
        updates.headline = generatedHeadline
        updates.subtitle = generatedSubtitle
        updates.cta_text = generatedCTA
        updates.suggested_time = suggestedTime
        if (scheduledFor) updates.scheduled_for = scheduledFor
      }
      if (imageUrl) {
        updates.content_image_url = imageUrl
      }
      if (selected_overlay) {
        updates.selected_overlay = selected_overlay
      }
      if (carouselSlides) {
        updates.carousel_slides = carouselSlides
        updates.slide_count = carouselSlides.length
      }

      const { data, error } = await supabase
        .from('social_posts')
        .update(updates)
        .eq('id', post_id)
        .select()
        .single()

      if (error) {
        console.error('Update error:', error)
        return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
      }
      postData = data
    } else {
      // Create new draft
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData: any = {
          org_id,
          platform,
          format,
          content_text: generatedText,
          caption: generatedCaption,
          hashtags: generatedHashtags,
          content_image_url: imageUrl,
          headline: generatedHeadline,
          subtitle: generatedSubtitle,
          cta_text: generatedCTA,
          suggested_time: suggestedTime,
          scheduled_for: scheduledFor,
          selected_overlay: selected_overlay || null,
          status: 'draft',
          ai_generated: true,
          ai_prompt: topic || topicText,
      }
      if (carouselSlides) {
        insertData.carousel_slides = carouselSlides
        insertData.slide_count = carouselSlides.length
      }
      const { data, error } = await supabase
        .from('social_posts')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: 'Failed to save post' }, { status: 500 })
      }
      postData = data

      // Log AI generation to audit trail
      await logAudit({
        action: 'post.ai_generated',
        resourceType: 'post',
        resourceId: data?.id,
        resourceTitle: generatedCaption?.substring(0, 80) || topic || 'AI-generert innlegg',
        metadata: { platform, format, has_image: !!imageUrl, topic: topic || topicText },
      }).catch(() => {})
    }

    // Save to image_generations history
    if (imageUrl && postData) {
      await supabase.from('image_generations').insert({
        org_id,
        post_id: postData.id,
        image_url: imageUrl,
        prompt: topic || topicText,
        style_id: image_style_id || activeStyleId,
        reference_image_url: reference_image_url || null,
        is_selected: true,
      }).then(() => {
        // Mark previous generations for this post as not selected
        if (postData.id) {
          supabase.from('image_generations')
            .update({ is_selected: false })
            .eq('post_id', postData.id)
            .neq('image_url', imageUrl)
            .then(() => {})
        }
      })
    }

    return NextResponse.json({
      success: true,
      post: postData,
      generated: {
        text: generatedText,
        caption: generatedCaption,
        headline: generatedHeadline,
        subtitle: generatedSubtitle,
        cta_text: generatedCTA,
        hashtags: generatedHashtags,
        image_url: imageUrl,
        image_error: imageError,
        best_time: suggestedTime || bestTime,
        image_suggestion: imageSuggestion,
        carousel_slides: carouselSlides,
      },
    })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper: extract caption from generated text
function extractCaption(text: string): string {
  // Clean up any remaining AI scaffolding
  const cleaned = text
    // Remove section headers like "**1. Hook:**", "**2. Brødtekst:**", etc.
    .replace(/\*\*\d+\.\s*[^*]+:\*\*/g, '')
    // Remove markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove "Her er et utkast..." preamble
    .replace(/^Her er (et |en |)?(utkast|forslag)[^\n]*\n*/i, '')
    // Remove markdown headers
    .replace(/^#+\s+.*$/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Remove lines that are just labels
    .replace(/^(Hook|Brødtekst|CTA|Innhold|Tekst|Caption|Hashtags?):\s*$/gim, '')
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned.substring(0, 2000)
}

// Helper: extract hashtags from generated text
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\wæøåÆØÅ]+/g
  const matches = text.match(hashtagRegex) || []
  return Array.from(new Set(matches)).slice(0, 15)
}

// Helper: compute optimal suggested time based on weekly goals and best practices
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeSuggestedTime(supabase: any, orgId: string, platform: string, aiBestTime: string | null): Promise<string | null> {
  // Fetch weekly goal for this platform
  const { data: goal } = await supabase
    .from('weekly_posting_goals')
    .select('weekly_target')
    .eq('org_id', orgId)
    .eq('platform', platform)
    .single()

  const weeklyTarget = goal?.weekly_target || 3

  // Get current week boundaries (Monday to Sunday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  // Count existing posts this week for this platform
  const { count } = await supabase
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('platform', platform)
    .in('status', ['approved', 'scheduled', 'published', 'draft'])
    .gte('created_at', monday.toISOString())
    .lte('created_at', sunday.toISOString())

  const postsThisWeek = count || 0

  // Get scheduled times this week to find gaps
  const { data: scheduledPosts } = await supabase
    .from('social_posts')
    .select('scheduled_for')
    .eq('org_id', orgId)
    .eq('platform', platform)
    .not('scheduled_for', 'is', null)
    .gte('scheduled_for', monday.toISOString())
    .lte('scheduled_for', sunday.toISOString())

  const scheduledDates = new Set(
    (scheduledPosts || []).map((p: { scheduled_for: string }) => p.scheduled_for.slice(0, 10))
  )

  // Best posting hours by platform
  const bestHours: Record<string, number[]> = {
    instagram: [8, 9, 12, 17, 18],
    linkedin: [8, 9, 10, 12],
    facebook: [9, 12, 15, 18],
  }
  const hours = bestHours[platform] || bestHours.instagram

  // Distribute posts evenly across the week
  const remainingSlots = Math.max(0, weeklyTarget - postsThisWeek)
  if (remainingSlots <= 0) {
    return aiBestTime || null
  }

  // Find next available day (prefer Tue-Thu for most platforms)
  const preferredDays = [2, 3, 4, 1, 5] // Tue, Wed, Thu, Mon, Fri
  const daysNorsk = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']

  for (const dayNum of preferredDays) {
    const candidateDate = new Date(monday)
    candidateDate.setDate(monday.getDate() + (dayNum - 1))

    // Skip past days
    if (candidateDate < now && candidateDate.toDateString() !== now.toDateString()) continue

    const candidateKey = `${candidateDate.getFullYear()}-${String(candidateDate.getMonth() + 1).padStart(2, '0')}-${String(candidateDate.getDate()).padStart(2, '0')}`

    if (!scheduledDates.has(candidateKey)) {
      const hour = hours[Math.floor(Math.random() * hours.length)]
      const dayName = daysNorsk[candidateDate.getDay()]
      return `${dayName} kl ${String(hour).padStart(2, '0')}:00 (${candidateKey})`
    }
  }

  return aiBestTime || null
}

// Helper: parse ISO timestamp from suggested time strings
// Handles "Tirsdag kl 09:00 (2026-03-25)" → "2026-03-25T09:00:00.000Z"
// Also handles day-range format "Tirsdag-torsdag kl 08-10" by computing next matching date
function parseScheduledFromSuggested(timeStr: string): string | null {
  // Try explicit date format: "Dag kl HH:MM (YYYY-MM-DD)"
  const explicitMatch = timeStr.match(/\((\d{4}-\d{2}-\d{2})\)/)
  const timeMatch = timeStr.match(/kl\s*(\d{1,2}):?(\d{2})?/)
  if (explicitMatch) {
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '09'
    const min = timeMatch?.[2] || '00'
    return `${explicitMatch[1]}T${hour}:${min}:00.000Z`
  }
  // Parse day name: "Tirsdag kl 08" or "Tirsdag-torsdag kl 08-10"
  const dayMap: Record<string, number> = { søndag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6 }
  const dayMatch = timeStr.match(/(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)/i)
  const hourRangeMatch = timeStr.match(/kl\s*(\d{1,2})/)
  if (dayMatch && hourRangeMatch) {
    const targetDay = dayMap[dayMatch[1].toLowerCase()]
    const hour = hourRangeMatch[1].padStart(2, '0')
    if (targetDay !== undefined) {
      const now = new Date()
      const currentDay = now.getDay()
      let daysAhead = targetDay - currentDay
      if (daysAhead <= 0) daysAhead += 7
      const target = new Date(now)
      target.setDate(now.getDate() + daysAhead)
      const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
      return `${dateStr}T${hour}:00:00.000Z`
    }
  }
  return null
}
