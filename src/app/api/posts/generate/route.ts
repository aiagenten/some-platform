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

    // Fetch org name
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single()

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
            generatedText = (parsed.text as string).replace(/\\n/g, '\n')
            generatedCaption = generatedText
            generatedHashtags = (parsed.hashtags as string[]) || []
            bestTime = (parsed.best_time as string) || null
            imageSuggestion = (parsed.image_suggestion as string) || null
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
