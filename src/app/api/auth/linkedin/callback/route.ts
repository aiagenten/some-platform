import { NextRequest, NextResponse } from 'next/server'

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://some.aiagenten.no'

const LINKEDIN_HEADERS = {
  'LinkedIn-Version': '202405',
  'X-RestLi-Protocol-Version': '2.0.0',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.error('LinkedIn OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${APP_URL}/dashboard/settings?error=${encodeURIComponent(errorDescription || error)}`
    )
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

  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
    return NextResponse.redirect(`${APP_URL}${errRedirect}?error=linkedin_not_configured`)
  }

  const redirectUri = `${APP_URL}/api/auth/linkedin/callback`

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
    })

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      console.error('LinkedIn token exchange failed:', errorText)
      const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
      return NextResponse.redirect(`${APP_URL}${errRedirect}?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json()
    console.log('LinkedIn token response - scope:', tokenData.scope, 'expires_in:', tokenData.expires_in)
    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in || 5184000
    const refreshToken = tokenData.refresh_token || null

    // Get user info via OpenID Connect
    const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!userInfoRes.ok) {
      console.error('LinkedIn userinfo failed:', await userInfoRes.text())
      const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
      return NextResponse.redirect(`${APP_URL}${errRedirect}?error=userinfo_failed`)
    }

    const userInfo = await userInfoRes.json()
    const tokenSecret = process.env.TOKEN_ENCRYPTION_SECRET || 'default-encryption-key'
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Import admin client
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()

    const connectedAccounts: { platform: string; account_id: string; name: string; access_token: string }[] = []

    // Save personal LinkedIn account
    await supabase.rpc('upsert_social_account', {
      p_org_id: orgId,
      p_platform: 'linkedin',
      p_account_id: `person:${userInfo.sub}`,
      p_account_name: userInfo.name || 'LinkedIn Personal',
      p_access_token: accessToken,
      p_token_expires_at: expiresAt,
      p_token_secret: tokenSecret,
      p_scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      p_metadata: JSON.stringify({
        account_type: 'personal',
        user_id: userInfo.sub,
        email: userInfo.email,
        refresh_token: refreshToken,
      }),
    })

    connectedAccounts.push({
      platform: 'linkedin',
      account_id: `person:${userInfo.sub}`,
      name: userInfo.name || 'LinkedIn Personal',
      access_token: accessToken,
    })

    // Fetch organizations the user administers
    try {
      const orgsRes = await fetch(
        'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...LINKEDIN_HEADERS,
          },
        }
      )

      console.log('LinkedIn organizationAcls response:', orgsRes.status)
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json()
        console.log('LinkedIn orgs found:', JSON.stringify(orgsData).substring(0, 500))
        const elements = orgsData.elements || []

        for (const org of elements) {
          try {
            const organizationUrn = org.organization || org.organizationalTarget
            if (!organizationUrn) continue

            const organizationId = organizationUrn.split(':').pop()

            // Get organization details
            let organizationName = `Organization ${organizationId}`
            let vanityName: string | null = null

            try {
              const orgDetailRes = await fetch(
                `https://api.linkedin.com/rest/organizations/${organizationId}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    ...LINKEDIN_HEADERS,
                  },
                }
              )
              if (orgDetailRes.ok) {
                const orgDetails = await orgDetailRes.json()
                organizationName = orgDetails.localizedName || organizationName
                vanityName = orgDetails.vanityName || null
              }
            } catch (e) {
              console.warn(`Could not fetch org details for ${organizationId}:`, e)
            }

            // Save organization account
            await supabase.rpc('upsert_social_account', {
              p_org_id: orgId,
              p_platform: 'linkedin',
              p_account_id: `organization:${organizationId}`,
              p_account_name: organizationName,
              p_access_token: accessToken,
              p_token_expires_at: expiresAt,
              p_token_secret: tokenSecret,
              p_scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
              p_metadata: JSON.stringify({
                account_type: 'organization',
                organization_urn: organizationUrn,
                organization_id: organizationId,
                vanity_name: vanityName,
                user_id: userInfo.sub,
                refresh_token: refreshToken,
              }),
            })

            connectedAccounts.push({
              platform: 'linkedin',
              account_id: `organization:${organizationId}`,
              name: organizationName,
              access_token: accessToken,
            })
          } catch (orgErr) {
            console.error('Error processing LinkedIn org:', orgErr)
          }
        }
      } else {
        console.warn(
          'Could not fetch LinkedIn organizations:',
          orgsRes.status,
          await orgsRes.text()
        )
      }
    } catch (orgErr) {
      console.warn('Failed to fetch LinkedIn organizations:', orgErr)
    }

    // Redirect based on context
    if (redirectTo === 'onboarding') {
      const accountsParam = encodeURIComponent(JSON.stringify(connectedAccounts))
      return NextResponse.redirect(
        `${APP_URL}/onboarding?li_connected=true&accounts=${accountsParam}`
      )
    }

    return NextResponse.redirect(
      `${APP_URL}/dashboard/settings?success=linkedin_connected&accounts=${connectedAccounts.length}`
    )
  } catch (err) {
    console.error('LinkedIn OAuth error:', err)
    const errRedirect = redirectTo === 'onboarding' ? '/onboarding' : '/dashboard/settings'
    return NextResponse.redirect(
      `${APP_URL}${errRedirect}?error=${encodeURIComponent(err instanceof Error ? err.message : 'unknown_error')}`
    )
  }
}
