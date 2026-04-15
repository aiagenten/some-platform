import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAccess } from '@/lib/auth'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

// GET /api/media — list media assets + AI-generated images from storage
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('org_id')
  const source = searchParams.get('source') // 'all', 'upload', 'ai_generated', 'google_drive', 'onedrive'
  const favoritesOnly = searchParams.get('favorites') === 'true'
  const styleGuideOnly = searchParams.get('style_guide') === 'true'
  const tag = searchParams.get('tag')

  const auth = await requireOrgAccess(orgId)
  if (auth instanceof NextResponse) return auth

  const supabase = createAdminClient()

  try {
    // Build query for media_assets table
    let query = supabase
      .from('media_assets')
      .select('*')
      .eq('org_id', auth.orgId)
      .order('created_at', { ascending: false })

    if (source && source !== 'all') {
      query = query.eq('source', source)
    }
    if (favoritesOnly) {
      query = query.eq('is_favorite', true)
    }
    if (styleGuideOnly) {
      query = query.eq('is_style_guide', true)
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data: assets, error } = await query.limit(200)
    if (error) {
      console.error('Media query error:', error)
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    }

    // Also list AI-generated images from storage that aren't yet in media_assets
    let storageImages: Array<{ url: string; name: string; created_at: string }> = []
    if (!source || source === 'all' || source === 'ai_generated') {
      const { data: files } = await supabase.storage
        .from('post-images')
        .list(`generated/${auth.orgId}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

      if (files?.length) {
        const existingUrls = new Set(assets?.map(a => a.url) || [])
        storageImages = files
          .filter(f => f.name && /\.(png|jpg|jpeg|webp)$/i.test(f.name))
          .map(f => {
            const { data: urlData } = supabase.storage
              .from('post-images')
              .getPublicUrl(`generated/${auth.orgId}/${f.name}`)
            return {
              url: urlData.publicUrl,
              name: f.name,
              created_at: f.created_at || new Date().toISOString(),
            }
          })
          .filter(img => !existingUrls.has(img.url))
      }
    }

    return NextResponse.json({ assets: assets || [], storageImages })
  } catch (err) {
    console.error('Media list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/media — upload file or register external media
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    // File upload
    const formData = await request.formData()
    const file = formData.get('file') as File
    const orgId = formData.get('org_id') as string
    const tags = formData.get('tags') as string

    if (!file || !orgId) {
      return NextResponse.json({ error: 'file and org_id required' }, { status: 400 })
    }

    const auth = await requireOrgAccess(orgId)
    if (auth instanceof NextResponse) return auth

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Only image and video files are supported' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `uploads/${auth.orgId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(fileName, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName)

    const { data: asset, error: insertError } = await supabase
      .from('media_assets')
      .insert({
        org_id: auth.orgId,
        source: 'upload',
        url: urlData.publicUrl,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save metadata' }, { status: 500 })
    }

    return NextResponse.json({ asset })
  } else {
    // JSON body — register external media (Drive, OneDrive, etc.)
    const body = await request.json()
    const { org_id, source, url, thumbnail_url, filename, tags } = body

    if (!org_id || !url) {
      return NextResponse.json({ error: 'org_id and url required' }, { status: 400 })
    }

    const auth = await requireOrgAccess(org_id)
    if (auth instanceof NextResponse) return auth

    const supabase = createAdminClient()

    const { data: asset, error } = await supabase
      .from('media_assets')
      .insert({
        org_id: auth.orgId,
        source: source || 'upload',
        url,
        thumbnail_url,
        filename,
        tags: tags || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    return NextResponse.json({ asset })
  }
}

// PATCH /api/media — update tags, favorite, style_guide
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, tags, is_favorite, is_style_guide } = body

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load asset to verify org ownership
  const { data: existing } = await supabase
    .from('media_assets')
    .select('org_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requireOrgAccess(existing.org_id)
  if (auth instanceof NextResponse) return auth

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (tags !== undefined) updates.tags = tags
  if (is_favorite !== undefined) updates.is_favorite = is_favorite
  if (is_style_guide !== undefined) updates.is_style_guide = is_style_guide

  const { data, error } = await supabase
    .from('media_assets')
    .update(updates)
    .eq('id', id)
    .eq('org_id', auth.orgId)
    .select()
    .single()

  if (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ asset: data })
}

// DELETE /api/media — remove a media asset
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load asset to verify org ownership
  const { data: existing } = await supabase
    .from('media_assets')
    .select('org_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = await requireOrgAccess(existing.org_id)
  if (auth instanceof NextResponse) return auth

  const { error } = await supabase
    .from('media_assets')
    .delete()
    .eq('id', id)
    .eq('org_id', auth.orgId)

  if (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
