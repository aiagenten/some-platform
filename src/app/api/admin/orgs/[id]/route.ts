import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const userSupabase = createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await userSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'aiagenten_admin') return null
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await verifyAdmin()
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, slug, industry, website_url, settings } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (industry !== undefined) updateData.industry = industry
    if (website_url !== undefined) updateData.website_url = website_url
    if (settings !== undefined) updateData.settings = settings

    const supabase = createAdminClient()

    // Check slug uniqueness if changing slug
    if (slug) {
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .neq('id', params.id)
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Slug er allerede i bruk' }, { status: 409 })
      }
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Org update error:', error)
      return NextResponse.json({ error: 'Kunne ikke oppdatere organisasjon' }, { status: 500 })
    }

    return NextResponse.json({ org: data })
  } catch (err) {
    console.error('Admin org PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
