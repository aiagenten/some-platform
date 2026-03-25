import { NextRequest, NextResponse } from 'next/server'

// Redirects invite/magic link tokens through our own domain
// to avoid spam filters blocking raw supabase.co URLs
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const type = request.nextUrl.searchParams.get('type') || 'invite'
  const redirectTo = request.nextUrl.searchParams.get('redirect_to') || '/auth/callback'
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'}${redirectTo}`
  )}`

  return NextResponse.redirect(verifyUrl)
}
