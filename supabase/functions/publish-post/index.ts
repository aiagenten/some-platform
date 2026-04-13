// Supabase Edge Function: publish-post
// Publishes a social_post to Facebook or Instagram via Graph API
// NEVER publish from frontend — only via this Edge Function
//
// Key learnings:
// - Use Page Access Token (NOT User Access Token) for publishing
// - IG carousel and reels have different endpoints
// - Rate limit: 200 calls/user/hour
// - LinkedIn: TODO — placeholder for now

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_SECRET = Deno.env.get('TOKEN_ENCRYPTION_SECRET') || 'default-encryption-key'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  try {
    const { post_id } = await req.json()

    if (!post_id) {
      return new Response(JSON.stringify({ error: 'post_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch post with full details
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .single()

    if (postError || !post) {
      return errorResponse('Post not found', 404)
    }

    // Find social account for this platform + org
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('id, platform, account_id, metadata')
      .eq('org_id', post.org_id)
      .eq('platform', post.platform)

    // Filter out user tokens (for_refresh)
    const publishAccount = accounts?.find(
      (a: any) => !(a.metadata as any)?.for_refresh
    )

    if (!publishAccount) {
      await failPost(post_id, post.org_id, 'No connected account found for ' + post.platform)
      return errorResponse('No social account connected for ' + post.platform, 400)
    }

    // Decrypt access token
    const { data: tokenData } = await supabase.rpc('decrypt_social_token', {
      p_account_id: publishAccount.id,
      p_token_secret: TOKEN_SECRET,
    })

    if (!tokenData) {
      await failPost(post_id, post.org_id, 'Failed to decrypt access token')
      return errorResponse('Failed to decrypt token', 500)
    }

    const accessToken = tokenData as string
    let result: any

    try {
      switch (post.platform) {
        case 'facebook':
          result = await publishToFacebook(post, publishAccount, accessToken)
          break
        case 'instagram':
          result = await publishToInstagram(post, publishAccount, accessToken)
          break
        case 'linkedin':
          // TODO: Implement LinkedIn publishing
          // LinkedIn uses a different OAuth flow and API structure
          // Will need: Organization URN, ugcPosts endpoint, media upload
          await failPost(post_id, post.org_id, 'LinkedIn publishing not yet implemented')
          return errorResponse('LinkedIn publishing coming soon (TODO)', 501)
        default:
          await failPost(post_id, post.org_id, 'Unsupported platform: ' + post.platform)
          return errorResponse('Unsupported platform', 400)
      }
    } catch (publishError: any) {
      await failPost(post_id, post.org_id, publishError.message || 'Publishing failed')
      return errorResponse(publishError.message || 'Publishing failed', 500)
    }

    // Success — update post
    const platformPostId = result.id || result.post_id || null
    await supabase
      .from('social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_id: platformPostId,
        platform_post_id: platformPostId,
      })
      .eq('id', post_id)

    // Log success
    await supabase.rpc('log_publish_event', {
      p_org_id: post.org_id,
      p_post_id: post_id,
      p_action: 'published',
      p_details: JSON.stringify({
        platform: post.platform,
        published_id: result.id || result.post_id,
        account: publishAccount.account_id,
      }),
    })

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('publish-post error:', err)
    return errorResponse(err.message || 'Internal error', 500)
  }
})

// ============================================================
// FACEBOOK PUBLISHING
// Uses Page Access Token (NOT User Access Token)
// ============================================================

async function publishToFacebook(
  post: any,
  account: any,
  accessToken: string
): Promise<any> {
  const pageId = account.account_id
  const text = post.caption || post.content_text || ''

  // If post has an image, publish as photo
  if (post.content_image_url) {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: post.content_image_url,
          message: text,
          access_token: accessToken,
        }),
      }
    )

    const data = await res.json()
    if (data.error) {
      throw new Error(`Facebook API: ${data.error.message}`)
    }
    return data
  }

  // Text-only post
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        access_token: accessToken,
      }),
    }
  )

  const data = await res.json()
  if (data.error) {
    throw new Error(`Facebook API: ${data.error.message}`)
  }
  return data
}

// ============================================================
// INSTAGRAM PUBLISHING
// Uses Page Access Token for IG Business Account
// Flow: Create Container → Publish
// Carousel: Create children → Create carousel container → Publish
// ============================================================

async function publishToInstagram(
  post: any,
  account: any,
  accessToken: string
): Promise<any> {
  const meta = account.metadata as any
  const igUserId = meta?.ig_user_id || account.account_id
  const caption = post.caption || post.content_text || ''

  // Determine if carousel
  const isCarousel = post.format === 'carousel' && post.media_urls?.length > 1

  if (isCarousel) {
    return await publishIGCarousel(igUserId, accessToken, caption, post.media_urls)
  }

  // Single image/video post
  if (post.content_image_url) {
    return await publishIGSingleImage(igUserId, accessToken, caption, post.content_image_url)
  }

  // Reels have different endpoint
  if (post.format === 'reel' && post.content_video_url) {
    return await publishIGReel(igUserId, accessToken, caption, post.content_video_url)
  }

  throw new Error('Instagram requires at least an image or video')
}

async function publishIGSingleImage(
  igUserId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<any> {
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  )
  const container = await containerRes.json()
  if (container.error) {
    throw new Error(`IG Container: ${container.error.message}`)
  }

  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        share_to_feed: true,
        access_token: accessToken,
      }),
    }
  )
  const published = await publishRes.json()
  if (published.error) {
    console.error('IG Publish failed:', JSON.stringify(published.error))
    throw new Error(`IG Publish: ${published.error.message}`)
  }
  return published
}

async function publishIGCarousel(
  igUserId: string,
  accessToken: string,
  caption: string,
  mediaUrls: string[]
): Promise<any> {
  // Step 1: Create child containers (no caption on children)
  const childIds: string[] = []
  for (const url of mediaUrls) {
    const childRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: url,
          is_carousel_item: true,
          access_token: accessToken,
        }),
      }
    )
    const child = await childRes.json()
    if (child.error) {
      throw new Error(`IG Carousel Child: ${child.error.message}`)
    }
    childIds.push(child.id)
  }

  // Step 2: Create carousel container
  const carouselRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        caption,
        children: childIds,
        access_token: accessToken,
      }),
    }
  )
  const carousel = await carouselRes.json()
  if (carousel.error) {
    throw new Error(`IG Carousel Container: ${carousel.error.message}`)
  }

  // Step 3: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carousel.id,
        share_to_feed: true,
        access_token: accessToken,
      }),
    }
  )
  const published = await publishRes.json()
  if (published.error) {
    console.error('IG Carousel Publish failed:', JSON.stringify(published.error))
    throw new Error(`IG Carousel Publish: ${published.error.message}`)
  }
  return published
}

async function publishIGReel(
  igUserId: string,
  accessToken: string,
  caption: string,
  videoUrl: string
): Promise<any> {
  // Reels use media_type: REELS
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: accessToken,
      }),
    }
  )
  const container = await containerRes.json()
  if (container.error) {
    throw new Error(`IG Reel Container: ${container.error.message}`)
  }

  // Wait for video processing (poll status)
  let status = 'IN_PROGRESS'
  let attempts = 0
  while (status === 'IN_PROGRESS' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000))
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${container.id}?fields=status_code&access_token=${accessToken}`
    )
    const statusData = await statusRes.json()
    status = statusData.status_code || 'FINISHED'
    attempts++
  }

  if (status === 'ERROR') {
    throw new Error('Reel processing failed')
  }

  // Grace delay after FINISHED — some Business accounts need a moment
  await new Promise((r) => setTimeout(r, 3000))

  // Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        share_to_feed: true,
        access_token: accessToken,
      }),
    }
  )
  const published = await publishRes.json()
  if (published.error) {
    console.error('IG Reel Publish failed:', JSON.stringify(published.error))
    throw new Error(`IG Reel Publish: ${published.error.message}`)
  }
  return published
}

// ============================================================
// HELPERS
// ============================================================

async function failPost(postId: string, orgId: string, reason: string) {
  // Revert post status to approved + log error
  await supabase
    .from('social_posts')
    .update({ status: 'failed' })
    .eq('id', postId)

  await supabase.rpc('log_publish_event', {
    p_org_id: orgId,
    p_post_id: postId,
    p_action: 'publish_failed',
    p_details: JSON.stringify({ error: reason }),
  })
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
