import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'

function tiptapToHtml(content: Record<string, unknown> | null): string {
  if (!content) return ''
  try {
    return generateHTML(content as Parameters<typeof generateHTML>[0], [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
    ])
  } catch {
    return ''
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  // Get article
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', profile.org_id)
    .single()
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Get WordPress integration
  const { data: integration } = await supabase
    .from('website_integrations')
    .select('*')
    .eq('org_id', profile.org_id)
    .single()

  if (!integration || integration.platform !== 'wordpress' || !integration.wordpress_url) {
    return NextResponse.json({ error: 'WordPress not configured' }, { status: 400 })
  }

  const htmlContent = tiptapToHtml(article.content)
  const wpUrl = integration.wordpress_url.replace(/\/$/, '')
  const auth = Buffer.from(
    `${integration.wordpress_username}:${integration.wordpress_app_password}`
  ).toString('base64')

  const wpPayload: Record<string, unknown> = {
    title: article.title,
    content: htmlContent,
    status: 'publish',
    excerpt: article.excerpt || '',
  }

  // ── SEO metadata for WordPress (Yoast / Rank Math) ──────────────────────
  const seoMeta: Record<string, string> = {}
  if (article.meta_title) {
    seoMeta['yoast_wpseo_title'] = article.meta_title
    seoMeta['rank_math_title'] = article.meta_title
  }
  if (article.meta_description) {
    seoMeta['yoast_wpseo_metadesc'] = article.meta_description
    seoMeta['rank_math_description'] = article.meta_description
  }
  if (article.target_keyword) {
    seoMeta['yoast_wpseo_focuskw'] = article.target_keyword
    seoMeta['rank_math_focus_keyword'] = article.target_keyword
  }

  // Send SEO meta as WordPress meta fields
  if (Object.keys(seoMeta).length > 0) {
    wpPayload.meta = seoMeta
  }

  // Include Schema.org JSON-LD as custom field if AEO data exists
  if (article.aeo_schema?.schema_json_ld) {
    wpPayload.meta = {
      ...(wpPayload.meta as Record<string, string> || {}),
      seo_schema_json_ld: JSON.stringify(article.aeo_schema.schema_json_ld),
    }
  }

  // If updating existing WP post
  const endpoint = article.wordpress_post_id
    ? `${wpUrl}/wp-json/wp/v2/posts/${article.wordpress_post_id}`
    : `${wpUrl}/wp-json/wp/v2/posts`

  const method = article.wordpress_post_id ? 'PUT' : 'POST'

  try {
    const wpRes = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wpPayload),
    })

    if (!wpRes.ok) {
      const errText = await wpRes.text()
      return NextResponse.json(
        { error: `WordPress error: ${wpRes.status} - ${errText}` },
        { status: 502 }
      )
    }

    const wpData = await wpRes.json()

    // Update article with WP post ID
    await supabase
      .from('articles')
      .update({
        wordpress_post_id: wpData.id,
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      wordpress_post_id: wpData.id,
      wordpress_url: wpData.link,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to publish: ${message}` }, { status: 500 })
  }
}
