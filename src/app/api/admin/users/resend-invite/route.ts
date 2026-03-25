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

    const { email, org_id, role } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'E-post er påkrevd' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Send the invite email via Supabase (uses configured SMTP/Resend)
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'}/auth/callback`,
      data: { org_id, role },
    })

    if (inviteError) {
      // If "already registered", the generateLink approach might work better
      // Try sending a magic link instead
      if (inviteError.message?.includes('already been registered')) {
        const { error: magicError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'}/auth/callback`,
          },
        })

        if (magicError) {
          return NextResponse.json({ error: magicError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: `Innloggingslenke sendt til ${email}` })
      }

      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Invitasjon sendt på nytt til ${email}` })
  } catch (err) {
    console.error('Resend invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
