import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { data } = await supabase
    .from('website_integrations')
    .select('id, org_id, platform, wordpress_url, wordpress_username, settings, created_at, updated_at')
    .eq('org_id', profile.org_id)
    .single()

  return NextResponse.json(data || null)
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

  // Test connection if WordPress
  if (body.platform === 'wordpress' && body.test) {
    try {
      const url = body.wordpress_url?.replace(/\/$/, '')
      const auth = Buffer.from(`${body.wordpress_username}:${body.wordpress_app_password}`).toString('base64')
      const res = await fetch(`${url}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${auth}` },
      })
      if (!res.ok) {
        return NextResponse.json({ success: false, error: `WordPress returned ${res.status}` })
      }
      const wpUser = await res.json()
      return NextResponse.json({ success: true, user: wpUser.name })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return NextResponse.json({ success: false, error: message })
    }
  }

  const { data, error } = await supabase
    .from('website_integrations')
    .upsert({
      org_id: profile.org_id,
      platform: body.platform || 'wordpress',
      wordpress_url: body.wordpress_url || null,
      wordpress_username: body.wordpress_username || null,
      wordpress_app_password: body.wordpress_app_password || null,
      settings: body.settings || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
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
    .from('website_integrations')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', profile.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
