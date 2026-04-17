import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://some.aiagenten.no'

function rewriteSupabaseUrl(supabaseUrl: string): string {
  try {
    const url = new URL(supabaseUrl)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type') || 'recovery'
    if (token) {
      return `${SITE_URL}/api/auth/verify?token=${token}&type=${type}&redirect_to=/auth/callback?type=recovery`
    }
  } catch {}
  return supabaseUrl
}

function buildResetHtml(resetUrl: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:32px;text-align:center">
<img src="https://some.aiagenten.no/logo-icon.png" alt="AI Agenten" height="36" style="height:36px">
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">SoMe-plattformen</p>
</td></tr>
<tr><td style="padding:40px 32px">
<h2 style="color:#18181b;margin:0 0 16px;font-size:22px">Tilbakestill passordet ditt</h2>
<p style="color:#52525b;line-height:1.6;margin:0 0 24px">Vi mottok en forespørsel om å tilbakestille passordet ditt. Klikk knappen under for å sette et nytt passord.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
<td style="background:linear-gradient(135deg,#7c3aed,#3b82f6);border-radius:8px;padding:14px 32px">
<a href="${resetUrl}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Sett nytt passord</a>
</td></tr></table>
<p style="color:#a1a1aa;font-size:13px;margin:24px 0 0;text-align:center">Lenken er gyldig i 24 timer. Hvis du ikke ba om dette, kan du ignorere denne e-posten.</p>
</td></tr>
<tr><td style="background:#f4f4f5;padding:20px 32px;text-align:center">
<p style="color:#a1a1aa;font-size:12px;margin:0">&copy; AI Agenten AS — some.aiagenten.no</p>
</td></tr></table></td></tr></table></body></html>`
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'E-post er påkrevd' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Generate recovery link via admin API (without sending Supabase's default email)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${SITE_URL}/auth/callback?type=recovery`,
      },
    })

    if (linkError) {
      console.error('Recovery link error:', linkError)
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({ success: true })
    }

    const recoveryUrl = linkData?.properties?.action_link
    if (!recoveryUrl) {
      // Email might not exist — still return success to prevent enumeration
      return NextResponse.json({ success: true })
    }

    // Send via Resend for consistent branding and deliverability
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SoMe-plattformen <noreply@aiagenten.no>',
          to: [email],
          subject: 'Tilbakestill passordet ditt — SoMe-plattformen',
          html: buildResetHtml(rewriteSupabaseUrl(recoveryUrl)),
        }),
      })

      if (!res.ok) {
        console.error('Resend error:', await res.text())
        // Fallback: the Supabase link still works if user gets it some other way
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Noe gikk galt' }, { status: 500 })
  }
}
