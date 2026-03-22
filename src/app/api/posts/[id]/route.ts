import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'No profile' }, { status: 403 })
  }

  // Verify the post belongs to this org before deleting
  const { data: post } = await supabase
    .from('social_posts')
    .select('id, org_id, status')
    .eq('id', params.id)
    .eq('org_id', profile.org_id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Delete related records first
  await supabase.from('content_feedback').delete().eq('post_id', params.id)
  await supabase.from('image_generations').delete().eq('post_id', params.id)
  await supabase.from('brand_learnings').delete().eq('source_post_id', params.id)

  // Delete the post
  const { error } = await supabase
    .from('social_posts')
    .delete()
    .eq('id', params.id)
    .eq('org_id', profile.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
