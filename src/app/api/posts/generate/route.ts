import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const { org_id, platform, format, topic, regenerate_text, regenerate_image, post_id, image_model, image_style_id } = body

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

    if (!regenerate_image) {
      const platformRules: Record<string, string> = {
        instagram: `INSTAGRAM-REGLER:
- Tekst: 150-300 ord. Hook i første linje (vises uten "mer"-klikk).
- Emojier: bruk sparsomt og naturlig, aldri på rad.
- Hashtags: IKKE i selve teksten — de returneres separat i "hashtags"-feltet.
- Ingen lenker i teksten (Instagram klikker ikke dem).
- Avslutt med en CTA eller spørsmål.`,
        facebook: `FACEBOOK-REGLER:
- Tekst: 100-250 ord. Kortere innlegg gir bedre rekkevidde i 2024/2025.
- Emojier: tillatt, men ikke overdrev.
- Hashtags: 1-3 maks — Facebook er ikke hashtagdrevet. Returneres separat.
- Lenker fungerer, men begrens til én.
- Personlig og konversasjonelt tone fungerer best.`,
        linkedin: `LINKEDIN-REGLER (2024/2025 best practices):
- Tekst: 150-300 ord. Første linje er avgjørende — vises uten "se mer".
- Struktur: Hook → Verdi/innsikt → Avslutning med spørsmål/refleksjon.
- INGEN emojier i starten av linjer (klisjé på LinkedIn).
- Bruk linjeskift aktivt — korte avsnitt øker lesbarheten.
- Hashtags: maks 3-5 relevante LinkedIn-hashtags. Returneres separat.
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
  "hashtags": ["#hashtag1", "#hashtag2"],
  "best_time": "Tirsdag-torsdag kl 08-10 eller 17-19",
  "image_suggestion": "Kort beskrivelse av hvilket bilde som vil fungere godt"
}`

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
        return NextResponse.json(
          { error: 'Failed to generate text content' },
          { status: 500 }
        )
      }

      const textData = await textResponse.json()
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

    if (!regenerate_text) {
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

      const imageGenPrompt = `${styledPrompt}

Brand colors for subtle accent/props: ${brandColorDesc}
Industry: ${brandProfile?.description || 'technology and business'}

IMPORTANT: No text overlays, no UI elements, no logos.`

      // Use configured model from org settings, or override from request body
      const selectedImageModel = image_model || configuredImageModel

      try {
        let b64: string | null = null
        let mimeType = 'image/png'

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
          } else {
            console.error('GPT Image error:', imageResponse.status, await imageResponse.text())
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
              messages: [
                {
                  role: 'user',
                  content: `Generate an image for a social media post. DO NOT include any text in the image. Just the photograph.\n\n${imageGenPrompt}`
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
          } else {
            console.error('Nano Banana error:', imageResponse.status, await imageResponse.text())
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
          }
        }
      } catch (imgErr) {
        console.error('Image generation error:', imgErr)
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
      }
      if (imageUrl) {
        updates.content_image_url = imageUrl
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
      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          org_id,
          platform,
          format,
          content_text: generatedText,
          caption: generatedCaption,
          hashtags: generatedHashtags,
          content_image_url: imageUrl,
          status: 'draft',
          ai_generated: true,
          ai_prompt: topic || topicText,
        })
        .select()
        .single()

      if (error) {
        console.error('Insert error:', error)
        return NextResponse.json({ error: 'Failed to save post' }, { status: 500 })
      }
      postData = data
    }

    return NextResponse.json({
      success: true,
      post: postData,
      generated: {
        text: generatedText,
        caption: generatedCaption,
        headline: generatedHeadline,
        subtitle: generatedSubtitle,
        hashtags: generatedHashtags,
        image_url: imageUrl,
        best_time: bestTime,
        image_suggestion: imageSuggestion,
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
