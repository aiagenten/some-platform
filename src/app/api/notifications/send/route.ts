import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://some-platform.aiagenten.no'

// POST: Send notification when post status changes
// This serves as a fallback when Edge Functions aren't deployed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { post_id, org_id, event, post_preview, created_by } = body

    if (!post_id || !org_id || !event) {
      return NextResponse.json({ error: 'post_id, org_id, and event are required' }, { status: 400 })
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json({ message: 'RESEND_API_KEY not configured, skipping' }, { status: 200 })
    }

    const supabase = createAdminClient()

    // Get org name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single()

    const orgName = org?.name || 'din organisasjon'

    if (event === 'pending_approval') {
      // Find admins
      const { data: admins } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('org_id', org_id)
        .eq('role', 'admin')

      let notified = 0
      for (const admin of (admins || [])) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('email_on_approval')
          .eq('user_id', admin.id)
          .eq('org_id', org_id)
          .single()

        if (!prefs || prefs.email_on_approval !== false) {
          await sendResendEmail(
            admin.email,
            `🔔 Nytt innhold venter godkjenning — ${orgName}`,
            buildApprovalHtml(admin.name || 'Admin', orgName, post_id, post_preview || '')
          )
          notified++
        }
      }

      return NextResponse.json({ success: true, notified })
    }

    if (event === 'published' && created_by) {
      const { data: creator } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', created_by)
        .single()

      if (creator) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('email_on_publish')
          .eq('user_id', creator.id)
          .eq('org_id', org_id)
          .single()

        if (!prefs || prefs.email_on_publish !== false) {
          await sendResendEmail(
            creator.email,
            `✅ Innlegget ditt er publisert — ${orgName}`,
            buildPublishedHtml(creator.name || 'Bruker', orgName, post_id, post_preview || '')
          )
          return NextResponse.json({ success: true, notified: 1 })
        }
      }
    }

    return NextResponse.json({ success: true, notified: 0 })
  } catch (err) {
    console.error('Send notification error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SoMe Platform <noreply@aiagenten.no>',
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Resend error:', errText)
  }
}

function buildApprovalHtml(name: string, orgName: string, postId: string, preview: string) {
  const url = `${APP_URL}/dashboard/posts/${postId}`
  const previewText = preview.length > 200 ? preview.substring(0, 200) + '...' : preview
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:20px">🔔 Nytt innhold venter</h1>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p>Hei ${name},</p>
    <p style="color:#4b5563">Et nytt innlegg i <strong>${orgName}</strong> venter på din godkjenning.</p>
    ${previewText ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:16px 0"><p style="margin:0;font-size:14px;color:#374151;white-space:pre-line">${previewText}</p></div>` : ''}
    <a href="${url}" style="display:inline-block;background:#3b82f6;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Se innlegget →</a>
    <p style="font-size:11px;color:#9ca3af;margin-top:20px">
      <a href="${APP_URL}/dashboard/settings" style="color:#6b7280">Endre varslingsinnstillinger</a>
    </p>
  </div>
</div>`
}

function buildPublishedHtml(name: string, orgName: string, postId: string, preview: string) {
  const url = `${APP_URL}/dashboard/posts/${postId}`
  const previewText = preview.length > 200 ? preview.substring(0, 200) + '...' : preview
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:20px">✅ Innlegget er publisert!</h1>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
    <p>Hei ${name},</p>
    <p style="color:#4b5563">Innlegget ditt i <strong>${orgName}</strong> er nå publisert! 🎉</p>
    ${previewText ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin:16px 0"><p style="margin:0;font-size:14px;color:#374151;white-space:pre-line">${previewText}</p></div>` : ''}
    <a href="${url}" style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Se innlegget →</a>
    <p style="font-size:11px;color:#9ca3af;margin-top:20px">
      <a href="${APP_URL}/dashboard/settings" style="color:#6b7280">Endre varslingsinnstillinger</a>
    </p>
  </div>
</div>`
}
