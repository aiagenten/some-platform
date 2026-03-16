import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const MS_CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID || ''
const MS_CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET || ''
const MS_TENANT = process.env.ONEDRIVE_TENANT || 'common'

function getRedirectUri(request: NextRequest) {
  const origin = new URL(request.url).origin
  return `${origin}/api/auth/onedrive`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user_id
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?drive_error=${encodeURIComponent(error)}`, request.url)
    )
  }

  // Step 1: Redirect to Microsoft OAuth
  if (!code) {
    const userId = searchParams.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const scopes = ['Files.Read', 'Files.Read.All', 'User.Read'].join(' ')
    const params = new URLSearchParams({
      client_id: MS_CLIENT_ID,
      redirect_uri: getRedirectUri(request),
      response_type: 'code',
      scope: scopes,
      state: userId,
      prompt: 'consent',
    })

    return NextResponse.redirect(
      `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params}`
    )
  }

  // Step 2: Exchange code for tokens
  if (!state) {
    return NextResponse.json({ error: 'Missing state (user_id)' }, { status: 400 })
  }

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: getRedirectUri(request),
        }),
      }
    )

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Microsoft token exchange failed:', err)
      return NextResponse.redirect(
        new URL('/dashboard/settings?drive_error=token_exchange_failed', request.url)
      )
    }

    const tokens = await tokenRes.json()

    // Get user info from Microsoft Graph
    const userInfoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {}

    // Store in DB
    const supabase = getSupabaseAdmin()

    const { data: user } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', state)
      .single()

    if (!user) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?drive_error=user_not_found', request.url)
      )
    }

    await supabase.from('social_accounts').upsert(
      {
        org_id: user.org_id,
        platform: 'facebook', // Reusing platform enum — metadata.provider distinguishes
        account_name: userInfo.displayName || userInfo.mail || 'OneDrive',
        account_id: `onedrive_${userInfo.id || Date.now()}`,
        metadata: {
          provider: 'onedrive',
          email: userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.displayName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
        },
      },
      { onConflict: 'org_id,platform,account_id' }
    )

    return NextResponse.redirect(
      new URL('/dashboard/settings?drive_connected=onedrive', request.url)
    )
  } catch (err) {
    console.error('OneDrive OAuth error:', err)
    return NextResponse.redirect(
      new URL('/dashboard/settings?drive_error=unknown', request.url)
    )
  }
}
