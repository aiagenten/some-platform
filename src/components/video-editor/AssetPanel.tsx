'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, Film, Music, Image as ImageIcon, Trash2, Plus, Loader2, FolderOpen } from 'lucide-react'
import type { TrackItem } from '@/lib/editor-state'
import { uid } from '@/lib/editor-state'

export type Asset = {
  id: string
  type: 'video' | 'audio' | 'image'
  name: string
  url: string
  durationSeconds?: number
  thumbnailUrl?: string
}

type Props = {
  assets: Asset[]
  onAddAsset: (asset: Asset) => void
  onRemoveAsset: (id: string) => void
  onDropToTimeline: (asset: Asset, trackId: string) => void
  onAddToTimeline: (trackId: string, item: Omit<TrackItem, 'id'>) => void
  fps: number
}

function AssetIcon({ type }: { type: Asset['type'] }) {
  if (type === 'video') return <Film className="w-4 h-4 text-indigo-400" />
  if (type === 'audio') return <Music className="w-4 h-4 text-green-400" />
  return <ImageIcon className="w-4 h-4 text-cyan-400" />
}

const ACCEPT: Record<string, string> = {
  video: 'video/mp4,video/mov,video/webm,video/*',
  audio: 'audio/mp3,audio/wav,audio/aac,audio/*',
  image: 'image/jpeg,image/png,image/gif,image/webp,image/*',
}

const TRACK_FOR_TYPE: Record<string, string> = {
  video: 'v1',
  audio: 'a1',
  image: 'v1',
}

export function AssetPanel({ assets, onAddAsset, onRemoveAsset, onAddToTimeline, fps }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'video' | 'audio' | 'image'>('all')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = tab === 'all' ? assets : assets.filter(a => a.type === tab)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setUploading(true)
      setUploadError(null)

      try {
        // Upload to Supabase Storage via our /api/upload endpoint or use object URL
        // For now, create an object URL (works for preview; production should upload to storage)
        const url = URL.createObjectURL(file)

        let type: Asset['type'] = 'video'
        if (file.type.startsWith('audio')) type = 'audio'
        else if (file.type.startsWith('image')) type = 'image'

        // Get duration for video/audio
        let durationSeconds: number | undefined
        if (type === 'video' || type === 'audio') {
          durationSeconds = await getMediaDuration(url, type)
        }

        const asset: Asset = {
          id: uid(),
          type,
          name: file.name,
          url,
          durationSeconds,
        }

        onAddAsset(asset)
      } catch (err) {
        setUploadError('Upload failed: ' + String(err))
      } finally {
        setUploading(false)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    [onAddAsset],
  )

  const handleAddToTimeline = useCallback(
    (asset: Asset) => {
      const trackId = TRACK_FOR_TYPE[asset.type] || 'v1'
      const durationInFrames = asset.durationSeconds
        ? Math.round(asset.durationSeconds * fps)
        : 90 // default 3 sec

      const item: Omit<TrackItem, 'id'> = {
        type: asset.type === 'image' ? 'image' : asset.type,
        from: 0,
        durationInFrames,
        src: asset.url,
        label: asset.name,
      }

      onAddToTimeline(trackId, item)
    },
    [fps, onAddToTimeline],
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 text-sm">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-700/60 flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-slate-400" />
        <span className="font-semibold text-slate-200 text-[13px]">Assets</span>
        <div className="flex-1" />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 rounded-md text-white transition-colors"
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={`${ACCEPT.video},${ACCEPT.audio},${ACCEPT.image}`}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-2 pb-1">
        {(['all', 'video', 'audio', 'image'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[10px] px-2 py-1 rounded capitalize transition-colors ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Error */}
      {uploadError && (
        <div className="mx-3 mt-2 text-xs text-red-400 bg-red-950/40 px-2 py-1.5 rounded">
          {uploadError}
        </div>
      )}

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div
            className="mt-4 flex flex-col items-center gap-2 text-slate-500 cursor-pointer hover:text-slate-400 transition-colors py-6 border-2 border-dashed border-slate-700 rounded-lg"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8" />
            <span className="text-xs text-center">Drop media here<br />or click to upload</span>
          </div>
        ) : (
          filtered.map(asset => (
            <div
              key={asset.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800 group cursor-pointer"
              onDoubleClick={() => handleAddToTimeline(asset)}
              title="Double-click to add to timeline"
            >
              <AssetIcon type={asset.type} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-200 truncate">{asset.name}</div>
                {asset.durationSeconds && (
                  <div className="text-[10px] text-slate-500">
                    {formatDur(asset.durationSeconds)}
                  </div>
                )}
              </div>
              {/* Quick actions on hover */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddToTimeline(asset) }}
                  className="p-1 rounded hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors"
                  title="Add to timeline"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveAsset(asset.id) }}
                  className="p-1 rounded hover:bg-red-600/40 text-slate-500 hover:text-red-300 transition-colors"
                  title="Remove asset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hint */}
      {filtered.length > 0 && (
        <div className="px-3 py-1.5 text-[10px] text-slate-600 border-t border-slate-700/40">
          Double-click to add to timeline
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDur(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function getMediaDuration(url: string, type: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve) => {
    const el = type === 'video'
      ? document.createElement('video')
      : document.createElement('audio')
    el.src = url
    el.addEventListener('loadedmetadata', () => resolve(el.duration))
    el.addEventListener('error', () => resolve(0))
  })
}
