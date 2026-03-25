import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const search = request.nextUrl.searchParams.get('search') || ''
  const status = request.nextUrl.searchParams.get('status') || ''

  let query = supabase
    .from('articles')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('updated_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('articles')
    .insert({
      org_id: profile.org_id,
      author_id: user.id,
      title: body.title || 'Uten tittel',
      slug: body.slug || '',
      content: body.content || null,
      excerpt: body.excerpt || null,
      featured_image_url: body.featured_image_url || null,
      status: body.status || 'draft',
      metadata: body.metadata || {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
