'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, Loader2, Image as ImageIcon, Check } from 'lucide-react'

type MediaAsset = {
  id: string
  url: string
  thumbnail_url: string | null
  filename: string | null
  mime_type: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

export default function MediaPickerModal({ open, onClose, onSelect }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!open) return
    loadAssets()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAssets() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()
    if (!profile) return

    const { data } = await supabase
      .from('media_assets')
      .select('id, url, thumbnail_url, filename, mime_type')
      .eq('org_id', profile.org_id)
      .ilike('mime_type', 'image/%')
      .order('created_at', { ascending: false })
      .limit(50)

    setAssets(data || [])
    setLoading(false)
  }

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

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Ingen bilder i mediebiblioteket</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-sm text-indigo-600 font-medium hover:underline"
              >
                Last opp et bilde
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {assets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedUrl(asset.url)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    selectedUrl === asset.url
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  <img
                    src={asset.thumbnail_url || asset.url}
                    alt={asset.filename || ''}
                    className="w-full h-full object-cover"
                  />
                  {selectedUrl === asset.url && (
                    <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
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
      </div>
    </div>
  )
}
