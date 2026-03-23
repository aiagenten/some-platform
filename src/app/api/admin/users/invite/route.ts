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

export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { email, org_id, role = 'member', name } = body

    if (!email || !org_id) {
      return NextResponse.json({ error: 'email og org_id er påkrevd' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify org exists
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', org_id)
      .single()

    if (!org) return NextResponse.json({ error: 'Organisasjon ikke funnet' }, { status: 404 })

    // Invite via Supabase auth admin
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'}/auth/callback`,
      data: { org_id, role },
    })

    if (inviteError) {
      // If user already exists in auth, try to find/create in public.users
      if (inviteError.message?.includes('already been registered')) {
        // Find existing auth user
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === email)

        if (existingUser) {
          // Check if already in this org
          const { data: existingProfile } = await supabase
            .from('users')
            .select('id, org_id')
            .eq('id', existingUser.id)
            .single()

          if (existingProfile) {
            return NextResponse.json({
              error: 'Brukeren er allerede registrert i systemet',
              existing_org_id: existingProfile.org_id,
            }, { status: 409 })
          }

          // Create public user record
          const { error: createError } = await supabase
            .from('users')
            .insert({
              id: existingUser.id,
              email,
              name: name || email.split('@')[0],
              org_id,
              role,
            })

          if (createError) {
            return NextResponse.json({ error: 'Kunne ikke opprette brukerprofil' }, { status: 500 })
          }

          return NextResponse.json({ success: true, message: 'Bruker lagt til i organisasjon' })
        }
      }

      console.error('Invite error:', inviteError)
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    // Create public user record for invited user
    if (inviteData?.user) {
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: inviteData.user.id,
          email,
          name: name || email.split('@')[0],
          org_id,
          role,
        }, { onConflict: 'id' })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Don't fail — invite was sent, profile will be created on first login
      }
    }

    return NextResponse.json({ success: true, message: `Invitasjon sendt til ${email}` })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
