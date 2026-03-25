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

const SITE_URL_RESEND = process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'

function rewriteSupabaseUrl(supabaseUrl: string): string {
  try {
    const url = new URL(supabaseUrl)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type') || 'invite'
    if (token) {
      return `${SITE_URL_RESEND}/api/auth/verify?token=${token}&type=${type}&redirect_to=/auth/callback`
    }
  } catch {}
  return supabaseUrl
}

async function sendEmailViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return false

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

  return res.ok
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

    // Get org name for email
    let orgName = 'din organisasjon'
    if (org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', org_id)
        .single()
      if (org) orgName = org.name
    }

    // Generate a new invite link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${SITE_URL}/auth/callback`,
        data: { org_id, role },
      },
    })

    if (linkError) {
      // User already exists — try magic link instead
      if (linkError.message?.includes('already been registered')) {
        const { data: magicData, error: magicError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${SITE_URL}/auth/callback`,
          },
        })

        if (magicError) {
          return NextResponse.json({ error: magicError.message }, { status: 500 })
        }

        const magicUrl = magicData?.properties?.action_link
        if (magicUrl) {
          await sendEmailViaResend(
            email,
            `Din innloggingslenke — SoMe-plattformen`,
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px;text-align:center">
<img src="https://some.aiagenten.no/logo-icon.png" alt="AI Agenten" height="36" style="height:36px">
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">SoMe-plattformen</p>
</td></tr>
<tr><td style="padding:40px 32px">
<h2 style="color:#18181b;margin:0 0 16px;font-size:22px">Logg inn</h2>
<p style="color:#52525b;line-height:1.6;margin:0 0 24px">Klikk knappen under for å logge inn på SoMe-plattformen.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:8px;padding:14px 32px">
<a href="${rewriteSupabaseUrl(magicUrl)}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Logg inn</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f4f4f5;padding:20px 32px;text-align:center">
<p style="color:#a1a1aa;font-size:12px;margin:0">&copy; AI Agenten AS — some.aiagenten.no</p>
</td></tr></table></td></tr></table></body></html>`
          )
        }

        return NextResponse.json({ success: true, message: `Innloggingslenke sendt til ${email}` })
      }

      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    const confirmUrl = linkData?.properties?.action_link
    if (confirmUrl) {
      await sendEmailViaResend(
        email,
        `Du er invitert til ${orgName} på SoMe-plattformen`,
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px;text-align:center">
<img src="https://some.aiagenten.no/logo-icon.png" alt="AI Agenten" height="36" style="height:36px">
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">SoMe-plattformen</p>
</td></tr>
<tr><td style="padding:40px 32px">
<h2 style="color:#18181b;margin:0 0 16px;font-size:22px">Du er invitert!</h2>
<p style="color:#52525b;line-height:1.6;margin:0 0 24px">Du har blitt invitert til SoMe-plattformen for <strong>${orgName}</strong>. Klikk knappen under for å akseptere invitasjonen.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:8px;padding:14px 32px">
<a href="${rewriteSupabaseUrl(confirmUrl)}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Aksepter invitasjon</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#f4f4f5;padding:20px 32px;text-align:center">
<p style="color:#a1a1aa;font-size:12px;margin:0">&copy; AI Agenten AS — some.aiagenten.no</p>
</td></tr></table></td></tr></table></body></html>`
      )
    }

    return NextResponse.json({ success: true, message: `Invitasjon sendt på nytt til ${email}` })
  } catch (err) {
    console.error('Resend invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
