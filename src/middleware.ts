import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // Check if user is authenticated for protected routes
  const { pathname } = request.nextUrl

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
