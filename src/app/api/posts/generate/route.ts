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
import imagePrompts from '../../../../../content-templates/s4-image-prompts.json'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { org_id, platform, format, topic, regenerate_text, regenerate_image, post_id } = body

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

    // Fetch brand learnings
    const { data: learnings } = await supabase
      .from('brand_learnings')
      .select('learning_text, learning_type')
      .eq('org_id', org_id)
      .eq('is_active', true)
      .order('confidence_score', { ascending: false })
      .limit(10)

    // Build template variables
    const brandName = brandProfile?.description?.split('.')[0] || 'Brand'
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
      ? learnings.map((l) => `- [${l.learning_type}] ${l.learning_text}`).join('\n')
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

    if (!regenerate_image) {
      const textResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://some-platform.aiagenten.no',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'system',
              content: 'Du er en ekspert SoMe-strateg. Svar ALLTID på norsk. Formater svaret tydelig med seksjoner.'
            },
            {
              role: 'user',
              content: filledPrompt
            }
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

      // Parse the generated text — extract caption, hashtags
      generatedText = fullText
      generatedCaption = extractCaption(fullText)
      generatedHashtags = extractHashtags(fullText)
    }

    // Generate image via OpenAI Images API
    let imageUrl = null

    if (!regenerate_text) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
const imagePromptData = (imagePrompts as Record<string, any>)
      const sceneKeys = Object.keys(imagePromptData.scene_variants)
      // Pick a relevant scene based on content or random
      const sceneKey = sceneKeys[Math.floor(Math.random() * sceneKeys.length)]
      const scene = imagePromptData.scene_variants[sceneKey]
      const variants = scene.variants
      const variant = variants[Math.floor(Math.random() * variants.length)]

      // Build image prompt
      const brandColors = brandProfile?.colors?.length
        ? brandProfile.colors.join(' and ')
        : 'muted earthy tones'
      const industry = brandProfile?.description || 'technology'

      let imageGenPrompt = scene.base_prompt
        .replace(/\{brand_colors\}/g, brandColors)
        .replace(/\{industry\}/g, industry)

      if (variant?.addition) {
        imageGenPrompt += ' ' + variant.addition
      }

      // Add global rules
      imageGenPrompt += '\n\nIMPORTANT: ' + imagePromptData.global_rules.always.join('. ') + '.'
      imageGenPrompt += '\n\nNEVER: ' + imagePromptData.global_rules.never.join('. ') + '.'

      // Determine aspect ratio based on platform
      const size = platform === 'linkedin' ? '1536x1024' : '1024x1024'

      try {
        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: imageGenPrompt,
            n: 1,
            size: size,
            quality: 'medium',
          }),
        })

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          // gpt-image-1 returns base64
          const b64 = imageData.data?.[0]?.b64_json
          if (b64) {
            // Upload to Supabase Storage
            const fileName = `generated/${org_id}/${Date.now()}.png`
            const buffer = Buffer.from(b64, 'base64')

            const { data: uploadData, error: uploadError } = await supabase
              .storage
              .from('post-images')
              .upload(fileName, buffer, {
                contentType: 'image/png',
                upsert: false,
              })

            if (!uploadError && uploadData) {
              const { data: urlData } = supabase
                .storage
                .from('post-images')
                .getPublicUrl(fileName)

              imageUrl = urlData.publicUrl
            } else {
              console.error('Upload error:', uploadError)
              // Fallback: use data URL (not ideal for production)
              imageUrl = `data:image/png;base64,${b64.substring(0, 100)}...`
            }
          } else if (imageData.data?.[0]?.url) {
            imageUrl = imageData.data[0].url
          }
        } else {
          const errText = await imageResponse.text()
          console.error('OpenAI Images error:', errText)
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
        hashtags: generatedHashtags,
        image_url: imageUrl,
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
  // Try to find the main text between Hook and CTA/Hashtags
  const lines = text.split('\n').filter(l => l.trim())

  // Remove markdown headers and extract actual content
  const contentLines = lines.filter(l =>
    !l.startsWith('#') &&
    !l.toLowerCase().includes('hashtag') &&
    !l.startsWith('---')
  )

  // Take first meaningful paragraphs
  return contentLines.slice(0, 10).join('\n').substring(0, 2000)
}

// Helper: extract hashtags from generated text
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\wæøåÆØÅ]+/g
  const matches = text.match(hashtagRegex) || []
  return Array.from(new Set(matches)).slice(0, 15)
}
