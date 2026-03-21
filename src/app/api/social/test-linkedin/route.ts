import { NextRequest, NextResponse } from 'next/server'

const LINKEDIN_HEADERS = {
  'LinkedIn-Version': '202405',
  'X-RestLi-Protocol-Version': '2.0.0',
}

// Temporary debug endpoint — remove after testing
export async function POST(request: NextRequest) {
  try {
    const { access_token, account_id } = await request.json()
    
    if (!access_token || !account_id) {
      return NextResponse.json({ error: 'Missing access_token or account_id' }, { status: 400 })
    }

    const [accountType, id] = account_id.includes(':') ? account_id.split(':') : ['person', account_id]
    const authorUrn = accountType === 'organization'
      ? `urn:li:organization:${id}`
      : `urn:li:person:${id}`

    // Test 1: Fetch posts
    const postsUrl = new URL('https://api.linkedin.com/rest/posts')
    postsUrl.searchParams.set('author', authorUrn)
    postsUrl.searchParams.set('q', 'author')
    postsUrl.searchParams.set('count', '5')

    const postsRes = await fetch(postsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${access_token}`,
        ...LINKEDIN_HEADERS,
      },
    })

    const postsStatus = postsRes.status
    const postsBody = await postsRes.text()

    // Test 2: Check token info / scopes
    const introRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const introStatus = introRes.status
    const introBody = introRes.ok ? await introRes.json() : await introRes.text()

    // Test 3: Check org admin access
    let orgAdminStatus = 'skipped'
    let orgAdminBody: unknown = null
    if (accountType === 'organization') {
      const orgRes = await fetch(
        `https://api.linkedin.com/rest/organizations/${id}`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            ...LINKEDIN_HEADERS,
          },
        }
      )
      orgAdminStatus = String(orgRes.status)
      orgAdminBody = orgRes.ok ? await orgRes.json() : await orgRes.text()
    }

    return NextResponse.json({
      authorUrn,
      posts: { status: postsStatus, body: postsBody.substring(0, 2000) },
      userinfo: { status: introStatus, body: introBody },
      orgAdmin: { status: orgAdminStatus, body: orgAdminBody },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
