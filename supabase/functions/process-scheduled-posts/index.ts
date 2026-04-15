// Supabase Edge Function: process-scheduled-posts
// Picks up social_posts with status='approved' and scheduled_for <= now()
// and calls publish-post for each.
//
// Should be triggered by pg_cron every minute:
//   SELECT cron.schedule('process-scheduled-posts', '* * * * *',
//     $$SELECT net.http_post(url:='<SUPABASE_URL>/functions/v1/process-scheduled-posts',
//       headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}',
//       body:='{}')$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  try {
    const now = new Date().toISOString()

    // Reset posts stuck in "publishing" for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: stuckPosts } = await supabase
      .from('social_posts')
      .update({ status: 'approved' })
      .eq('status', 'publishing')
      .lt('updated_at', fiveMinutesAgo)
      .select('id')
    if (stuckPosts && stuckPosts.length > 0) {
      console.log(`[process-scheduled-posts] Reset ${stuckPosts.length} stuck post(s)`)
    }

    // Fetch due posts
    const { data: posts, error: fetchError } = await supabase
      .from('social_posts')
      .select('id, org_id, platform, caption, content_text, scheduled_for')
      .eq('status', 'approved')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })

    if (fetchError) {
      throw new Error(`Fetch failed: ${fetchError.message}`)
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{
      postId: string
      success: boolean
      error?: string
    }> = []

    for (const post of posts) {
      // Atomically claim the post (approved → publishing)
      const { data: claimed } = await supabase
        .from('social_posts')
        .update({ status: 'publishing' })
        .eq('id', post.id)
        .eq('status', 'approved')
        .select('id')
        .maybeSingle()

      if (!claimed) {
        console.log(`[process-scheduled-posts] Post ${post.id} already claimed — skipping`)
        continue
      }

      const minutesOverdue =
        (Date.now() - new Date(post.scheduled_for).getTime()) / 60000

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120_000)

        const res = await fetch(`${SUPABASE_URL}/functions/v1/publish-post`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ post_id: post.id }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          const errText = await res.text()
          const errMsg = `HTTP ${res.status}: ${errText}`

          if (minutesOverdue >= 15) {
            await supabase
              .from('social_posts')
              .update({ status: 'failed' })
              .eq('id', post.id)
            results.push({ postId: post.id, success: false, error: errMsg })
          } else {
            // Transient — revert so next cron run retries
            await supabase
              .from('social_posts')
              .update({ status: 'approved' })
              .eq('id', post.id)
          }
        } else {
          const body = await res.json()
          if (body.success === false) {
            const errMsg = body.error || 'publish-post returned success:false'
            if (minutesOverdue >= 15) {
              await supabase
                .from('social_posts')
                .update({ status: 'failed' })
                .eq('id', post.id)
              results.push({ postId: post.id, success: false, error: errMsg })
            } else {
              await supabase
                .from('social_posts')
                .update({ status: 'approved' })
                .eq('id', post.id)
            }
          } else {
            results.push({ postId: post.id, success: true })
          }
        }
      } catch (err: any) {
        const errMsg = err.message || 'Unknown error'
        if (minutesOverdue >= 15) {
          await supabase
            .from('social_posts')
            .update({ status: 'failed' })
            .eq('id', post.id)
          results.push({ postId: post.id, success: false, error: errMsg })
        } else {
          await supabase
            .from('social_posts')
            .update({ status: 'approved' })
            .eq('id', post.id)
        }
      }
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    console.log(
      `[process-scheduled-posts] Done: ${successful} ok, ${failed} failed of ${posts.length} due`
    )

    return new Response(
      JSON.stringify({
        success: true,
        processed: posts.length,
        successful,
        failed,
        results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[process-scheduled-posts] Fatal error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
