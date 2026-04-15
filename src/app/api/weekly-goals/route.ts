import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAccess } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get('org_id')
  const auth = await requireOrgAccess(orgId)
  if (auth instanceof NextResponse) return auth

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('weekly_posting_goals')
    .select('*')
    .eq('org_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { org_id, platform, weekly_target } = body

  if (!org_id || !platform || weekly_target === undefined) {
    return NextResponse.json({ error: 'org_id, platform, weekly_target required' }, { status: 400 })
  }

  const auth = await requireOrgAccess(org_id)
  if (auth instanceof NextResponse) return auth

  const supabase = createAdminClient()

  // Upsert — insert or update on conflict
  const { data, error } = await supabase
    .from('weekly_posting_goals')
    .upsert(
      { org_id: auth.orgId, platform, weekly_target, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,platform' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
