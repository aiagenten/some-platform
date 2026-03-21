import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LINKEDIN_HEADERS = {
  'LinkedIn-Version': '202405',
  'X-RestLi-Protocol-Version': '2.0.0',
}

/**
 * Fetch LinkedIn organization name by ID.
 * POST { access_token, organization_id }
 * Returns { name, vanity_name, logo_url }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { access_token, organization_id } = await request.json()
    if (!access_token || !organization_id) {
      return NextResponse.json({ error: 'access_token and organization_id required' }, { status: 400 })
    }

    let name = `Bedrift #${organization_id}`
    let vanityName: string | null = null
    let logoUrl: string | null = null

    // Try REST API first
    let res = await fetch(
      `https://api.linkedin.com/rest/organizations/${organization_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          ...LINKEDIN_HEADERS,
        },
      }
    )

    // Fallback to v2 API
    if (!res.ok) {
      res = await fetch(
        `https://api.linkedin.com/v2/organizations/${organization_id}?projection=(localizedName,vanityName,logoV2)`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      )
    }

    if (res.ok) {
      const data = await res.json()
      name = data.localizedName
        || data.name?.localized?.no_NO
        || data.name?.localized?.en_US
        || name
      vanityName = data.vanityName || null
      if (data.logoV2?.original) {
        logoUrl = data.logoV2.original
      }
    }

    return NextResponse.json({ name, vanity_name: vanityName, logo_url: logoUrl })
  } catch (error) {
    console.error('LinkedIn org name error:', error)
    return NextResponse.json({ error: 'Failed to fetch org name' }, { status: 500 })
  }
}
