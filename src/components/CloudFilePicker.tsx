'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Cloud, X, Image, Loader2 } from 'lucide-react'

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

interface CloudFilePickerProps {
  onSelect: (url: string) => void
  onClose: () => void
}

export default function CloudFilePicker({ onSelect, onClose }: CloudFilePickerProps) {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<CloudAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<CloudAccount | null>(null)
  const [files, setFiles] = useState<CloudFile[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function loadAccounts() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return
      setUserId(userData.user.id)

      const { data: userRow } = await supabase.from('users').select('org_id').eq('id', userData.user.id).single()
      if (!userRow) return

      const { data: accts } = await supabase
        .from('social_accounts')
        .select('id, account_name, metadata')
        .eq('org_id', userRow.org_id)
        .in('metadata->>provider', ['google_drive', 'onedrive'])

      setAccounts(accts || [])
    }
    loadAccounts()
  }, [supabase])

  const loadFiles = useCallback(async (account: CloudAccount) => {
    setSelectedAccount(account)
    setLoading(true)
    setFiles([])
    try {
      const provider = account.metadata.provider
      const res = await fetch(`/api/cloud-files?provider=${encodeURIComponent(provider)}&account_id=${encodeURIComponent(account.id)}`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
      }
    } catch {
      console.error('Failed to load cloud files')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectFile = useCallback(async (file: CloudFile) => {
    if (!selectedAccount || downloading) return
    setDownloading(file.id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return
      const { data: userRow } = await supabase.from('users').select('org_id').eq('id', userData.user.id).single()
      if (!userRow) return

      const res = await fetch('/api/cloud-files/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAccount.metadata.provider,
          account_id: selectedAccount.id,
          file_id: file.id,
          file_name: file.name,
          download_url: file.downloadUrl,
          org_id: userRow.org_id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onSelect(data.url)
      } else {
        alert('Kunne ikke laste ned filen')
      }
    } catch {
      alert('Noe gikk galt')
    } finally {
      setDownloading(null)
    }
  }, [selectedAccount, downloading, supabase, onSelect])

  const connectGoogle = () => { if (userId) window.location.href = `/api/auth/google-drive?user_id=${userId}` }
  const connectOneDrive = () => { if (userId) window.location.href = `/api/auth/onedrive?user_id=${userId}` }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Mine bilder</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 p-4 border-b border-slate-100 overflow-x-auto">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => loadFiles(acc)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 ${
                selectedAccount?.id === acc.id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {acc.account_name}
            </button>
          ))}
          <div className="flex gap-2 ml-auto">
            <button onClick={connectGoogle} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all whitespace-nowrap">+ Google Drive</button>
            <button onClick={connectOneDrive} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all whitespace-nowrap">+ OneDrive</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedAccount && accounts.length === 0 && (
            <div className="text-center py-12">
              <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">Ingen skylagringskontoer koblet til</p>
              <div className="flex justify-center gap-3">
                <button onClick={connectGoogle} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm">Koble til Google Drive</button>
                <button onClick={connectOneDrive} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm">Koble til OneDrive</button>
              </div>
            </div>
          )}

          {!selectedAccount && accounts.length > 0 && (
            <div className="text-center py-12 text-slate-500">Velg en konto for å bla gjennom bilder</div>
          )}

          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 mx-auto animate-spin" />
              <p className="mt-3 text-sm text-slate-500">Laster bilder...</p>
            </div>
          )}

          {selectedAccount && !loading && files.length === 0 && (
            <div className="text-center py-12 text-slate-500">Ingen bilder funnet i denne kontoen</div>
          )}

          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  disabled={downloading === file.id}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-all duration-200 group"
                >
                  {file.thumbnailUrl ? (
                    <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <Image className="w-8 h-8 text-slate-300" />
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
    </div>
  )
}
