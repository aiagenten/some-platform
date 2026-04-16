import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Manually retry a failed post.
 * Resets retry_count, clears error, sets status='approved' so the next
 * cron run picks it up immediately. Also kicks off publish-post directly
 * so the user gets fast feedback instead of waiting up to 60s for cron.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireUser()
    if (auth instanceof NextResponse) return auth

    const postId = params.id
    if (!postId) {
      return NextResponse.json({ error: 'post_id required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: post } = await supabase
      .from('social_posts')
      .select('id, org_id, status')
      .eq('id', postId)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.org_id !== auth.orgId && !auth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (post.status !== 'failed') {
      return NextResponse.json(
        { error: `Cannot retry post with status '${post.status}'` },
        { status: 400 },
      )
    }

    // Reset retry tracking and queue for immediate retry
    await supabase
      .from('social_posts')
      .update({
        status: 'approved',
        retry_count: 0,
        last_publish_error: null,
        last_retry_at: null,
      })
      .eq('id', postId)

    await logAudit({
      action: 'post.retry_requested',
      resourceType: 'social_post',
      resourceId: postId,
      metadata: { triggered_by: 'manual' },
    })

    // Kick off publish immediately for fast feedback (don't await full result)
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      fetch(`${SUPABASE_URL}/functions/v1/publish-post`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ post_id: postId }),
      }).catch((e) => console.error('Immediate publish trigger failed:', e))
    }

    return NextResponse.json({ success: true, message: 'Innlegget prøves publisert på nytt.' })
  } catch (err) {
    console.error('Post retry error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
