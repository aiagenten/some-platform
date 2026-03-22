import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET - Get visibility settings for standard templates
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { data, error } = await supabase
    .from('overlay_template_settings')
    .select('template_id, is_visible')
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return as a map: { template_id: is_visible }
  const settings: Record<string, boolean> = {}
  for (const row of data || []) {
    settings[row.template_id] = row.is_visible
  }
  return NextResponse.json(settings)
}

// PUT - Update visibility for a standard template
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { template_id, is_visible } = await req.json()
  if (!template_id || is_visible === undefined) {
    return NextResponse.json({ error: 'template_id and is_visible required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('overlay_template_settings')
    .upsert({
      org_id: profile.org_id,
      template_id,
      is_visible,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,template_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
