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

export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const orgId = searchParams.get('org_id') || ''

    const supabase = createAdminClient()

    let query = supabase
      .from('users')
      .select(`
        id, name, email, role, avatar_url, created_at, org_id,
        organizations (id, name, slug)
      `)
      .order('created_at', { ascending: false })

    if (orgId) query = query.eq('org_id', orgId)
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Users query error:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json({ users: data || [] })
  } catch (err) {
    console.error('Admin users GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
