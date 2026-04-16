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

// Exponential backoff in minutes: 5min → 15min → 1h → 4h → 12h
// After MAX_RETRIES, the post stays 'failed' until manually retried.
const MAX_RETRIES = 5
const RETRY_DELAYS_MIN = [5, 15, 60, 240, 720]

function nextRetryDue(lastRetryAt: string | null, retryCount: number): boolean {
  if (retryCount >= MAX_RETRIES) return false
  if (!lastRetryAt) return true
  const delayMin = RETRY_DELAYS_MIN[Math.min(retryCount - 1, RETRY_DELAYS_MIN.length - 1)] ?? 720
  const dueAt = new Date(lastRetryAt).getTime() + delayMin * 60 * 1000
  return Date.now() >= dueAt
}

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

    // Fetch due posts — 'approved'/'scheduled' (regular flow) and 'failed' (retry flow)
    const { data: posts, error: fetchError } = await supabase
      .from('social_posts')
      .select('id, org_id, platform, caption, content_text, scheduled_for, status, retry_count, last_retry_at')
      .in('status', ['approved', 'scheduled', 'failed'])
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

    // Filter out failed posts that aren't due for retry yet (or have exceeded max retries)
    const eligiblePosts = posts.filter((p) => {
      if (p.status === 'failed') {
        return nextRetryDue(p.last_retry_at, p.retry_count ?? 0)
      }
      return true
    })

    if (eligiblePosts.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, skipped: posts.length }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results: Array<{
      postId: string
      success: boolean
      error?: string
    }> = []

    for (const post of eligiblePosts) {
      // Atomically claim the post (approved|scheduled|failed → publishing)
      const { data: claimed } = await supabase
        .from('social_posts')
        .update({ status: 'publishing' })
        .eq('id', post.id)
        .in('status', ['approved', 'scheduled', 'failed'])
        .select('id')
        .maybeSingle()

      if (!claimed) {
        console.log(`[process-scheduled-posts] Post ${post.id} already claimed — skipping`)
        continue
      }

      if (post.status === 'failed') {
        console.log(`[process-scheduled-posts] Retrying failed post ${post.id} (attempt ${(post.retry_count ?? 0) + 1}/${MAX_RETRIES})`)
      }

      const minutesOverdue =
        (Date.now() - new Date(post.scheduled_for).getTime()) / 60000
      const wasRetry = post.status === 'failed'
      const previousRetryCount = post.retry_count ?? 0

      // Helper: record a failure with retry tracking.
      // - If this was already a retry attempt: stay 'failed', bump retry_count
      // - If first-time failure but well past schedule (>15 min): mark 'failed'
      // - If first-time failure but recent: revert to 'approved' for fast retry
      const recordFailure = async (errMsg: string) => {
        const becomeFailed = wasRetry || minutesOverdue >= 15
        const updates: Record<string, unknown> = {
          status: becomeFailed ? 'failed' : 'approved',
          last_publish_error: errMsg.slice(0, 1000),
          last_retry_at: new Date().toISOString(),
        }
        if (becomeFailed) {
          updates.retry_count = previousRetryCount + 1
        }
        await supabase.from('social_posts').update(updates).eq('id', post.id)
        if (becomeFailed) {
          results.push({ postId: post.id, success: false, error: errMsg })
        }
      }

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
          await recordFailure(`HTTP ${res.status}: ${errText}`)
        } else {
          const body = await res.json()
          if (body.success === false) {
            await recordFailure(body.error || 'publish-post returned success:false')
          } else {
            // publish-post sets status='published' itself on success
            results.push({ postId: post.id, success: true })
          }
        }
      } catch (err: any) {
        await recordFailure(err.message || 'Unknown error')
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
