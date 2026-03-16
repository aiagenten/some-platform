import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GRAPH_API_VERSION = 'v19.0'

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
        // LinkedIn placeholder — requires separate OAuth app
        return NextResponse.json({
          posts: [],
          platform: 'linkedin',
          message: 'LinkedIn-integrasjon er ikke tilgjengelig ennå. Krever egen OAuth-app.',
        })
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
