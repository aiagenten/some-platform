import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || ''

function getRedirectUri(request: NextRequest) {
  const origin = new URL(request.url).origin
  return `${origin}/api/auth/google-drive`
}

// Step 1: Start OAuth flow (GET without code param)
// Step 2: Handle callback (GET with code param)
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

  // Step 1: Redirect to Google OAuth
  if (!code) {
    const userId = searchParams.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ].join(' ')

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(request),
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: userId,
    })

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  // Step 2: Exchange code for tokens
  if (!state) {
    return NextResponse.json({ error: 'Missing state (user_id)' }, { status: 400 })
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(request),
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('Google token exchange failed:', err)
      return NextResponse.redirect(
        new URL('/dashboard/settings?drive_error=token_exchange_failed', request.url)
      )
    }

    const tokens = await tokenRes.json()

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {}

    // Store in DB — using social_accounts table with metadata
    const supabase = getSupabaseAdmin()

    // Get user's org_id
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

    // Upsert connection info — store in social_accounts with platform metadata
    // Using a separate metadata approach since social_accounts has platform enum
    const { error: dbError } = await supabase.rpc('exec_sql', {
      query: `
        INSERT INTO social_accounts (org_id, platform, account_name, account_id, access_token_enc, refresh_token_enc, token_expires_at, metadata)
        VALUES (
          '${user.org_id}',
          'instagram',
          '${(userInfo.email || 'Google Drive').replace("'", "''")}',
          'gdrive_${userInfo.id || 'unknown'}',
          pgp_sym_encrypt('${tokens.access_token}', current_setting('app.token_secret')),
          ${tokens.refresh_token ? `pgp_sym_encrypt('${tokens.refresh_token}', current_setting('app.token_secret'))` : 'NULL'},
          ${tokens.expires_in ? `now() + interval '${tokens.expires_in} seconds'` : 'NULL'},
          '${JSON.stringify({ provider: 'google_drive', email: userInfo.email, name: userInfo.name })}'::jsonb
        )
        ON CONFLICT (org_id, platform, account_id) DO UPDATE SET
          access_token_enc = EXCLUDED.access_token_enc,
          refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, social_accounts.refresh_token_enc),
          token_expires_at = EXCLUDED.token_expires_at,
          metadata = EXCLUDED.metadata,
          updated_at = now()
      `,
    })

    if (dbError) {
      console.error('DB error storing Google Drive tokens:', dbError)
      // Fallback: store in a simpler way
      await supabase.from('social_accounts').upsert(
        {
          org_id: user.org_id,
          platform: 'instagram', // Reusing platform enum — metadata.provider distinguishes
          account_name: userInfo.email || 'Google Drive',
          account_id: `gdrive_${userInfo.id || Date.now()}`,
          metadata: {
            provider: 'google_drive',
            email: userInfo.email,
            name: userInfo.name,
            access_token: tokens.access_token, // Stored as metadata fallback
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
              : null,
          },
        },
        { onConflict: 'org_id,platform,account_id' }
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/settings?drive_connected=google', request.url)
    )
  } catch (err) {
    console.error('Google Drive OAuth error:', err)
    return NextResponse.redirect(
      new URL('/dashboard/settings?drive_error=unknown', request.url)
    )
  }
}
