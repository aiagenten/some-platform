import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    // Verify superadmin
    const userSupabase = createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await userSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'aiagenten_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const org_id = searchParams.get('org_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const type = searchParams.get('type')

    const supabase = createAdminClient()

    let query = supabase
      .from('api_usage_log')
      .select('type, provider, model, success, cost_estimate, created_at')

    if (org_id) query = query.eq('org_id', org_id)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to + 'T23:59:59')
    if (type) query = query.eq('type', type)

    query = query.order('created_at', { ascending: false }).limit(10000)

    const { data, error } = await query

    if (error) {
      console.error('Usage query error:', error)
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
    }

    const rows = data || []

    // Aggregate
    const byType: Record<string, { count: number; cost: number; success: number; failed: number }> = {}
    let totalCost = 0
    let totalCalls = 0

    for (const row of rows) {
      const t = row.type
      if (!byType[t]) byType[t] = { count: 0, cost: 0, success: 0, failed: 0 }
      byType[t].count++
      byType[t].cost += Number(row.cost_estimate || 0)
      if (row.success) byType[t].success++
      else byType[t].failed++
      totalCost += Number(row.cost_estimate || 0)
      totalCalls++
    }

    return NextResponse.json({
      total_calls: totalCalls,
      total_cost: Math.round(totalCost * 1000000) / 1000000,
      by_type: byType,
    })
  } catch (err) {
    console.error('Admin usage error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
