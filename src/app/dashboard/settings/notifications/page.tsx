'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NotificationsSettings() {
  const [notifPrefs, setNotifPrefs] = useState({ email_on_approval: true, email_on_publish: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/notifications/preferences')
      if (res.ok) {
        const json = await res.json()
        setNotifPrefs(json.preferences || { email_on_approval: true, email_on_publish: true })
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleToggle = async (key: 'email_on_approval' | 'email_on_publish') => {
    setSaving(true)
    const newPrefs = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(newPrefs)
    await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrefs),
    })
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Laster...</div>

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-4">E-postvarslinger</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">E-post ved godkjenning</p>
            <p className="text-xs text-slate-500">Få varsel når innhold venter på godkjenning</p>
          </div>
          <button
            onClick={() => handleToggle('email_on_approval')}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              notifPrefs.email_on_approval ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
              notifPrefs.email_on_approval ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">E-post ved publisering</p>
            <p className="text-xs text-slate-500">Få varsel når ditt innlegg blir publisert</p>
          </div>
          <button
            onClick={() => handleToggle('email_on_publish')}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              notifPrefs.email_on_publish ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
              notifPrefs.email_on_publish ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
    </div>
  )
}
