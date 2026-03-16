import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Helper to validate token and return org_id
async function validateToken(token: string, origin: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: embedToken } = await supabaseAdmin
    .from('embed_tokens')
    .select('id, org_id, allowed_origins, permissions, expires_at, active')
    .eq('token', token)
    .eq('active', true)
    .single()

  if (!embedToken) return null
  if (embedToken.expires_at && new Date(embedToken.expires_at) < new Date()) return null

  const allowedOrigins: string[] = embedToken.allowed_origins || []
  if (allowedOrigins.length > 0 && origin) {
    const isAllowed = allowedOrigins.some(
      (a) => a === '*' || a === origin || (a.startsWith('*.') && origin.endsWith(a.slice(1)))
    )
    if (!isAllowed) return null
  }

  return embedToken
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const origin = request.headers.get('origin') || ''

  if (!token || !type) {
    return NextResponse.json({ error: 'Missing token or type' }, { status: 400 })
  }

  const embedToken = await validateToken(token, origin)
  if (!embedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = embedToken.org_id
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    let data: unknown = null

    switch (type) {
      case 'calendar': {
        const { data: posts } = await supabaseAdmin
          .from('social_posts')
          .select('id, content_text, caption, platform, format, status, scheduled_for, media_urls, content_image_url')
          .eq('org_id', orgId)
          .not('scheduled_for', 'is', null)
          .in('status', ['approved', 'scheduled', 'published', 'draft', 'pending_approval'])
          .order('scheduled_for', { ascending: true })
          .limit(100)
        data = posts
        break
      }
      case 'approval': {
        if (!embedToken.permissions?.approve) {
          return NextResponse.json({ error: 'No approval permission' }, { status: 403, headers })
        }
        const { data: posts } = await supabaseAdmin
          .from('social_posts')
          .select('id, content_text, caption, platform, format, status, scheduled_for, media_urls, content_image_url, created_at')
          .eq('org_id', orgId)
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false })
          .limit(50)
        data = posts
        break
      }
      case 'feed': {
        const { data: posts } = await supabaseAdmin
          .from('social_posts')
          .select('id, content_text, caption, platform, format, status, published_at, media_urls, content_image_url')
          .eq('org_id', orgId)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(50)
        data = posts
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400, headers })
    }

    return NextResponse.json({ data }, { headers })
  } catch (err) {
    console.error('Embed data error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*'
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
