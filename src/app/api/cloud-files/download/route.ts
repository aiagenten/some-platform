import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Download a file from Google Drive / OneDrive and upload to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const { provider, account_id, file_id, file_name, download_url, org_id } = await request.json()

    if (!provider || !account_id || !org_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get access token
    const { data: account } = await supabase
      .from('social_accounts')
      .select('metadata')
      .eq('id', account_id)
      .single()

    if (!account?.metadata?.access_token) {
      return NextResponse.json({ error: 'No access token' }, { status: 401 })
    }

    const accessToken = account.metadata.access_token

    // Determine download URL
    let fileUrl = download_url
    if (provider === 'google_drive' && file_id) {
      fileUrl = `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`
    }

    if (!fileUrl) {
      return NextResponse.json({ error: 'No download URL' }, { status: 400 })
    }

    // Download the file
    const fileRes = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to download file' }, { status: 502 })
    }

    const fileBuffer = await fileRes.arrayBuffer()
    const contentType = fileRes.headers.get('content-type') || 'image/jpeg'

    // Determine extension
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    }
    const ext = extMap[contentType] || '.jpg'
    const safeName = (file_name || `cloud-${file_id}`).replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${org_id}/cloud-imports/${Date.now()}_${safeName}${ext}`

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
          return NextResponse.json({ error: `Upload failed: ${retryError.message}` }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
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
