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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { role } = body

    if (!role) return NextResponse.json({ error: 'role er påkrevd' }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) {
      console.error('User update error:', error)
      return NextResponse.json({ error: 'Kunne ikke oppdatere bruker' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin user PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Prevent self-deletion
    if (params.id === adminUser.id) {
      return NextResponse.json({ error: 'Kan ikke slette din egen konto' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Remove from public.users first
    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', params.id)

    if (profileError) {
      console.error('Profile delete error:', profileError)
      return NextResponse.json({ error: 'Kunne ikke fjerne brukerprofil' }, { status: 500 })
    }

    // Optionally delete from auth (commented out to preserve audit trail)
    // await supabase.auth.admin.deleteUser(params.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin user DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
