import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAccess } from '@/lib/auth'

const ALLOWED_BUCKETS = ['post-images', 'videos', 'media', 'brand-assets']
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const orgId = formData.get('org_id') as string
    const type = (formData.get('type') as string) || 'image'
    let bucket = (formData.get('bucket') as string) || 'post-images'

    if (!file || !orgId) {
      return NextResponse.json({ error: 'file and org_id are required' }, { status: 400 })
    }

    const auth = await requireOrgAccess(orgId)
    if (auth instanceof NextResponse) return auth

    // Use 'videos' bucket for video uploads
    if (type === 'video') {
      bucket = 'videos'
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg')
    const fileName = `${auth.orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const supabase = createAdminClient()

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
      bucket,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
