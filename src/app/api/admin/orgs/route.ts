import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const userSupabase = createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await userSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'aiagenten_admin') return null
  return user
}

export async function GET() {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createAdminClient()

    // Get all orgs
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Orgs query error:', error)
      return NextResponse.json({ error: 'Failed to fetch orgs' }, { status: 500 })
    }

    // Get user counts per org
    const { data: userCounts } = await supabase
      .from('users')
      .select('org_id')

    // Get post counts per org
    const { data: postCounts } = await supabase
      .from('posts')
      .select('org_id')

    // Get usage stats per org (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: usageData } = await supabase
      .from('api_usage_log')
      .select('org_id, cost_estimate')
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Build lookup maps
    const userCountMap: Record<string, number> = {}
    for (const u of userCounts || []) {
      userCountMap[u.org_id] = (userCountMap[u.org_id] || 0) + 1
    }

    const postCountMap: Record<string, number> = {}
    for (const p of postCounts || []) {
      postCountMap[p.org_id] = (postCountMap[p.org_id] || 0) + 1
    }

    const usageCostMap: Record<string, number> = {}
    const usageCallMap: Record<string, number> = {}
    for (const u of usageData || []) {
      usageCostMap[u.org_id] = (usageCostMap[u.org_id] || 0) + Number(u.cost_estimate || 0)
      usageCallMap[u.org_id] = (usageCallMap[u.org_id] || 0) + 1
    }

    const orgsWithStats = (orgs || []).map(org => ({
      ...org,
      user_count: userCountMap[org.id] || 0,
      post_count: postCountMap[org.id] || 0,
      usage_cost_30d: Math.round((usageCostMap[org.id] || 0) * 1000000) / 1000000,
      usage_calls_30d: usageCallMap[org.id] || 0,
    }))

    return NextResponse.json({ orgs: orgsWithStats })
  } catch (err) {
    console.error('Admin orgs GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, slug, industry, website_url } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'name og slug er påkrevd' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Slug er allerede i bruk' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug, industry: industry || null, website_url: website_url || null })
      .select()
      .single()

    if (error) {
      console.error('Org create error:', error)
      return NextResponse.json({ error: 'Kunne ikke opprette organisasjon' }, { status: 500 })
    }

    return NextResponse.json({ org: data }, { status: 201 })
  } catch (err) {
    console.error('Admin orgs POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
