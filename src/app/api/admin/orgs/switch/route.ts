import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { org_id } = body

    const response = NextResponse.json({ success: true })

    if (org_id) {
      response.cookies.set('admin_viewing_org_id', org_id, {
        httpOnly: false, // needs to be readable by client JS
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      })
    } else {
      response.cookies.delete('admin_viewing_org_id')
    }

    return response
  } catch (err) {
    console.error('Org switch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
