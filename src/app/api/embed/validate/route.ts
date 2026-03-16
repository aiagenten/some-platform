import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { token, type } = await request.json()

    if (!token || !type) {
      return NextResponse.json(
        { error: 'Missing token or type' },
        { status: 400 }
      )
    }

    const validTypes = ['calendar', 'approval', 'feed']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid widget type' },
        { status: 400 }
      )
    }

    // Look up the embed token
    const supabaseAdmin = getSupabaseAdmin()
    const { data: embedToken, error } = await supabaseAdmin
      .from('embed_tokens')
      .select('id, org_id, allowed_origins, permissions, expires_at, active')
      .eq('token', token)
      .eq('active', true)
      .single()

    if (error || !embedToken) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Check expiry
    if (embedToken.expires_at && new Date(embedToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      )
    }

    // Check origin
    const origin = request.headers.get('origin') || ''
    const allowedOrigins: string[] = embedToken.allowed_origins || []

    if (allowedOrigins.length > 0 && origin) {
      const isAllowed = allowedOrigins.some(
        (allowed) =>
          allowed === '*' ||
          allowed === origin ||
          (allowed.startsWith('*.') &&
            origin.endsWith(allowed.slice(1)))
      )
      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Origin not allowed' },
          { status: 403 }
        )
      }
    }

    // Check permissions for approval type
    if (type === 'approval' && !embedToken.permissions?.approve) {
      return NextResponse.json(
        { error: 'Insufficient permissions for approval widget' },
        { status: 403 }
      )
    }

    // Build CORS headers
    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    return NextResponse.json(
      {
        valid: true,
        org_id: embedToken.org_id,
        permissions: embedToken.permissions,
      },
      { headers: responseHeaders }
    )
  } catch (err) {
    console.error('Embed validate error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*'
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
