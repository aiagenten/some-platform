// ── POST /api/articles/generate-image — Featured Image Generation ───────────
// Generates a featured image for an article using fal.ai

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fal } from '@fal-ai/client'

export const maxDuration = 60

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY })
}

export async function POST(request: NextRequest) {
  // ── Auth ──
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { articleId, title } = await request.json()
  if (!articleId || !title) {
    return NextResponse.json({ error: 'articleId and title required' }, { status: 400 })
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'Bildegenerering er ikke konfigurert (mangler FAL_KEY)' }, { status: 500 })
  }

  // ── Fetch brand profile for style ──
  const admin = createAdminClient()
  const { data: brand } = await admin
    .from('brand_profiles')
    .select('colors, visual_style, description, image_prompt_preferences')
    .eq('org_id', profile.org_id)
    .limit(1)
    .single()

  // ── Build image prompt ──
  const colors = brand?.colors || []
  const colorStr = Array.isArray(colors) && colors.length > 0
    ? `Color palette: ${colors.slice(0, 3).join(', ')}.`
    : ''

  const stylePrefs = brand?.image_prompt_preferences as Record<string, string> | null
  const styleStr = stylePrefs?.style || 'modern, professional, clean'

  const prompt = `Professional blog header image for an article titled "${title}". ${colorStr} Style: ${styleStr}. High quality, editorial photography style, suitable as a 16:9 blog featured image. No text overlays, no words, no letters.`

  try {
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1,
      },
    })

    const imageUrl = (result.data as { images?: { url: string }[] })?.images?.[0]?.url

    if (!imageUrl) {
      return NextResponse.json({ error: 'Ingen bilde generert' }, { status: 500 })
    }

    // Save as media asset
    await admin.from('media_assets').insert({
      org_id: profile.org_id,
      source: 'ai_generated',
      url: imageUrl,
      filename: `article-${articleId}-featured.png`,
      mime_type: 'image/png',
      tags: ['article', 'featured', 'ai-generated'],
      metadata: { article_id: articleId, prompt },
    })

    // Update article
    await supabase
      .from('articles')
      .update({ featured_image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', articleId)
      .eq('org_id', profile.org_id)

    return NextResponse.json({ url: imageUrl })
  } catch (err) {
    console.error('[/api/articles/generate-image] error:', err)
    return NextResponse.json({ error: 'Bildegenerering feilet' }, { status: 500 })
  }
}
