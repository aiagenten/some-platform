import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GRAPH_API_VERSION = 'v19.0'

const LINKEDIN_HEADERS = {
  'LinkedIn-Version': '202405',
  'X-RestLi-Protocol-Version': '2.0.0',
}

async function fetchFacebookPosts(accessToken: string, accountId: string) {
  const fields = 'message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)'
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/feed?fields=${fields}&limit=25&access_token=${accessToken}`

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
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/media?fields=${fields}&limit=25&access_token=${accessToken}`

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

  const url = new URL('https://api.linkedin.com/rest/posts')
  url.searchParams.set('author', authorUrn)
  url.searchParams.set('q', 'author')
  url.searchParams.set('count', '25')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...LINKEDIN_HEADERS,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error('LinkedIn posts API error:', res.status, errorText)
    throw new Error(`LinkedIn API error: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  const elements = data.elements || []

  return elements.map((post: Record<string, unknown>) => {
    // Extract text content from the post
    let text = ''

    // LinkedIn posts can have commentary (text content)
    if (post.commentary) {
      text = post.commentary as string
    }

    // Some posts have specificContent with share commentary
    if (!text && post.specificContent) {
      const specific = post.specificContent as Record<string, unknown>
      const shareContent = specific['com.linkedin.ugc.ShareContent'] as Record<string, unknown> | undefined
      if (shareContent?.shareCommentary) {
        const commentary = shareContent.shareCommentary as Record<string, unknown>
        text = (commentary.text as string) || ''
      }
    }

    // Extract image if available
    let imageUrl: string | null = null
    if (post.content) {
      const content = post.content as Record<string, unknown>
      const media = content.media as Record<string, unknown> | undefined
      if (media?.id) {
        // LinkedIn media URLs need to be resolved separately, use thumbnail if available
        imageUrl = null
      }
      // Article shares may have a thumbnail
      const article = content.article as Record<string, unknown> | undefined
      if (article?.thumbnail) {
        imageUrl = article.thumbnail as string
      }
    }

    return {
      id: post.id || post.urn || '',
      text,
      created_at: post.createdAt
        ? new Date(post.createdAt as number).toISOString()
        : post.publishedAt
          ? new Date(post.publishedAt as number).toISOString()
          : null,
      image_url: imageUrl,
      permalink: post.id
        ? `https://www.linkedin.com/feed/update/${post.id}`
        : null,
      likes: 0, // Would need separate social actions API call
      comments: 0,
      shares: 0,
      platform: 'linkedin',
    }
  }).filter((post: { text: string }) => post.text && post.text.trim().length > 0)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, access_token, account_id } = body

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
