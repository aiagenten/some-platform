import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// List images from Google Drive or OneDrive
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider') // 'google_drive' | 'onedrive'
  const accountId = searchParams.get('account_id')
  const folderId = searchParams.get('folder_id') || 'root'

  if (!provider || !accountId) {
    return NextResponse.json({ error: 'Missing provider or account_id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Get the stored token
  const { data: account } = await supabase
    .from('social_accounts')
    .select('metadata')
    .eq('id', accountId)
    .single()

  if (!account?.metadata) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const accessToken = account.metadata.access_token
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  try {
    let files: Array<{ id: string; name: string; thumbnailUrl: string; mimeType: string; downloadUrl: string }> = []

    if (provider === 'google_drive') {
      // Google Drive API — list images
      const query = folderId === 'root'
        ? "mimeType contains 'image/' and trashed = false"
        : `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,thumbnailLink,webContentLink)&pageSize=50&orderBy=modifiedTime desc`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!res.ok) {
        const err = await res.text()
        console.error('Google Drive API error:', err)
        return NextResponse.json({ error: 'Failed to list Google Drive files' }, { status: 502 })
      }

      const data = await res.json()
      files = (data.files || []).map((f: Record<string, string>) => ({
        id: f.id,
        name: f.name,
        thumbnailUrl: f.thumbnailLink || '',
        mimeType: f.mimeType,
        downloadUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
      }))
    } else if (provider === 'onedrive') {
      // Microsoft Graph API — list images
      const path = folderId === 'root'
        ? '/me/drive/root/children'
        : `/me/drive/items/${folderId}/children`

      const res = await fetch(
        `https://graph.microsoft.com/v1.0${path}?$filter=file/mimeType eq 'image/jpeg' or file/mimeType eq 'image/png' or file/mimeType eq 'image/webp' or file/mimeType eq 'image/gif'&$select=id,name,file,thumbnails,@microsoft.graph.downloadUrl&$top=50&$orderby=lastModifiedDateTime desc`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!res.ok) {
        // Try without filter (simpler)
        const res2 = await fetch(
          `https://graph.microsoft.com/v1.0${path}?$select=id,name,file,thumbnails,@microsoft.graph.downloadUrl&$top=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!res2.ok) {
          return NextResponse.json({ error: 'Failed to list OneDrive files' }, { status: 502 })
        }

        const data = await res2.json()
        files = (data.value || [])
          .filter((f: Record<string, unknown>) => f.file && (f.file as Record<string, string>).mimeType?.startsWith('image/'))
          .map((f: Record<string, unknown>) => ({
            id: f.id as string,
            name: f.name as string,
            thumbnailUrl: (f.thumbnails as Array<Record<string, Record<string, string>>>)?.[0]?.medium?.url || '',
            mimeType: (f.file as Record<string, string>).mimeType,
            downloadUrl: (f['@microsoft.graph.downloadUrl'] as string) || '',
          }))
      } else {
        const data = await res.json()
        files = (data.value || []).map((f: Record<string, unknown>) => ({
          id: f.id as string,
          name: f.name as string,
          thumbnailUrl: (f.thumbnails as Array<Record<string, Record<string, string>>>)?.[0]?.medium?.url || '',
          mimeType: (f.file as Record<string, string>)?.mimeType || 'image/jpeg',
          downloadUrl: (f['@microsoft.graph.downloadUrl'] as string) || '',
        }))
      }
    } else {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    return NextResponse.json({ files })
  } catch (err) {
    console.error('Cloud files error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
