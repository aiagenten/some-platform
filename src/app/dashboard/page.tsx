'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FileText, FilePenLine, Clock, CheckCircle2, Send } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, draft: 0, pending: 0, approved: 0, published: 0 })
  const [orgName, setOrgName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('org_id, name, organizations(name)')
        .eq('id', user.id)
        .single()

      if (!profile) return
      // @ts-expect-error - joined query
      setOrgName(profile.organizations?.name || '')

      const { data: posts } = await supabase
        .from('social_posts')
        .select('status')
        .eq('org_id', profile.org_id)

      if (posts) {
        setStats({
          total: posts.length,
          draft: posts.filter(p => p.status === 'draft').length,
          pending: posts.filter(p => p.status === 'pending_approval').length,
          approved: posts.filter(p => p.status === 'approved' || p.status === 'scheduled').length,
          published: posts.filter(p => p.status === 'published').length,
        })
      }
    }
    load()
  }, [])

  const cards = [
    { label: 'Totalt', value: stats.total, icon: FileText, gradient: 'from-slate-600 to-slate-700', iconBg: 'bg-slate-500/20' },
    { label: 'Utkast', value: stats.draft, icon: FilePenLine, gradient: 'from-slate-500 to-slate-600', iconBg: 'bg-slate-400/20' },
    { label: 'Venter', value: stats.pending, icon: Clock, gradient: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-400/20' },
    { label: 'Godkjent', value: stats.approved, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-400/20' },
    { label: 'Publisert', value: stats.published, icon: Send, gradient: 'from-indigo-500 to-purple-600', iconBg: 'bg-indigo-400/20' },
  ]

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">{orgName}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.label}
              className={`bg-gradient-to-br ${c.gradient} rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
            >
              <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-3xl font-bold">{c.value}</div>
              <div className="text-sm mt-1 opacity-80">{c.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
