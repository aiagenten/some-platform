import { NextRequest, NextResponse } from 'next/server'

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://some.aiagenten.no'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?error=${encodeURIComponent(error)}`)
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?error=missing_code`)
  }

  let orgId: string
  let redirectTo: string
  try {
    const stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString())
    orgId = stateData.org_id
    redirectTo = stateData.redirect_to || 'settings'
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?error=invalid_state`)
  }

  const redirectUri = `${APP_URL}/api/auth/facebook/callback`

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Facebook token error:', tokenData.error)
      const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
      return NextResponse.redirect(`${APP_URL}${errRedirect}?error=token_exchange_failed`)
    }

    const shortLivedToken = tokenData.access_token

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    )
    const longLivedData = await longLivedRes.json()

    if (longLivedData.error) {
      console.error('Long-lived token error:', longLivedData.error)
      const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
      return NextResponse.redirect(`${APP_URL}${errRedirect}?error=long_lived_token_failed`)
    }

    const longLivedToken = longLivedData.access_token
    const expiresIn = longLivedData.expires_in || 5184000 // 60 days default

    // Get user's pages (Page Access Tokens)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}`
    )
    const pagesData = await pagesRes.json()

    if (pagesData.error) {
      console.error('Pages error:', pagesData.error)
      const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
      return NextResponse.redirect(`${APP_URL}${errRedirect}?error=pages_fetch_failed`)
    }

    // Import admin client to store tokens
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    const pages = pagesData.data || []
    const tokenSecret = process.env.TOKEN_ENCRYPTION_SECRET || 'default-encryption-key'

    const connectedAccounts: { platform: string; account_id: string; name: string; access_token: string; facebook_page_id?: string }[] = []

    for (const page of pages) {
      // Store Facebook Page
      await supabase.rpc('upsert_social_account', {
        p_org_id: orgId,
        p_platform: 'facebook',
        p_account_id: page.id,
        p_account_name: page.name,
        p_access_token: page.access_token,
        p_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        p_token_secret: tokenSecret,
        p_scopes: ['pages_show_list', 'pages_read_engagement'],
        p_metadata: JSON.stringify({ page_id: page.id, page_name: page.name }),
      })

      connectedAccounts.push({
        platform: 'facebook',
        account_id: page.id,
        name: page.name,
        access_token: page.access_token,
      })

      // If page has Instagram Business Account, store that too
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        await supabase.rpc('upsert_social_account', {
          p_org_id: orgId,
          p_platform: 'instagram',
          p_account_id: ig.id,
          p_account_name: ig.username || page.name,
          p_access_token: page.access_token,
          p_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          p_token_secret: tokenSecret,
          p_scopes: ['instagram_basic', 'instagram_content_publish'],
          p_metadata: JSON.stringify({
            ig_user_id: ig.id,
            ig_username: ig.username,
            ig_profile_picture: ig.profile_picture_url,
            facebook_page_id: page.id,
            facebook_page_name: page.name,
          }),
        })

        connectedAccounts.push({
          platform: 'instagram',
          account_id: ig.id,
          name: ig.username || page.name,
          access_token: page.access_token,
          facebook_page_id: page.id,
        })
      }
    }

    // Store long-lived user token for refresh purposes
    await supabase.rpc('upsert_social_account', {
      p_org_id: orgId,
      p_platform: 'facebook',
      p_account_id: `user_${orgId}`,
      p_account_name: 'Facebook User Token',
      p_access_token: longLivedToken,
      p_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      p_token_secret: tokenSecret,
      p_scopes: ['pages_show_list', 'business_management'],
      p_metadata: JSON.stringify({ type: 'user_token', for_refresh: true }),
    })

    // Redirect based on context
    if (redirectTo === 'onboarding') {
      // Encode connected accounts info so onboarding page can fetch posts
      const accountsParam = encodeURIComponent(JSON.stringify(connectedAccounts))
      return NextResponse.redirect(`${APP_URL}/onboarding?fb_connected=true&accounts=${accountsParam}&pages=${pages.length}`)
    }

    return NextResponse.redirect(`${APP_URL}/dashboard/settings?success=connected&pages=${pages.length}`)
  } catch (err) {
    console.error('Facebook OAuth error:', err)
    const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
    return NextResponse.redirect(`${APP_URL}${errRedirect}?error=unknown_error`)
  }
}
