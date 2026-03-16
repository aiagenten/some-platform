import { NextRequest, NextResponse } from 'next/server'

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://some.aiagenten.no'

// Step 1: Redirect to LinkedIn OAuth
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  if (!LINKEDIN_CLIENT_ID) {
    return NextResponse.json({ error: 'LinkedIn client ID not configured' }, { status: 500 })
  }

  const redirectUri = `${APP_URL}/api/auth/linkedin/callback`
  const scopes = [
    'openid',
    'profile',
    'email',
    'w_member_social',
    'r_organization_social',
    'rw_organization_admin',
  ].join(' ')

  // Pass org_id and redirect_to through state parameter
  const orgId = searchParams.get('org_id') || ''
  const redirectTo = searchParams.get('redirect_to') || 'settings'
  const state = Buffer.from(JSON.stringify({ org_id: orgId, redirect_to: redirectTo })).toString('base64')

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
