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
      let query = supabase
        .from('social_accounts')
        .select('id, platform, account_id, metadata, is_default')
        .eq('platform', post.platform)

      let junctionRows: any[] | null = null

      // If post has a brand_profile, try junction table first
      if (post.brand_profile_id) {
        const { data: junction } = await supabase
          .from('brand_profile_social_accounts')
          .select('social_account_id, is_default')
          .eq('brand_profile_id', post.brand_profile_id)

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
      // Resolve the final image URL: prefer overlay_image_url (user-composed with overlay)
    // over content_image_url (raw base image)
    const resolvedPost = {
      ...post,
      content_image_url: post.overlay_image_url || post.content_image_url,
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

  // Upload image using LinkedIn's current Images API (v2/images?action=initializeUpload)
  async function uploadLinkedInImage(
    mediaUrl: string,
    mediaType: string
  ): Promise<string> {
    const mediaResponse = await fetch(mediaUrl)
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch ${mediaType}: ${mediaResponse.status}`)
    }
    const mediaBuffer = await mediaResponse.arrayBuffer()

    const initResponse = await fetch(
      'https://api.linkedin.com/v2/images?action=initializeUpload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202405',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          initializeUploadRequest: { owner: authorUrn },
        }),
      }
    )

    if (!initResponse.ok) {
      const errorText = await initResponse.text()
      console.error(`LinkedIn init image upload failed:`, errorText)
      throw new Error(`Failed to register ${mediaType} upload: ${errorText}`)
    }

    const initData = await initResponse.json()
    const uploadUrl = initData.value.uploadUrl
    const imageUrn = initData.value.image

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: mediaBuffer,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload ${mediaType} to LinkedIn`)
    }

    return imageUrn
  }

  // Upload video using LinkedIn's current Videos API (v2/videos?action=initializeUpload)
  async function uploadLinkedInVideo(mediaUrl: string): Promise<string> {
    const mediaResponse = await fetch(mediaUrl)
    if (!mediaResponse.ok) {
      throw new Error(`Failed to fetch video: ${mediaResponse.status}`)
    }
    const mediaBuffer = await mediaResponse.arrayBuffer()
    const fileSize = mediaBuffer.byteLength

    const initResponse = await fetch(
      'https://api.linkedin.com/v2/videos?action=initializeUpload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202405',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          initializeUploadRequest: {
            owner: authorUrn,
            fileSizeBytes: fileSize,
            uploadCaptions: false,
            uploadThumbnail: false,
          },
        }),
      }
    )

    if (!initResponse.ok) {
      const errorText = await initResponse.text()
      console.error('LinkedIn init video upload failed:', errorText)
      throw new Error('Failed to register video upload')
    }

    const initData = await initResponse.json()
    const uploadInstructions = initData.value.uploadInstructions
    const videoUrn = initData.value.video

    // Upload each chunk (usually one for small videos)
    for (const instruction of uploadInstructions) {
      const chunk = mediaBuffer.slice(instruction.firstByte, instruction.lastByte + 1)
      const chunkRes = await fetch(instruction.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      })
      if (!chunkRes.ok) {
        throw new Error(`Failed to upload video chunk`)
      }
    }

    // Finalize upload
    const finalizeRes = await fetch(
      'https://api.linkedin.com/v2/videos?action=finalizeUpload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202405',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: videoUrn,
            uploadToken: initData.value.uploadToken,
            uploadedPartIds: uploadInstructions.map((i: any) => i.eTag).filter(Boolean),
          },
        }),
      }
    )
    if (!finalizeRes.ok) {
      console.error('LinkedIn finalize video upload failed:', await finalizeRes.text())
      // Non-fatal — proceed with the video URN anyway
    }

    return videoUrn
  }

  if (post.content_video_url) {
    mediaAsset = await uploadLinkedInVideo(post.content_video_url)
    mediaCategory = 'VIDEO'

    if (post.content_image_url) {
      try {
        thumbnailAsset = await uploadLinkedInImage(post.content_image_url, 'thumbnail')
      } catch (thumbError) {
        console.error('LinkedIn thumbnail upload failed, continuing without:', thumbError)
      }
    }
  } else if (post.content_image_url) {
    mediaAsset = await uploadLinkedInImage(post.content_image_url, 'image')
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
