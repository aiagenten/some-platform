import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { name, orgName, email, password } = await request.json()

    if (!name || !orgName || !email || !password) {
      return NextResponse.json({ error: 'Alle felter er påkrevd' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Passord må være minst 6 tegn' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Create organization
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, slug })
      .select()
      .single()

    if (orgError) {
      console.error('Org creation error:', orgError)
      return NextResponse.json({ error: 'Kunne ikke opprette organisasjon' }, { status: 500 })
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      // Rollback org
      await supabase.from('organizations').delete().eq('id', org.id)
      console.error('Auth creation error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 3. Check if this is the first user (make them aiagenten_admin)
    const { count: userCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
    
    const isFirstUser = (userCount ?? 0) === 0
    const role = isFirstUser ? 'aiagenten_admin' : 'admin'

    // 4. Create user profile
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        org_id: org.id,
        role,
        name,
        email,
      })

    if (userError) {
      // Rollback
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('organizations').delete().eq('id', org.id)
      console.error('User profile creation error:', userError)
      return NextResponse.json({ error: 'Kunne ikke opprette brukerprofil' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user_id: authData.user.id,
      org_id: org.id,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Intern serverfeil' }, { status: 500 })
  }
}
