import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const GRAPH_API_VERSION = 'v19.0'

const LINKEDIN_HEADERS = {
  'LinkedIn-Version': '202405',
  'X-RestLi-Protocol-Version': '2.0.0',
}

// Fetch up to 50 posts per platform, limited to the last 12 months
async function fetchFacebookPosts(accessToken: string, accountId: string) {
  const fields = 'message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)'
  const twelveMonthsAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/feed?fields=${fields}&limit=50&since=${twelveMonthsAgo}&access_token=${accessToken}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.error) {
    throw new Error(`Facebook API error: ${data.error.message}`)
  }

  return (data.data || []).map((post: Record<string, unknown>) => ({
    id: post.id,
    text: post.message || '',
    created_at: post.created_time,
    image_url: post.full_picture || null,
    permalink: post.permalink_url || null,
    likes: (post.likes as Record<string, unknown>)?.summary
      ? ((post.likes as Record<string, unknown>).summary as Record<string, unknown>).total_count
      : 0,
    comments: (post.comments as Record<string, unknown>)?.summary
      ? ((post.comments as Record<string, unknown>).summary as Record<string, unknown>).total_count
      : 0,
    shares: (post.shares as Record<string, unknown>)?.count || 0,
    platform: 'facebook',
  }))
}

async function fetchInstagramPosts(accessToken: string, accountId: string) {
  const fields = 'caption,timestamp,media_url,permalink,like_count,comments_count'
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/media?fields=${fields}&limit=50&access_token=${accessToken}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.error) {
    throw new Error(`Instagram API error: ${data.error.message}`)
  }

  return (data.data || []).map((post: Record<string, unknown>) => ({
    id: post.id,
    text: post.caption || '',
    created_at: post.timestamp,
    image_url: post.media_url || null,
    permalink: post.permalink || null,
    likes: post.like_count || 0,
    comments: post.comments_count || 0,
    shares: 0,
    platform: 'instagram',
  }))
}

async function fetchLinkedInPosts(accessToken: string, accountId: string) {
  // accountId format: "person:{id}" or "organization:{id}"
  const [accountType, id] = accountId.includes(':') ? accountId.split(':') : ['person', accountId]

  const authorUrn = accountType === 'organization'
    ? `urn:li:organization:${id}`
    : `urn:li:person:${id}`

  // Try REST API first (newer), then fall back to v2 UGC Posts API
  let elements: Record<string, unknown>[] = []

  // Attempt 1: REST Posts API
  try {
    const url = new URL('https://api.linkedin.com/rest/posts')
    url.searchParams.set('author', authorUrn)
    url.searchParams.set('q', 'author')
    url.searchParams.set('count', '50')
    url.searchParams.set('sortBy', 'LAST_MODIFIED')

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...LINKEDIN_HEADERS,
      },
    })

    if (res.ok) {
      const data = await res.json()
      elements = data.elements || []
      console.log(`LinkedIn REST posts for ${authorUrn}: ${elements.length} posts`)
    } else {
      const errorText = await res.text()
      console.warn(`LinkedIn REST posts API failed for ${authorUrn}: ${res.status}`, errorText.substring(0, 200))
    }
  } catch (e) {
    console.warn('LinkedIn REST posts error:', e)
  }

  // Attempt 2: v2 UGC Posts API (fallback)
  if (elements.length === 0) {
    try {
      const ugcUrl = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=50`
      const ugcRes = await fetch(ugcUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0',
        },
      })

      if (ugcRes.ok) {
        const ugcData = await ugcRes.json()
        elements = ugcData.elements || []
        console.log(`LinkedIn UGC posts for ${authorUrn}: ${elements.length} posts`)
      } else {
        console.warn(`LinkedIn UGC posts API failed for ${authorUrn}: ${ugcRes.status}`)
      }
    } catch (e) {
      console.warn('LinkedIn UGC posts error:', e)
    }
  }

  // Attempt 3: v2 shares API (oldest fallback)
  if (elements.length === 0) {
    try {
      const sharesUrl = `https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(authorUrn)}&count=50`
      const sharesRes = await fetch(sharesUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-RestLi-Protocol-Version': '2.0.0',
        },
      })

      if (sharesRes.ok) {
        const sharesData = await sharesRes.json()
        elements = sharesData.elements || []
        console.log(`LinkedIn shares for ${authorUrn}: ${elements.length} posts`)
      } else {
        console.warn(`LinkedIn shares API failed for ${authorUrn}: ${sharesRes.status}`)
      }
    } catch (e) {
      console.warn('LinkedIn shares error:', e)
    }
  }

  if (elements.length === 0) {
    console.log(`No LinkedIn posts found for ${authorUrn} across all API attempts`)
    return []
  }

  return elements.map((post: Record<string, unknown>) => {
    // Extract text content from the post — handle multiple API formats
    let text = ''

    // REST API format: commentary field
    if (post.commentary) {
      text = post.commentary as string
    }

    // UGC format: specificContent
    if (!text && post.specificContent) {
      const specific = post.specificContent as Record<string, unknown>
      const shareContent = specific['com.linkedin.ugc.ShareContent'] as Record<string, unknown> | undefined
      if (shareContent?.shareCommentary) {
        const commentary = shareContent.shareCommentary as Record<string, unknown>
        text = (commentary.text as string) || ''
      }
    }

    // Shares format: text field in content
    if (!text && post.text) {
      const textObj = post.text as Record<string, unknown>
      text = (textObj.text as string) || ''
    }

    // Extract image if available
    let imageUrl: string | null = null
    if (post.content) {
      const content = post.content as Record<string, unknown>
      // REST format
      const multiImage = content.multiImage as Record<string, unknown> | undefined
      if (multiImage?.images && Array.isArray(multiImage.images) && multiImage.images.length > 0) {
        const firstImg = multiImage.images[0] as Record<string, unknown>
        imageUrl = (firstImg.url as string) || null
      }
      const article = content.article as Record<string, unknown> | undefined
      if (!imageUrl && article?.thumbnail) {
        imageUrl = article.thumbnail as string
      }
    }

    // UGC format images
    if (!imageUrl && post.specificContent) {
      const specific = post.specificContent as Record<string, unknown>
      const shareContent = specific['com.linkedin.ugc.ShareContent'] as Record<string, unknown> | undefined
      const shareMedia = shareContent?.media as Record<string, unknown>[] | undefined
      if (shareMedia && shareMedia.length > 0) {
        const firstMedia = shareMedia[0]
        imageUrl = (firstMedia.thumbnails as Record<string, unknown>[])?.[0]?.url as string || null
      }
    }

    // Shares format images
    if (!imageUrl && post.distribution) {
      // Shares API doesn't have easy image access, skip
    }

    return {
      id: post.id || post.urn || (post as Record<string, unknown>).activity || '',
      text,
      created_at: post.createdAt
        ? new Date(post.createdAt as number).toISOString()
        : post.publishedAt
          ? new Date(post.publishedAt as number).toISOString()
          : post.created
            ? new Date((post.created as Record<string, unknown>).time as number).toISOString()
            : null,
      image_url: imageUrl,
      permalink: post.id
        ? `https://www.linkedin.com/feed/update/${post.id}`
        : null,
      likes: 0,
      comments: 0,
      shares: 0,
      platform: 'linkedin',
    }
  }).filter((post: { text: string; created_at: string | null }) => {
    // Keep posts even without text if they have other content
    if (!post.text || !post.text.trim().length) return false
    // Filter out posts older than 12 months
    if (post.created_at) {
      const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
      if (new Date(post.created_at).getTime() < twelveMonthsAgo) return false
    }
    return true
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, access_token, account_id, org_id } = body

    if (!platform || !access_token || !account_id) {
      return NextResponse.json(
        { error: 'platform, access_token, and account_id are required' },
        { status: 400 }
      )
    }

    let posts: Record<string, unknown>[] = []

    switch (platform) {
      case 'facebook':
        posts = await fetchFacebookPosts(access_token, account_id)
        break
      case 'instagram':
        posts = await fetchInstagramPosts(access_token, account_id)
        break
      case 'linkedin':
        posts = await fetchLinkedInPosts(access_token, account_id)
        break
      default:
        return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 })
    }

    // Sort by engagement (likes + comments + shares) descending, limit to 30
    posts.sort((a, b) => {
      const engA = ((a.likes as number) || 0) + ((a.comments as number) || 0) + ((a.shares as number) || 0)
      const engB = ((b.likes as number) || 0) + ((b.comments as number) || 0) + ((b.shares as number) || 0)
      return engB - engA
    })
    posts = posts.slice(0, 30)

    // Save imported posts to database if org_id is provided
    if (org_id && posts.length > 0) {
      const adminClient = createAdminClient()
      const rows = posts.map((post) => ({
        org_id,
        platform: post.platform as string,
        external_id: post.id as string,
        text_content: (post.text as string) || null,
        image_urls: (post.image_url as string) ? [post.image_url as string] : [],
        permalink: (post.permalink as string) || null,
        likes: (post.likes as number) || 0,
        comments: (post.comments as number) || 0,
        shares: (post.shares as number) || 0,
        posted_at: (post.created_at as string) || null,
      }))

      const { error: upsertError } = await adminClient
        .from('imported_social_posts')
        .upsert(rows, { onConflict: 'org_id,platform,external_id' })

      if (upsertError) {
        console.error('Error saving imported posts:', upsertError)
      }
    }

    return NextResponse.json({
      posts,
      platform,
      count: posts.length,
    })
  } catch (error) {
    console.error('Fetch posts error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
