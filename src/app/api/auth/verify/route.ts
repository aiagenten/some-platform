import { NextRequest, NextResponse } from 'next/server'

// Verifies invite/magic link tokens server-side and redirects with session
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const type = request.nextUrl.searchParams.get('type') || 'invite'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify the token server-side using Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  try {
    // Call Supabase verify endpoint server-side
    const verifyResponse = await fetch(
      `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(siteUrl + '/dashboard')}`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
        },
        redirect: 'manual', // Don't follow redirects
      }
    )

    // Supabase returns 303 with Location header containing the session
    const location = verifyResponse.headers.get('location')

    if (location) {
      // Parse the redirect URL for tokens or errors
      const redirectUrl = new URL(location)
      const hash = redirectUrl.hash.substring(1)
      const hashParams = new URLSearchParams(hash)

      const error = hashParams.get('error')
      if (error) {
        const errorDesc = hashParams.get('error_description') || 'Ukjent feil'
        return NextResponse.redirect(
          new URL(`/auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDesc)}`, siteUrl)
        )
      }

      // If we got tokens, redirect to callback with the hash
      const accessToken = hashParams.get('access_token')
      if (accessToken) {
        // Redirect to our callback page with the tokens in hash
        return NextResponse.redirect(
          new URL(`/auth/callback#${hash}`, siteUrl)
        )
      }

      // If Supabase gave us a code (PKCE flow)
      const code = redirectUrl.searchParams.get('code')
      if (code) {
        return NextResponse.redirect(
          new URL(`/auth/callback?code=${code}`, siteUrl)
        )
      }
    }

    // Fallback: redirect to Supabase verify (old behavior)
    return NextResponse.redirect(
      `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(siteUrl + '/auth/callback')}`
    )
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.redirect(
      new URL(`/auth/callback?error=server_error&error_description=${encodeURIComponent('Kunne ikke verifisere token')}`, siteUrl)
    )
  }
}
