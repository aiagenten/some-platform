import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { org_id, platform, account_id, account_name, access_token, metadata } = body

    if (!org_id || !platform || !account_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const tokenSecret = process.env.TOKEN_ENCRYPTION_SECRET || 'default-encryption-key'

    await supabase.rpc('upsert_social_account', {
      p_org_id: org_id,
      p_platform: platform,
      p_account_id: account_id,
      p_account_name: account_name || `${platform} account`,
      p_access_token: access_token || '',
      p_token_expires_at: null,
      p_token_secret: tokenSecret,
      p_scopes: [],
      p_metadata: JSON.stringify(metadata || {}),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Save account error:', err)
    return NextResponse.json({ error: 'Failed to save account' }, { status: 500 })
  }
}
