'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, Loader2, Image as ImageIcon, Check, Search, Cloud, Star } from 'lucide-react'

type MediaAsset = {
  id: string
  url: string
  thumbnail_url: string | null
  filename: string | null
  mime_type: string
  source?: string
  is_favorite?: boolean
  tags?: string[]
}

type CloudFile = {
  id: string
  name: string
  thumbnailUrl: string
  mimeType: string
  downloadUrl: string
}

type CloudAccount = {
  id: string
  account_name: string
  metadata: {
    provider: string
    email?: string
    name?: string
  }
}

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

export default function MediaPickerModal({ open, onClose, onSelect }: Props) {
  const [tab, setTab] = useState<'library' | 'cloud'>('library')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Cloud state
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<CloudAccount | null>(null)
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedUrl(null)
    setSearch('')
    loadAssets()
    loadCloudAccounts()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAssets() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()
    if (!profile) return
    setOrgId(profile.org_id)

    // Fetch from /api/media to get both media_assets and storage images
    try {
      const res = await fetch(`/api/media?org_id=${profile.org_id}`)
      if (res.ok) {
        const data = await res.json()
        const allAssets: MediaAsset[] = [
          ...(data.assets || []),
          ...(data.storageImages || []).map((img: { url: string; name: string }) => ({
            id: img.url,
            url: img.url,
            thumbnail_url: null,
            filename: img.name,
            source: 'ai_generated',
            is_favorite: false,
            tags: [],
            mime_type: 'image/jpeg',
          })),
        ]
        setAssets(allAssets)
      }
    } catch {
      // Fallback: direct query
      const { data } = await supabase
        .from('media_assets')
        .select('id, url, thumbnail_url, filename, mime_type, source, is_favorite, tags')
        .eq('org_id', profile.org_id)
        .ilike('mime_type', 'image/%')
        .order('created_at', { ascending: false })
        .limit(100)
      setAssets(data || [])
    }
    setLoading(false)
  }

  async function loadCloudAccounts() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return

    const { data: userRow } = await supabase.from('users').select('org_id').eq('id', userData.user.id).single()
    if (!userRow) return

    const { data: accts } = await supabase
      .from('social_accounts')
      .select('id, account_name, metadata')
      .eq('org_id', userRow.org_id)
      .in('metadata->>provider', ['google_drive', 'onedrive'])

    setCloudAccounts(accts || [])
  }

  const loadCloudFiles = useCallback(async (account: CloudAccount) => {
    setSelectedAccount(account)
    setCloudLoading(true)
    setCloudFiles([])
    try {
      const provider = account.metadata.provider
      const res = await fetch(`/api/cloud-files?provider=${encodeURIComponent(provider)}&account_id=${encodeURIComponent(account.id)}`)
      if (res.ok) {
        const data = await res.json()
        setCloudFiles(data.files || [])
      }
    } catch {
      console.error('Failed to load cloud files')
    } finally {
      setCloudLoading(false)
    }
  }, [])

  const handleSelectCloudFile = useCallback(async (file: CloudFile) => {
    if (!selectedAccount || downloading) return
    setDownloading(file.id)
    try {
      const res = await fetch('/api/cloud-files/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAccount.metadata.provider,
          account_id: selectedAccount.id,
          file_id: file.id,
          file_name: file.name,
          download_url: file.downloadUrl,
          org_id: orgId,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onSelect(data.url)
        onClose()
      } else {
        alert('Kunne ikke laste ned filen')
      }
    } catch {
      alert('Noe gikk galt')
    } finally {
      setDownloading(null)
    }
  }, [selectedAccount, downloading, orgId, onSelect, onClose])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()
    if (!profile) { setUploading(false); return }

    const ext = file.name.split('.').pop()
    const path = `${profile.org_id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(path, file)

    if (uploadError) {
      alert('Feil ved opplasting: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

    await supabase.from('media_assets').insert({
      org_id: profile.org_id,
      source: 'upload',
      url: urlData.publicUrl,
      filename: file.name,
      mime_type: file.type,
      tags: [],
    })

    setUploading(false)
    loadAssets()
  }

  const filteredAssets = search.trim()
    ? assets.filter(a =>
        (a.filename || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase())) ||
        (a.source || '').toLowerCase().includes(search.toLowerCase())
      )
    : assets

  const connectGoogle = () => { if (userId) window.location.href = `/api/auth/google-drive?user_id=${userId}` }
  const connectOneDrive = () => { if (userId) window.location.href = `/api/auth/onedrive?user_id=${userId}` }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Velg bilde</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Last opp
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0">
          <button
            onClick={() => setTab('library')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === 'library'
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              Mediebibliotek
            </span>
          </button>
          <button
            onClick={() => setTab('cloud')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              tab === 'cloud'
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Cloud className="w-4 h-4" />
              Skylagring
              {cloudAccounts.length > 0 && (
                <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{cloudAccounts.length}</span>
              )}
            </span>
          </button>
        </div>

        {/* Library tab */}
        {tab === 'library' && (
          <>
            {/* Search */}
            <div className="px-6 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Søk etter bilder..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-16">
                  <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    {search ? 'Ingen bilder matcher søket' : 'Ingen bilder i mediebiblioteket'}
                  </p>
                  {!search && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 text-sm text-indigo-600 font-medium hover:underline"
                    >
                      Last opp et bilde
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {filteredAssets.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedUrl(asset.url)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                        selectedUrl === asset.url
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                    >
                      <img
                        src={asset.thumbnail_url || asset.url}
                        alt={asset.filename || ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {selectedUrl === asset.url && (
                        <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                      )}
                      {asset.is_favorite && (
                        <div className="absolute top-1 left-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 drop-shadow" />
                        </div>
                      )}
                      {asset.source && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {asset.source === 'digital-twin' ? 'Digital Twin' :
                           asset.source === 'ai_generated' ? 'AI' :
                           asset.source === 'upload' ? 'Opplastet' :
                           asset.source}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Cloud tab */}
        {tab === 'cloud' && (
          <div className="flex-1 overflow-y-auto">
            {/* Cloud account selector */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto">
              {cloudAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => loadCloudFiles(acc)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
                    selectedAccount?.id === acc.id
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  {acc.metadata.provider === 'google_drive' ? '🟢' : '🔵'} {acc.account_name}
                </button>
              ))}
              <div className="flex gap-2 ml-auto">
                <button onClick={connectGoogle} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all whitespace-nowrap">+ Google Drive</button>
                <button onClick={connectOneDrive} className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all whitespace-nowrap">+ OneDrive</button>
              </div>
            </div>

            <div className="p-4">
              {cloudAccounts.length === 0 && (
                <div className="text-center py-12">
                  <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">Ingen skylagringskontoer koblet til</p>
                  <div className="flex justify-center gap-3">
                    <button onClick={connectGoogle} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm">Koble til Google Drive</button>
                    <button onClick={connectOneDrive} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm">Koble til OneDrive</button>
                  </div>
                </div>
              )}

              {cloudAccounts.length > 0 && !selectedAccount && (
                <div className="text-center py-12 text-slate-500">Velg en konto for å bla gjennom bilder</div>
              )}

              {cloudLoading && (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-600 mx-auto animate-spin" />
                  <p className="mt-3 text-sm text-slate-500">Laster bilder...</p>
                </div>
              )}

              {selectedAccount && !cloudLoading && cloudFiles.length === 0 && (
                <div className="text-center py-12 text-slate-500">Ingen bilder funnet i denne kontoen</div>
              )}

              {cloudFiles.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {cloudFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleSelectCloudFile(file)}
                      disabled={downloading === file.id}
                      className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-all group"
                    >
                      {file.thumbnailUrl ? (
                        <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                      {downloading === file.id && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {file.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer — only for library tab (cloud tab selects directly) */}
        {tab === 'library' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={() => {
                if (selectedUrl) {
                  onSelect(selectedUrl)
                  onClose()
                }
              }}
              disabled={!selectedUrl}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Velg bilde
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
