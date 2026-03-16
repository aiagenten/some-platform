import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://some-platform.aiagenten.no'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotifyRequest {
  post_id: string
  org_id: string
  event: 'pending_approval' | 'published'
  post_preview?: string
  created_by?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { post_id, org_id, event, post_preview, created_by } = await req.json() as NotifyRequest

    if (!post_id || !org_id || !event) {
      return new Response(
        JSON.stringify({ error: 'post_id, org_id, and event are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get org name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single()

    const orgName = org?.name || 'din organisasjon'

    if (event === 'pending_approval') {
      // Notify org admins about new content pending approval
      const { data: admins } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('org_id', org_id)
        .eq('role', 'admin')

      if (!admins || admins.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No admins to notify' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check notification preferences for each admin
      let notifiedCount = 0
      for (const admin of admins) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('email_on_approval')
          .eq('user_id', admin.id)
          .eq('org_id', org_id)
          .single()

        // Default: notify if no preferences set OR if email_on_approval is true
        const shouldNotify = !prefs || prefs.email_on_approval !== false

        if (shouldNotify && RESEND_API_KEY) {
          await sendEmail({
            to: admin.email,
            subject: `🔔 Nytt innhold venter godkjenning — ${orgName}`,
            html: buildApprovalEmail(admin.name || 'Admin', orgName, post_id, post_preview || ''),
          })
          notifiedCount++
        }
      }

      return new Response(
        JSON.stringify({ success: true, notified: notifiedCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (event === 'published') {
      // Notify the creator that their post was published
      if (!created_by) {
        return new Response(
          JSON.stringify({ message: 'No created_by provided' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: creator } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', created_by)
        .single()

      if (!creator) {
        return new Response(
          JSON.stringify({ message: 'Creator not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_on_publish')
        .eq('user_id', creator.id)
        .eq('org_id', org_id)
        .single()

      const shouldNotify = !prefs || prefs.email_on_publish !== false

      if (shouldNotify && RESEND_API_KEY) {
        await sendEmail({
          to: creator.email,
          subject: `✅ Innlegget ditt er publisert — ${orgName}`,
          html: buildPublishedEmail(creator.name || 'Bruker', orgName, post_id, post_preview || ''),
        })

        return new Response(
          JSON.stringify({ success: true, notified: 1 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: 'notifications disabled or no API key' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid event type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Notify error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================
// Email sending via Resend
// ============================================================

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
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
    throw new Error(`Failed to send email: ${res.status}`)
  }

  return res.json()
}

// ============================================================
// Email templates
// ============================================================

function buildApprovalEmail(name: string, orgName: string, postId: string, preview: string): string {
  const postUrl = `${APP_URL}/dashboard/posts/${postId}`
  const previewText = preview.length > 200 ? preview.substring(0, 200) + '...' : preview

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Nytt innhold venter</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="font-size: 16px; margin-bottom: 16px;">Hei ${name},</p>
    <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">
      Det er et nytt innlegg som venter på din godkjenning i <strong>${orgName}</strong>.
    </p>
    ${previewText ? `
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px 0; font-weight: 600;">Forhåndsvisning:</p>
      <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line;">${previewText}</p>
    </div>
    ` : ''}
    <a href="${postUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Se innlegget →
    </a>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
      Du mottar denne e-posten fordi du er admin i ${orgName}. 
      <a href="${APP_URL}/dashboard/settings" style="color: #6b7280;">Endre varslingsinnstillinger</a>
    </p>
  </div>
</body>
</html>`
}

function buildPublishedEmail(name: string, orgName: string, postId: string, preview: string): string {
  const postUrl = `${APP_URL}/dashboard/posts/${postId}`
  const previewText = preview.length > 200 ? preview.substring(0, 200) + '...' : preview

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✅ Innlegget er publisert!</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="font-size: 16px; margin-bottom: 16px;">Hei ${name},</p>
    <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">
      Innlegget ditt i <strong>${orgName}</strong> er nå publisert! 🎉
    </p>
    ${previewText ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 13px; color: #166534; margin: 0 0 4px 0; font-weight: 600;">Publisert innhold:</p>
      <p style="font-size: 14px; color: #374151; margin: 0; white-space: pre-line;">${previewText}</p>
    </div>
    ` : ''}
    <a href="${postUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Se innlegget →
    </a>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
      Du mottar denne e-posten fordi du opprettet dette innlegget.
      <a href="${APP_URL}/dashboard/settings" style="color: #6b7280;">Endre varslingsinnstillinger</a>
    </p>
  </div>
</body>
</html>`
}
