import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAccess } from '@/lib/auth'

const ALLOWED_DOWNLOAD_HOSTS = [
  'www.googleapis.com',
  'graph.microsoft.com',
  'api.onedrive.com',
  'public.bn.files.1drv.com',
  '1drv.ms',
  'onedrive.live.com',
]

const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024 // 100 MB

function isAllowedDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    // Microsoft uses various subdomains (*.files.1drv.com etc.)
    return ALLOWED_DOWNLOAD_HOSTS.some(host =>
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

// Download a file from Google Drive / OneDrive and upload to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const { provider, account_id, file_id, file_name, download_url, org_id } = await request.json()

    if (!provider || !account_id || !org_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const auth = await requireOrgAccess(org_id)
    if (auth instanceof NextResponse) return auth

    const supabase = createAdminClient()

    // Get access token — scoped to user's org
    const { data: account } = await supabase
      .from('social_accounts')
      .select('metadata')
      .eq('id', account_id)
      .eq('org_id', auth.orgId)
      .single()

    if (!account?.metadata?.access_token) {
      return NextResponse.json({ error: 'No access token' }, { status: 401 })
    }

    const accessToken = account.metadata.access_token

    // Determine download URL
    let fileUrl = download_url
    if (provider === 'google_drive' && file_id) {
      fileUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file_id)}?alt=media`
    }

    if (!fileUrl) {
      return NextResponse.json({ error: 'No download URL' }, { status: 400 })
    }

    // SSRF protection: only allow known cloud provider hosts
    if (!isAllowedDownloadUrl(fileUrl)) {
      return NextResponse.json({ error: 'Invalid download URL' }, { status: 400 })
    }

    // Download the file with timeout
    const fileRes = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    })

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to download file' }, { status: 502 })
    }

    const contentLength = fileRes.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    const fileBuffer = await fileRes.arrayBuffer()
    if (fileBuffer.byteLength > MAX_DOWNLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    const contentType = fileRes.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 })
    }

    // Determine extension
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    }
    const ext = extMap[contentType] || '.jpg'
    const safeName = (file_name || `cloud-${file_id}`).replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${auth.orgId}/cloud-imports/${Date.now()}_${safeName}${ext}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      })

    if (uploadError) {
      // If bucket doesn't exist, try creating it
      if (uploadError.message?.includes('not found')) {
        await supabase.storage.createBucket('media', { public: true })
        const { error: retryError } = await supabase.storage
          .from('media')
          .upload(storagePath, fileBuffer, { contentType, upsert: false })
        if (retryError) {
          console.error('Upload retry failed:', retryError)
          return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
        }
      } else {
        console.error('Upload failed:', uploadError)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: storagePath,
    })
  } catch (err) {
    console.error('Cloud file download error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
