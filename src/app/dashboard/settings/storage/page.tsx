'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { HardDrive, Cloud } from 'lucide-react'

export default function StorageSettings() {
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
    }
    load()
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-1">Bildegalleri</h2>
      <p className="text-sm text-slate-500 mb-4">Koble til skylagring for enkel tilgang til bilder ved publisering.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>
    </div>
  )
}
