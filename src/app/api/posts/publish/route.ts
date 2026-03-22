import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  try {
    const { post_id } = await request.json()

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify post exists and is approved
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('id, status, org_id, platform')
      .eq('id', post_id)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (!['approved', 'scheduled'].includes(post.status)) {
      return NextResponse.json(
        { error: 'Only approved or scheduled posts can be published' },
        { status: 400 }
      )
    }

    // Set status to publishing
    await supabase
      .from('social_posts')
      .update({ status: 'publishing' })
      .eq('id', post_id)

    // Invoke Edge Function
    try {
      const edgeFnUrl = `${SUPABASE_URL}/functions/v1/publish-post`
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ post_id }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Edge Function error:', errText)

        // Revert status on error
        await supabase
          .from('social_posts')
          .update({ status: 'approved' })
          .eq('id', post_id)

        return NextResponse.json(
          { error: 'Edge Function failed', details: errText },
          { status: 500 }
        )
      }

      const result = await res.json()

      // Audit log for successful publish
      await logAudit({
        action: 'post.published',
        resourceType: 'post',
        resourceId: post_id,
        resourceTitle: `${post.platform} post`,
        metadata: {
          platform: post.platform,
          org_id: post.org_id,
          publish_result: result,
        },
      }).catch((err) => console.error('Audit log failed:', err))

      return NextResponse.json({ success: true, result })
    } catch (fnErr) {
      console.error('Edge Function call error:', fnErr)

      // Revert status on error
      await supabase
        .from('social_posts')
        .update({ status: 'approved' })
        .eq('id', post_id)

      return NextResponse.json(
        { error: 'Failed to call publish function' },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error('Publish error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
