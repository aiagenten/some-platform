'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Loader2, User, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react'

type DigitalTwin = {
  id: string
  name: string
  trigger_word: string
  status: 'uploading' | 'training' | 'ready' | 'failed'
  training_images: string[]
  lora_url: string | null
  sample_outputs: { url: string }[] | null
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  uploading: { label: 'Laster opp', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
  training: { label: 'Trener', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Loader2 },
  ready: { label: 'Klar', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Feilet', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertCircle },
}

export default function DigitalTwinListPage() {
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null) // eslint-disable-line @typescript-eslint/no-unused-vars
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.org_id)

      const { data } = await supabase
        .from('digital_twins')
        .select('*')
        .eq('tenant_id', profile.org_id)
        .order('created_at', { ascending: false })

      if (data) setTwins(data as DigitalTwin[])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll training twins
  useEffect(() => {
    const trainingTwins = twins.filter(t => t.status === 'training')
    if (!trainingTwins.length) return

    const interval = setInterval(async () => {
      for (const twin of trainingTwins) {
        try {
          const res = await fetch(`/api/digital-twin/status?twin_id=${twin.id}`)
          if (res.ok) {
            const data = await res.json()
            if (data.status !== 'training') {
              setTwins(prev => prev.map(t =>
                t.id === twin.id ? { ...t, status: data.status, lora_url: data.lora_url || t.lora_url, sample_outputs: data.sample_outputs || t.sample_outputs } : t
              ))
            }
          }
        } catch { /* ignore */ }
      }
    }, 10_000)

    return () => clearInterval(interval)
  }, [twins])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Digital Twin</h1>
          <p className="text-sm text-slate-500 mt-1">Tren AI-modeller basert på bilder av deg for bruk i innhold</p>
        </div>
        <Link
          href="/dashboard/digital-twin/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Opprett ny twin
        </Link>
      </div>

      {twins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Ingen Digital Twins ennå</h3>
          <p className="text-slate-500 mb-6">Last opp bilder av deg selv og tren en AI-modell for å generere nye bilder</p>
          <Link
            href="/dashboard/digital-twin/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            Opprett din første twin
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {twins.map((twin) => {
            const statusInfo = STATUS_MAP[twin.status]
            const StatusIcon = statusInfo.icon
            return (
              <Link
                key={twin.id}
                href={`/dashboard/digital-twin/${twin.id}`}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all duration-200 group"
              >
                {/* Sample outputs preview */}
                <div className="flex gap-2 mb-4">
                  {twin.sample_outputs?.slice(0, 3).map((img, i) => (
                    <img key={i} src={img.url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-100" />
                  ))}
                  {(!twin.sample_outputs || twin.sample_outputs.length === 0) && (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                      <User className="w-6 h-6 text-indigo-400" />
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{twin.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Trigger: {twin.trigger_word}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${statusInfo.color}`}>
                    <StatusIcon className={`w-3 h-3 ${twin.status === 'training' ? 'animate-spin' : ''}`} />
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{twin.training_images?.length || 0} treningsbilder</span>
                  {twin.status === 'ready' && (
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
                      <Sparkles className="w-3 h-3" />
                      Generer bilder
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
