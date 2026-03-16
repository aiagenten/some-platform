import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // Check if user is authenticated for protected routes
  const { pathname } = request.nextUrl

  // Embed routes are public — skip auth
  if (pathname.startsWith('/embed') || pathname.startsWith('/api/embed')) {
    // Add dynamic CSP frame-ancestors based on embed token
    const headers = new Headers(response.headers)
    headers.set(
      'Content-Security-Policy',
      "frame-ancestors *"
    )
    headers.set('X-Frame-Options', 'ALLOWALL')
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  const protectedRoutes = ['/dashboard', '/onboarding']
  const authRoutes = ['/login', '/signup']

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r))
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r))

  if (isProtected || isAuthRoute) {
    // Check for supabase auth cookie
    const hasSession = request.cookies.getAll().some(c => c.name.includes('auth-token'))

    if (isProtected && !hasSession) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (isAuthRoute && hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
