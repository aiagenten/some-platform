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
      .select('id, org_id, type, provider, model, success, cost_estimate, duration_ms, created_at')

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

    // Aggregate by type
    const byType: Record<string, { count: number; cost: number; success: number; failed: number }> = {}
    // Aggregate by provider
    const byProvider: Record<string, { count: number; cost: number; success: number; failed: number }> = {}
    // Aggregate by model
    const byModel: Record<string, { count: number; cost: number; provider: string }> = {}
    // Aggregate by org
    const byOrg: Record<string, { count: number; cost: number }> = {}
    // Daily time series (last 30 days)
    const byDay: Record<string, { count: number; cost: number }> = {}

    let totalCost = 0
    let totalCalls = 0

    for (const row of rows) {
      const cost = Number(row.cost_estimate || 0)
      const day = row.created_at.slice(0, 10) // YYYY-MM-DD

      // By type
      const t = row.type || 'unknown'
      if (!byType[t]) byType[t] = { count: 0, cost: 0, success: 0, failed: 0 }
      byType[t].count++
      byType[t].cost += cost
      if (row.success) byType[t].success++
      else byType[t].failed++

      // By provider
      const p = row.provider || 'unknown'
      if (!byProvider[p]) byProvider[p] = { count: 0, cost: 0, success: 0, failed: 0 }
      byProvider[p].count++
      byProvider[p].cost += cost
      if (row.success) byProvider[p].success++
      else byProvider[p].failed++

      // By model
      const m = row.model || 'unknown'
      if (!byModel[m]) byModel[m] = { count: 0, cost: 0, provider: p }
      byModel[m].count++
      byModel[m].cost += cost

      // By org
      const o = row.org_id || 'unknown'
      if (!byOrg[o]) byOrg[o] = { count: 0, cost: 0 }
      byOrg[o].count++
      byOrg[o].cost += cost

      // By day
      if (!byDay[day]) byDay[day] = { count: 0, cost: 0 }
      byDay[day].count++
      byDay[day].cost += cost

      totalCost += cost
      totalCalls++
    }

    // Round all costs
    const roundCost = (n: number) => Math.round(n * 1000000) / 1000000

    const roundByType = Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, { ...v, cost: roundCost(v.cost) }])
    )
    const roundByProvider = Object.fromEntries(
      Object.entries(byProvider).map(([k, v]) => [k, { ...v, cost: roundCost(v.cost) }])
    )
    const roundByModel = Object.fromEntries(
      Object.entries(byModel).map(([k, v]) => [k, { ...v, cost: roundCost(v.cost) }])
    )
    const roundByOrg = Object.fromEntries(
      Object.entries(byOrg).map(([k, v]) => [k, { ...v, cost: roundCost(v.cost) }])
    )
    const roundByDay = Object.fromEntries(
      Object.entries(byDay).map(([k, v]) => [k, { ...v, cost: roundCost(v.cost) }])
    )

    return NextResponse.json({
      total_calls: totalCalls,
      total_cost: roundCost(totalCost),
      by_type: roundByType,
      by_provider: roundByProvider,
      by_model: roundByModel,
      by_org: roundByOrg,
      by_day: roundByDay,
    })
  } catch (err) {
    console.error('Admin usage error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
