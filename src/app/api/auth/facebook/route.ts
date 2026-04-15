import { NextRequest, NextResponse } from 'next/server'

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://some.aiagenten.no'

// Step 1: Redirect to Facebook OAuth
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Build Facebook OAuth URL
  const redirectUri = `${APP_URL}/api/auth/facebook/callback`
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
    'business_management',
  ].join(',')

  // Pass org_id and redirect_to through state parameter
  const orgId = searchParams.get('org_id') || ''
  const redirectTo = searchParams.get('redirect_to') || 'settings'
  const brandProfileId = searchParams.get('brand_profile_id') || ''
  const state = Buffer.from(JSON.stringify({ org_id: orgId, redirect_to: redirectTo, brand_profile_id: brandProfileId })).toString('base64')

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`

  return NextResponse.redirect(authUrl)
}
