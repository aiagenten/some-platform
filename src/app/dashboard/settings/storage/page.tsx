'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { HardDrive, Cloud, CheckCircle, FolderOpen, Loader2, Image as ImageIcon } from 'lucide-react'

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

export default function StorageSettings() {
  const [userId, setUserId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [orgId, setOrgId] = useState<string | null>(null)
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<CloudAccount | null>(null)
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
    if (!profile) return
    setOrgId(profile.org_id)

    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('id, platform, account_name, metadata')
      .eq('org_id', profile.org_id)
      .in('platform', ['google_drive', 'onedrive'])

    if (accounts) setCloudAccounts(accounts)
  }, [supabase, router])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const openFolderPicker = async (account: CloudAccount) => {
    setSelectedAccount(account)
    setLoadingFiles(true)
    setCloudFiles([])
    try {
      const res = await fetch(`/api/cloud-files?provider=${account.platform}&account_id=${account.id}`)
      if (res.ok) {
        const data = await res.json()
        setCloudFiles(data.files || [])
      }
    } catch (err) {
      console.error('Failed to load cloud files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

  const googleAccount = cloudAccounts.find(a => a.platform === 'google_drive')
  const onedriveAccount = cloudAccounts.find(a => a.platform === 'onedrive')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1">Bildegalleri</h2>
        <p className="text-sm text-slate-500 mb-4">Koble til skylagring for enkel tilgang til bilder ved publisering.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Google Drive */}
          {googleAccount ? (
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-green-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-green-800">Google Drive</p>
                  <p className="text-xs text-green-600 truncate">{googleAccount.account_name}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              </div>
              <button
                onClick={() => openFolderPicker(googleAccount)}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-800 text-sm font-medium transition-all"
              >
                <FolderOpen className="w-4 h-4" />
                Bla gjennom bilder
              </button>
            </div>
          ) : (
            <button
              onClick={() => userId && (window.location.href = `/api/auth/google-drive?user_id=${userId}`)}
              disabled={!userId}
              className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="font-medium text-green-800">Google Drive</p>
                <p className="text-xs text-green-600">Koble til for tilgang til bilder</p>
              </div>
            </button>
          )}

          {/* Microsoft OneDrive */}
          {onedriveAccount ? (
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-sky-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sky-800">Microsoft OneDrive</p>
                  <p className="text-xs text-sky-600 truncate">{onedriveAccount.account_name}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
              </div>
              <button
                onClick={() => openFolderPicker(onedriveAccount)}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-sm font-medium transition-all"
              >
                <FolderOpen className="w-4 h-4" />
                Bla gjennom bilder
              </button>
            </div>
          ) : (
            <button
              onClick={() => userId && (window.location.href = `/api/auth/onedrive?user_id=${userId}`)}
              disabled={!userId}
              className="flex items-center gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-sky-700" />
              </div>
              <div>
                <p className="font-medium text-sky-800">Microsoft OneDrive</p>
                <p className="text-xs text-sky-600">Koble til for tilgang til bilder</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Folder picker — shown when a connected account is selected */}
      {selectedAccount && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">
              Bilder fra {selectedAccount.platform === 'google_drive' ? 'Google Drive' : 'OneDrive'}
            </h3>
            <span className="text-sm text-slate-400 ml-1">— {selectedAccount.account_name}</span>
          </div>

          {loadingFiles && (
            <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm">Laster bilder...</p>
            </div>
          )}

          {!loadingFiles && cloudFiles.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center">Ingen bilder funnet i denne kontoen.</p>
          )}

          {!loadingFiles && cloudFiles.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {cloudFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-400 transition-all cursor-pointer bg-slate-50"
                >
                  {file.thumbnailUrl ? (
                    <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
