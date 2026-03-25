import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'

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

function buildInviteHtml(confirmUrl: string, orgName?: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px;text-align:center">
<img src="https://aiagenten.no/logo-white.png" alt="AI Agenten" height="36" style="height:36px">
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">SoMe-plattformen</p>
</td></tr>
<tr><td style="padding:40px 32px">
<h2 style="color:#18181b;margin:0 0 16px;font-size:22px">Du er invitert!</h2>
<p style="color:#52525b;line-height:1.6;margin:0 0 24px">Du har blitt invitert til SoMe-plattformen${orgName ? ` for <strong>${orgName}</strong>` : ''} fra AI Agenten. Klikk knappen under for å akseptere invitasjonen og komme i gang.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:8px;padding:14px 32px">
<a href="${confirmUrl}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Aksepter invitasjon</a>
</td></tr></table>
<p style="color:#a1a1aa;font-size:13px;margin:24px 0 0;text-align:center">Lenken er gyldig i 24 timer.</p>
</td></tr>
<tr><td style="background:#f4f4f5;padding:20px 32px;text-align:center">
<p style="color:#a1a1aa;font-size:12px;margin:0">&copy; AI Agenten AS — some.aiagenten.no</p>
</td></tr></table></td></tr></table></body></html>`
}

async function sendEmailViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SoMe-plattformen <noreply@aiagenten.no>',
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return false
  }

  return true
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

    // Generate invite link WITHOUT sending email (we'll send via Resend)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
        data: { org_id, role },
      },
    })

    if (linkError) {
      // If user already exists in auth, ensure profile exists and send magic link
      if (linkError.message?.includes('already been registered')) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === email)

        if (existingUser) {
          // Ensure public user record exists
          await supabase
            .from('users')
            .upsert({
              id: existingUser.id,
              email,
              name: name || email.split('@')[0],
              org_id,
              role,
            }, { onConflict: 'id' })

          // Send magic link via Resend so they can log in
          const { data: magicData, error: magicError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: {
              redirectTo: `${SITE_URL}/auth/callback`,
            },
          })

          if (!magicError && magicData?.properties?.action_link) {
            await sendEmailViaResend(
              email,
              `Du er invitert til ${org.name} på SoMe-plattformen`,
              buildInviteHtml(magicData.properties.action_link, org.name)
            )
          }

          return NextResponse.json({ success: true, message: `Invitasjon sendt til ${email}` })
        }
      }

      console.error('Invite error:', linkError)
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    // Create public user record
    if (linkData?.user) {
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: linkData.user.id,
          email,
          name: name || email.split('@')[0],
          org_id,
          role,
        }, { onConflict: 'id' })

      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }

    // Send invite email via Resend
    const confirmUrl = linkData?.properties?.action_link
    if (confirmUrl) {
      const emailSent = await sendEmailViaResend(
        email,
        `Du er invitert til ${org.name} på SoMe-plattformen`,
        buildInviteHtml(confirmUrl, org.name)
      )

      if (!emailSent) {
        return NextResponse.json({
          success: true,
          message: `Bruker opprettet, men e-post kunne ikke sendes. Kopier invitasjonslenken manuelt.`,
          invite_url: confirmUrl,
        })
      }
    }

    return NextResponse.json({ success: true, message: `Invitasjon sendt til ${email}` })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
