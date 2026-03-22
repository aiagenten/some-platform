import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET - List custom overlay templates for the user's org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { data, error } = await supabase
    .from('custom_overlay_templates')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - Create a new custom overlay template
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const body = await req.json()
  const { name, description, elements, canvas_background, thumbnail, width, height } = body

  if (!name || !elements) {
    return NextResponse.json({ error: 'Name and elements are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_overlay_templates')
    .insert({
      org_id: profile.org_id,
      created_by: user.id,
      name,
      description: description || '',
      elements,
      canvas_background: canvas_background || { type: 'transparent' },
      thumbnail: thumbnail || null,
      width: width || 1080,
      height: height || 1080,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT - Update an existing custom overlay template
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, name, description, elements, canvas_background, thumbnail, is_visible } = body

  if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (elements !== undefined) updateData.elements = elements
  if (canvas_background !== undefined) updateData.canvas_background = canvas_background
  if (thumbnail !== undefined) updateData.thumbnail = thumbnail
  if (is_visible !== undefined) updateData.is_visible = is_visible

  const { data, error } = await supabase
    .from('custom_overlay_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE - Remove a custom overlay template
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })

  const { error } = await supabase.from('custom_overlay_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
