import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple image proxy to avoid CORS issues with external CDN images.
 * Usage: /api/proxy-image?url=https://...
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  // Only allow image URLs from known CDNs
  const allowed = [
    'fbcdn.net',
    'cdninstagram.com',
    'scontent',
    'instagram',
    'facebook',
    'licdn.com',
    'linkedin',
    'media.licdn.com',
  ]

  try {
    const parsed = new URL(url)
    if (!allowed.some(domain => parsed.hostname.includes(domain))) {
      return new NextResponse('Domain not allowed', { status: 403 })
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoMeBot/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return new NextResponse('Image fetch failed', { status: res.status })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse('Proxy error', { status: 502 })
  }
}
