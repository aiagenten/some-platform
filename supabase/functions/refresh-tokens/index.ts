// Supabase Edge Function: refresh-tokens
// Refreshes Facebook/Instagram tokens that expire within 10 days
// Long-lived tokens last 60 days — refresh at 50 days (10 days before expiry)
// Should be triggered by cron (pg_cron or external scheduler)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID')!
const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET')!
const TOKEN_SECRET = Deno.env.get('TOKEN_ENCRYPTION_SECRET') || 'default-encryption-key'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (_req) => {
  try {
    // Find accounts expiring within 10 days
    const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expiringAccounts } = await supabase
      .from('social_accounts')
      .select('id, org_id, platform, account_id, account_name, metadata, token_expires_at')
      .in('platform', ['facebook', 'instagram'])
      .lt('token_expires_at', tenDaysFromNow)
      .gt('token_expires_at', new Date().toISOString()) // Not yet expired

    if (!expiringAccounts?.length) {
      return new Response(JSON.stringify({ message: 'No tokens to refresh', count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let refreshed = 0
    let failed = 0
    const errors: string[] = []

    for (const account of expiringAccounts) {
      try {
        // Decrypt current token
        const { data: currentToken } = await supabase.rpc('decrypt_social_token', {
          p_account_id: account.id,
          p_token_secret: TOKEN_SECRET,
        })

        if (!currentToken) {
          errors.push(`No token for ${account.account_name}`)
          failed++
          continue
        }

        // For Facebook: exchange for new long-lived token
        // Page Access Tokens derived from long-lived User Tokens are already long-lived
        // But we can refresh the User Token which re-derives page tokens
        const meta = account.metadata as any
        if (meta?.for_refresh && account.platform === 'facebook') {
          // This is the user token — refresh it
          const refreshRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${currentToken}`
          )
          const refreshData = await refreshRes.json()

          if (refreshData.error) {
            errors.push(`Refresh failed for ${account.account_name}: ${refreshData.error.message}`)
            failed++
            continue
          }

          const newToken = refreshData.access_token
          const expiresIn = refreshData.expires_in || 5184000

          // Update token
          await supabase.rpc('upsert_social_account', {
            p_org_id: account.org_id,
            p_platform: account.platform,
            p_account_id: account.account_id,
            p_account_name: account.account_name,
            p_access_token: newToken,
            p_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            p_token_secret: TOKEN_SECRET,
            p_scopes: [],
            p_metadata: JSON.stringify(account.metadata),
          })

          // Also refresh all page tokens for this org
          const pagesRes = await fetch(
            `https://graph.facebook.com/v19.0/me/accounts?access_token=${newToken}&fields=id,name,access_token,instagram_business_account{id,username}`
          )
          const pagesData = await pagesRes.json()

          if (pagesData.data) {
            for (const page of pagesData.data) {
              await supabase.rpc('upsert_social_account', {
                p_org_id: account.org_id,
                p_platform: 'facebook',
                p_account_id: page.id,
                p_account_name: page.name,
                p_access_token: page.access_token,
                p_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                p_token_secret: TOKEN_SECRET,
                p_scopes: ['pages_manage_posts'],
                p_metadata: JSON.stringify({ page_id: page.id, page_name: page.name }),
              })

              if (page.instagram_business_account) {
                const ig = page.instagram_business_account
                await supabase.rpc('upsert_social_account', {
                  p_org_id: account.org_id,
                  p_platform: 'instagram',
                  p_account_id: ig.id,
                  p_account_name: ig.username || page.name,
                  p_access_token: page.access_token,
                  p_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                  p_token_secret: TOKEN_SECRET,
                  p_scopes: ['instagram_content_publish'],
                  p_metadata: JSON.stringify({
                    ig_user_id: ig.id,
                    ig_username: ig.username,
                    facebook_page_id: page.id,
                  }),
                })
              }
            }
          }

          refreshed++
        }
      } catch (err: any) {
        errors.push(`Error refreshing ${account.account_name}: ${err.message}`)
        failed++
      }
    }

    // Log refresh results
    await supabase.rpc('log_publish_event', {
      p_org_id: expiringAccounts[0].org_id,
      p_post_id: expiringAccounts[0].id, // Using account id as entity
      p_action: 'token_refresh',
      p_details: JSON.stringify({ refreshed, failed, errors }),
    })

    return new Response(
      JSON.stringify({ refreshed, failed, errors, total: expiringAccounts.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('refresh-tokens error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
