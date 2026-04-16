// Supabase Edge Function: publish-post
// Publishes a social_post to Facebook, Instagram, or LinkedIn
// NEVER publish from frontend — only via this Edge Function
//
// Key learnings:
// - Use Page Access Token (NOT User Access Token) for FB/IG publishing
// - IG carousel and reels have different endpoints
// - Rate limit: 200 calls/user/hour
// - LinkedIn uses ugcPosts API with binary media upload

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

    // Find social account: prefer explicit social_account_id on post, then is_default per brand_profile/platform, then first match
    let publishAccount: any = null

    if (post.social_account_id) {
      const { data: explicit } = await supabase
        .from('social_accounts')
        .select('id, platform, account_id, metadata')
        .eq('id', post.social_account_id)
        .single()
      publishAccount = explicit
    }

    if (!publishAccount) {
      // Resolve which brand_profile to use for account selection.
      // Order: post.brand_profile_id → org's default brand_profile → none.
      let resolvedBrandProfileId: string | null = post.brand_profile_id || null
      if (!resolvedBrandProfileId) {
        const { data: defaultBp } = await supabase
          .from('brand_profiles')
          .select('id')
          .eq('org_id', post.org_id)
          .eq('is_default', true)
          .maybeSingle()
        if (defaultBp?.id) resolvedBrandProfileId = defaultBp.id
      }

      let query = supabase
        .from('social_accounts')
        .select('id, platform, account_id, metadata, is_default')
        .eq('platform', post.platform)

      let junctionRows: any[] | null = null

      if (resolvedBrandProfileId) {
        const { data: junction } = await supabase
          .from('brand_profile_social_accounts')
          .select('social_account_id, is_default')
          .eq('brand_profile_id', resolvedBrandProfileId)

        if (junction && junction.length > 0) {
          const accountIds = junction.map(j => j.social_account_id)
          query = query.in('id', accountIds)
          junctionRows = junction
        } else {
          // Junction empty — fall back to org-level
          query = query.eq('org_id', post.org_id)
        }
      } else {
        query = query.eq('org_id', post.org_id)
      }

      const { data: accounts } = await query

      const eligible = accounts?.filter(
        (a: any) => !(a.metadata as any)?.for_refresh
      ) || []

      if (junctionRows && junctionRows.length > 0) {
        const defaultAccountId = junctionRows.find(j => j.is_default)?.social_account_id
        publishAccount = eligible.find((a: any) => a.id === defaultAccountId) || eligible[0]
      } else {
        publishAccount = eligible.find((a: any) => a.is_default) || eligible[0]
      }
    }

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
      // Resolve the final image URL: use overlay_image_url only when user
      // actually picked an overlay (selected_overlay set and not 'none').
      // Otherwise the raw content_image_url ships, even if an overlay was
      // composed earlier and never explicitly cleared.
      const useOverlay =
        post.selected_overlay && post.selected_overlay !== 'none'
      const resolvedPost = {
        ...post,
        content_image_url:
          (useOverlay && post.overlay_image_url) || post.content_image_url,
      }

    switch (post.platform) {
        case 'facebook':
          result = await publishToFacebook(resolvedPost, publishAccount, accessToken)
          break
        case 'instagram':
          result = await publishToInstagram(resolvedPost, publishAccount, accessToken)
          break
        case 'linkedin':
          result = await publishToLinkedIn(resolvedPost, publishAccount, accessToken)
          break
        default:
          await failPost(post_id, post.org_id, 'Unsupported platform: ' + post.platform)
          return errorResponse('Unsupported platform', 400)
      }
    } catch (publishError: any) {
      await failPost(post_id, post.org_id, publishError.message || 'Publishing failed')
      return errorResponse(publishError.message || 'Publishing failed', 500)
    }

    // Success — update post (clear retry tracking)
    const platformPostId = result.id || result.post_id || null
    await supabase
      .from('social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_id: platformPostId,
        platform_post_id: platformPostId,
        last_publish_error: null,
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

  // Video > photo > text. Mirrors the working aiagenten-portal flow.
  if (post.content_video_url) {
    // Video upload via /videos endpoint with file_url. Use form-urlencoded —
    // works better in Deno Edge Runtime than JSON for this endpoint.
    // NOTE: do NOT pass `thumb` as a URL — Facebook expects multipart file
    // data and rejects URLs with error #100. Let it auto-generate.
    const params = new URLSearchParams({
      access_token: accessToken,
      file_url: post.content_video_url,
      description: text,
    })

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    )
    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(`Facebook video: ${data.error?.message || JSON.stringify(data)}`)
    }
    return data
  }

  if (post.content_image_url) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/photos`,
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
    if (!res.ok || data.error) {
      throw new Error(`Facebook photo: ${data.error?.message || JSON.stringify(data)}`)
    }
    // Photos return { id, post_id } — prefer post_id for the page post
    return { id: data.post_id || data.id }
  }

  // Text-only
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/feed`,
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
  if (!res.ok || data.error) {
    throw new Error(`Facebook feed: ${data.error?.message || JSON.stringify(data)}`)
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

  // Carousel first (multiple media)
  const isCarousel = post.format === 'carousel' && post.media_urls?.length > 1
  if (isCarousel) {
    return await publishIGCarousel(igUserId, accessToken, caption, post.media_urls)
  }

  // Video / Reels — check BEFORE image so a reel with a cover image
  // doesn't get published as a still photo (matches portal flow)
  if (post.content_video_url) {
    return await publishIGReel(
      igUserId,
      accessToken,
      caption,
      post.content_video_url,
      post.content_image_url || undefined,
    )
  }

  if (post.content_image_url) {
    return await publishIGSingleImage(igUserId, accessToken, caption, post.content_image_url)
  }

  throw new Error('Instagram requires at least an image or video')
}

// Poll a container until it reaches FINISHED or ERROR. Throws on error/timeout.
async function waitForIGContainer(
  containerId: string,
  accessToken: string,
  isVideo: boolean,
): Promise<void> {
  const maxAttempts = isVideo ? 25 : 12     // 25×4s=100s for video, 12×3s=36s for image
  const pollInterval = isVideo ? 4000 : 3000
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval))
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
    )
    const statusData = await statusRes.json()
    if (statusData.status_code === 'FINISHED') {
      // Grace delay — IG sometimes returns FINISHED but media_publish still races
      await new Promise((r) => setTimeout(r, 3000))
      return
    }
    if (statusData.status_code === 'ERROR') {
      throw new Error(`IG container processing failed: ${statusData.status || 'unknown'}`)
    }
  }
  throw new Error('IG container processing timed out')
}

async function publishIGSingleImage(
  igUserId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<any> {
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
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

  await waitForIGContainer(container.id, accessToken, false)

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
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
  const childIds: string[] = []
  for (const url of mediaUrls) {
    const childRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
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

  const carouselRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
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

  await waitForIGContainer(carousel.id, accessToken, false)

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carousel.id,
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
  videoUrl: string,
  coverUrl?: string,
): Promise<any> {
  const containerBody: Record<string, unknown> = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  }
  if (coverUrl) containerBody.cover_url = coverUrl

  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    }
  )
  const container = await containerRes.json()
  if (container.error) {
    throw new Error(`IG Reel Container: ${container.error.message}`)
  }

  await waitForIGContainer(container.id, accessToken, true)

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
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
// LINKEDIN PUBLISHING
// Uses ugcPosts API with binary media upload
// Supports: text-only, image, video (with optional thumbnail)
// ============================================================

async function publishToLinkedIn(
  post: any,
  account: any,
  accessToken: string
): Promise<any> {
  // account_id is stored as "person:SUB" or "organization:ID"
  // Convert to full URN: urn:li:person:SUB or urn:li:organization:ID
  const accountId = account.account_id as string
  let authorUrn: string
  if (accountId.startsWith('person:')) {
    authorUrn = `urn:li:${accountId}`
  } else if (accountId.startsWith('organization:')) {
    authorUrn = `urn:li:${accountId}`
  } else {
    throw new Error(`Unexpected LinkedIn account_id format: ${accountId}`)
  }

  const text = post.caption || post.content_text || ''

  let mediaAsset: string | null = null
  let mediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' = 'NONE'
  let thumbnailAsset: string | null = null

  // Upload media to LinkedIn via the legacy /v2/assets?action=registerUpload
  // endpoint. The newer /v2/images?action=initializeUpload path returns
  // UNAUTHORIZED_INVALID_JWT_FORMAT for OAuth2 access tokens, while the
  // assets endpoint accepts them. Verified against the working
  // aiagenten-portal implementation.
  async function registerAndUpload(
    mediaUrl: string,
    recipe: string,
    mediaType: string
  ): Promise<string> {
    const mediaResponse = await fetch(mediaUrl)
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch ${mediaType}: ${mediaResponse.status}`)
    }
    const mediaBuffer = await mediaResponse.arrayBuffer()

    const registerResponse = await fetch(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202405',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: [recipe],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      }
    )

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text()
      console.error(`LinkedIn register ${mediaType} upload failed:`, errorText)
      throw new Error(`Failed to register ${mediaType} upload: ${errorText}`)
    }

    const registerData = await registerResponse.json()
    const uploadUrl =
      registerData.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl
    const asset = registerData.value.asset

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: mediaBuffer,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload ${mediaType} to LinkedIn`)
    }

    return asset
  }

  if (post.content_video_url) {
    mediaAsset = await registerAndUpload(
      post.content_video_url,
      'urn:li:digitalmediaRecipe:feedshare-video',
      'video'
    )
    mediaCategory = 'VIDEO'

    if (post.content_image_url) {
      try {
        thumbnailAsset = await registerAndUpload(
          post.content_image_url,
          'urn:li:digitalmediaRecipe:feedshare-image',
          'thumbnail'
        )
      } catch (thumbError) {
        console.error('LinkedIn thumbnail upload failed, continuing without:', thumbError)
      }
    }
  } else if (post.content_image_url) {
    mediaAsset = await registerAndUpload(
      post.content_image_url,
      'urn:li:digitalmediaRecipe:feedshare-image',
      'image'
    )
    mediaCategory = 'IMAGE'
  }

  const postContent: any = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: mediaCategory,
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  if (mediaAsset) {
    const mediaEntry: any = {
      status: 'READY',
      media: mediaAsset,
    }
    if (mediaCategory === 'VIDEO' && thumbnailAsset) {
      mediaEntry.thumbnails = [{ url: thumbnailAsset }]
    }
    postContent.specificContent['com.linkedin.ugc.ShareContent'].media = [mediaEntry]
  }

  const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202405',
    },
    body: JSON.stringify(postContent),
  })

  if (!postResponse.ok) {
    const errorText = await postResponse.text()
    console.error('LinkedIn API error:', errorText)
    throw new Error(`LinkedIn API: ${errorText}`)
  }

  const postId = postResponse.headers.get('x-restli-id')
  return { id: postId }
}

// ============================================================
// HELPERS
// ============================================================

async function failPost(postId: string, orgId: string, reason: string) {
  // Read current retry_count to increment it
  const { data: current } = await supabase
    .from('social_posts')
    .select('retry_count')
    .eq('id', postId)
    .single()

  const nextRetryCount = (current?.retry_count ?? 0) + 1

  await supabase
    .from('social_posts')
    .update({
      status: 'failed',
      retry_count: nextRetryCount,
      last_retry_at: new Date().toISOString(),
      last_publish_error: reason.slice(0, 1000), // cap error length
    })
    .eq('id', postId)

  await supabase.rpc('log_publish_event', {
    p_org_id: orgId,
    p_post_id: postId,
    p_action: 'publish_failed',
    p_details: JSON.stringify({ error: reason, retry_count: nextRetryCount }),
  })
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
