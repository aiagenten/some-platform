'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Image as ImageIcon, Upload, Star, Search, X, Tag, Loader2,
  HardDrive, Sparkles, FolderOpen, Trash2, Plus, User
} from 'lucide-react'

type MediaAsset = {
  id: string
  org_id: string
  source: string
  url: string
  thumbnail_url: string | null
  filename: string | null
  mime_type: string
  tags: string[]
  is_favorite: boolean
  is_style_guide: boolean
  created_at: string
}

type StorageImage = {
  url: string
  name: string
  created_at: string
}

type CloudAccount = {
  id: string
  platform: string
  account_name: string
  metadata: Record<string, unknown>
}

type CloudFile = {
  id: string
  name: string
  thumbnailUrl: string
  mimeType: string
  downloadUrl: string
}

const SOURCE_TABS = [
  { value: 'all', label: 'Alle', icon: ImageIcon },
  { value: 'ai_generated', label: 'AI-generert', icon: Sparkles },
  { value: 'digital-twin', label: 'Digital Twin', icon: User },
  { value: 'upload', label: 'Opplastet', icon: Upload },
  { value: 'google_drive', label: 'Google Drive', icon: HardDrive },
  { value: 'onedrive', label: 'OneDrive', icon: FolderOpen },
]

export default function MediaLibraryPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [storageImages, setStorageImages] = useState<StorageImage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSource, setActiveSource] = useState('all')
  const [showFavorites, setShowFavorites] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | StorageImage | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [editTags, setEditTags] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([])
  const [loadingCloud, setLoadingCloud] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.org_id)
        // Load cloud accounts
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('id, platform, account_name, metadata')
          .eq('org_id', profile.org_id)
          .in('platform', ['google_drive', 'onedrive'])
        if (accounts) setCloudAccounts(accounts)
      }
    }
    init()
  }, [])

  const loadMedia = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ org_id: orgId })
      if (activeSource !== 'all') params.set('source', activeSource)
      if (showFavorites) params.set('favorites', 'true')

      const res = await fetch(`/api/media?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data.assets || [])
        setStorageImages(data.storageImages || [])
      }
    } catch (err) {
      console.error('Load media error:', err)
    } finally {
      setLoading(false)
    }
  }, [orgId, activeSource, showFavorites])

  useEffect(() => {
    loadMedia()
  }, [loadMedia])

  // Load cloud files when switching to cloud source
  useEffect(() => {
    if ((activeSource === 'google_drive' || activeSource === 'onedrive') && cloudAccounts.length > 0) {
      const account = cloudAccounts.find(a => a.platform === activeSource)
      if (account) {
        loadCloudFiles(account.id, activeSource)
      }
    }
  }, [activeSource, cloudAccounts])

  const loadCloudFiles = async (accountId: string, provider: string) => {
    setLoadingCloud(true)
    try {
      const res = await fetch(`/api/cloud-files?provider=${provider}&account_id=${accountId}`)
      if (res.ok) {
        const data = await res.json()
        setCloudFiles(data.files || [])
      }
    } catch (err) {
      console.error('Cloud files error:', err)
    } finally {
      setLoadingCloud(false)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || !orgId) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const formData = new FormData()
        formData.append('file', file)
        formData.append('org_id', orgId)
        await fetch('/api/media', { method: 'POST', body: formData })
      }
      await loadMedia()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  const toggleFavorite = async (asset: MediaAsset) => {
    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: asset.id, is_favorite: !asset.is_favorite }),
      })
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_favorite: !a.is_favorite } : a))
    } catch (err) {
      console.error('Toggle favorite error:', err)
    }
  }

  const toggleStyleGuide = async (asset: MediaAsset) => {
    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: asset.id, is_style_guide: !asset.is_style_guide }),
      })
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_style_guide: !a.is_style_guide } : a))
    } catch (err) {
      console.error('Toggle style guide error:', err)
    }
  }

  const saveTags = async (assetId: string, tags: string[]) => {
    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId, tags }),
      })
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, tags } : a))
      setEditTags(null)
      setTagInput('')
    } catch (err) {
      console.error('Save tags error:', err)
    }
  }

  const deleteAsset = async (id: string) => {
    if (!confirm('Vil du slette dette bildet?')) return
    try {
      await fetch(`/api/media?id=${id}`, { method: 'DELETE' })
      setAssets(prev => prev.filter(a => a.id !== id))
      if (selectedAsset && 'id' in selectedAsset && selectedAsset.id === id) setSelectedAsset(null)
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const registerStorageImage = async (img: StorageImage) => {
    if (!orgId) return
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          source: 'ai_generated',
          url: img.url,
          filename: img.name,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAssets(prev => [data.asset, ...prev])
        setStorageImages(prev => prev.filter(s => s.url !== img.url))
      }
    } catch (err) {
      console.error('Register error:', err)
    }
  }

  // Filter assets by search query
  const filteredAssets = assets.filter(a => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (a.filename?.toLowerCase().includes(q)) ||
      a.tags.some(t => t.toLowerCase().includes(q)) ||
      a.source.toLowerCase().includes(q)
  })

  // Sort: favorites first
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1
    if (!a.is_favorite && b.is_favorite) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const isMediaAsset = (item: MediaAsset | StorageImage): item is MediaAsset => 'id' in item && 'source' in item

  return (
    <div className="animate-fade-in-up">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors">
        <span>←</span> Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Mediebibliotek</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 shadow-sm"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Last opp
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Source tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SOURCE_TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeSource === tab.value
          const isCloudTab = tab.value === 'google_drive' || tab.value === 'onedrive'
          const hasAccount = isCloudTab ? cloudAccounts.some(a => a.platform === tab.value) : true

          return (
            <button
              key={tab.value}
              onClick={() => setActiveSource(tab.value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              } ${!hasAccount && isCloudTab ? 'opacity-60' : ''}`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              {tab.label}
              {!hasAccount && isCloudTab && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">Ikke koblet</span>
              )}
            </button>
          )
        })}

        <div className="flex-1" />

        <button
          onClick={() => setShowFavorites(!showFavorites)}
          className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            showFavorites
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Star className={`w-4 h-4 ${showFavorites ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
          Favoritter
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Søk etter filnavn, tagger..."
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all duration-200"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center mb-6 transition-all duration-200 ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-indigo-500' : 'text-slate-300'}`} />
        <p className="text-sm text-slate-500">
          {uploading ? 'Laster opp...' : 'Dra og slipp bilder her, eller klikk "Last opp"'}
        </p>
      </div>

      {/* Cloud connect prompts for OneDrive */}
      {activeSource === 'onedrive' && !cloudAccounts.some(a => a.platform === 'onedrive') && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center mb-6 shadow-sm">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2">Koble til OneDrive</h3>
          <p className="text-sm text-slate-500 mb-4">Koble til OneDrive for å bla gjennom og bruke bilder direkte.</p>
          <Link
            href="/dashboard/settings/storage"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all"
          >
            Koble til i innstillinger
          </Link>
        </div>
      )}

      {/* Cloud connect prompts for Google Drive */}
      {activeSource === 'google_drive' && !cloudAccounts.some(a => a.platform === 'google_drive') && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center mb-6 shadow-sm">
          <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2">Koble til Google Drive</h3>
          <p className="text-sm text-slate-500 mb-4">Koble til Google Drive for å bla gjennom og bruke bilder direkte.</p>
          <Link
            href="/dashboard/settings/storage"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all"
          >
            Koble til i innstillinger
          </Link>
        </div>
      )}

      {/* Cloud files grid */}
      {(activeSource === 'google_drive' || activeSource === 'onedrive') && cloudAccounts.some(a => a.platform === activeSource) && (
        <div className="mb-6">
          {loadingCloud ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
              <p className="text-sm text-slate-400 mt-2">Laster filer fra skyen...</p>
            </div>
          ) : cloudFiles.length > 0 ? (
            <>
              <h3 className="text-sm font-medium text-slate-500 mb-3">Filer fra {activeSource === 'google_drive' ? 'Google Drive' : 'OneDrive'}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {cloudFiles.map(file => (
                  <div
                    key={file.id}
                    className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedAsset({ url: file.thumbnailUrl || file.downloadUrl, name: file.name, created_at: '' } as StorageImage)}
                  >
                    <div className="aspect-square bg-slate-50">
                      {file.thumbnailUrl ? (
                        <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-slate-600 truncate">{file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Ingen bilder funnet</p>
          )}
        </div>
      )}

      {/* Main media grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-400 mt-2">Laster mediebibliotek...</p>
        </div>
      ) : (
        <>
          {/* Registered assets */}
          {sortedAssets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
              {sortedAssets.map(asset => (
                <div
                  key={asset.id}
                  className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all"
                >
                  <div
                    className="aspect-square bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <img
                      src={asset.thumbnail_url || asset.url}
                      alt={asset.filename || ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Overlay actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(asset) }}
                      className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-all"
                      title={asset.is_favorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                    >
                      <Star className={`w-3.5 h-3.5 ${asset.is_favorite ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id) }}
                      className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-red-50 transition-all"
                      title="Slett"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>

                  {/* Favorite indicator */}
                  {asset.is_favorite && (
                    <div className="absolute top-2 left-2">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500 drop-shadow-sm" />
                    </div>
                  )}

                  {/* Style guide badge */}
                  {asset.is_style_guide && (
                    <div className="absolute bottom-12 left-2">
                      <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-md font-medium">Stilguide</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs text-slate-600 truncate">{asset.filename || 'Bilde'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        asset.source === 'ai_generated' ? 'bg-purple-50 text-purple-600' :
                        asset.source === 'upload' ? 'bg-blue-50 text-blue-600' :
                        asset.source === 'google_drive' ? 'bg-green-50 text-green-600' :
                        'bg-sky-50 text-sky-600'
                      }`}>
                        {asset.source === 'ai_generated' ? 'AI' :
                         asset.source === 'upload' ? 'Opplastet' :
                         asset.source === 'google_drive' ? 'Drive' : 'OneDrive'}
                      </span>
                      {asset.tags.length > 0 && (
                        <span className="text-[10px] text-slate-400">{asset.tags.length} tags</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unregistered storage images */}
          {storageImages.length > 0 && (activeSource === 'all' || activeSource === 'ai_generated') && (
            <>
              <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI-genererte bilder (ikke registrert)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                {storageImages.map((img, i) => (
                  <div
                    key={i}
                    className="group relative bg-white rounded-xl border border-dashed border-slate-300 overflow-hidden hover:shadow-md hover:border-slate-400 transition-all"
                  >
                    <div
                      className="aspect-square bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedAsset(img)}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); registerStorageImage(img) }}
                        className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-indigo-50 transition-all"
                        title="Legg til i biblioteket"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      </button>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-slate-500 truncate">{img.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {sortedAssets.length === 0 && storageImages.length === 0 && !loading && activeSource !== 'google_drive' && activeSource !== 'onedrive' && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Ingen bilder ennå. Last opp eller generer bilder for å komme i gang.</p>
            </div>
          )}
        </>
      )}

      {/* Full-size preview modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedAsset(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {isMediaAsset(selectedAsset) ? (selectedAsset.filename || 'Bilde') : (selectedAsset as StorageImage).name}
              </h3>
              <button onClick={() => setSelectedAsset(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={isMediaAsset(selectedAsset) ? selectedAsset.url : (selectedAsset as StorageImage).url}
                alt=""
                className="w-full rounded-xl"
              />
            </div>

            {isMediaAsset(selectedAsset) && (
              <div className="p-4 border-t border-slate-100 space-y-4">
                {/* Tags */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Tagger</span>
                  </div>
                  {editTags === selectedAsset.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="tag1, tag2, tag3"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => saveTags(selectedAsset.id, tagInput.split(',').map(t => t.trim()).filter(Boolean))}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                      >
                        Lagre
                      </button>
                      <button onClick={() => { setEditTags(null); setTagInput('') }} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">
                        Avbryt
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAsset.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">{tag}</span>
                      ))}
                      <button
                        onClick={() => { setEditTags(selectedAsset.id); setTagInput(selectedAsset.tags.join(', ')) }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg border border-dashed border-indigo-200 hover:border-indigo-300"
                      >
                        + Rediger tagger
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleFavorite(selectedAsset)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                      selectedAsset.is_favorite
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${selectedAsset.is_favorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                    {selectedAsset.is_favorite ? 'Favoritt' : 'Merk som favoritt'}
                  </button>
                  <button
                    onClick={() => toggleStyleGuide(selectedAsset)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                      selectedAsset.is_style_guide
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-purple-50'
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 ${selectedAsset.is_style_guide ? 'text-purple-500' : ''}`} />
                    {selectedAsset.is_style_guide ? 'Stilveiledning' : 'Bruk som stilveiledning'}
                  </button>
                </div>

                {/* Metadata */}
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Kilde: {selectedAsset.source} | Dato: {new Date(selectedAsset.created_at).toLocaleString('nb-NO')}</p>
                  {selectedAsset.mime_type && <p>Type: {selectedAsset.mime_type}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
