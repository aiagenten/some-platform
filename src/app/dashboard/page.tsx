'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FileText, FilePenLine, Clock, CheckCircle2, Send, Rocket, ArrowRight, Palette, Share2 } from 'lucide-react'

type OnboardingStatus = {
  hasBrand: boolean
  hasSocial: boolean
  hasPosts: boolean
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, draft: 0, pending: 0, approved: 0, published: 0 })
  const [orgName, setOrgName] = useState('')
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null)
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

      // Check onboarding status
      const [brandRes, socialRes, postsRes] = await Promise.all([
        supabase.from('brand_profiles').select('id').eq('org_id', profile.org_id).limit(1),
        supabase.from('social_accounts').select('id').eq('org_id', profile.org_id).limit(1),
        supabase.from('social_posts').select('status').eq('org_id', profile.org_id),
      ])

      const posts = postsRes.data || []
      
      setOnboarding({
        hasBrand: (brandRes.data?.length || 0) > 0,
        hasSocial: (socialRes.data?.length || 0) > 0,
        hasPosts: posts.length > 0,
      })

      setStats({
        total: posts.length,
        draft: posts.filter(p => p.status === 'draft').length,
        pending: posts.filter(p => p.status === 'pending_approval').length,
        approved: posts.filter(p => p.status === 'approved' || p.status === 'scheduled').length,
        published: posts.filter(p => p.status === 'published').length,
      })
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

      {/* Onboarding banner */}
      {onboarding && (!onboarding.hasBrand || !onboarding.hasSocial) && (
        <div className="mb-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Rocket className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold mb-1">Kom i gang med SoMe-plattformen!</h2>
              <p className="text-white/80 text-sm mb-4">Fullfør oppsett for å begynne å lage innhold automatisk.</p>
              
              <div className="space-y-2">
                {!onboarding.hasBrand && (
                  <button
                    onClick={() => router.push('/onboarding')}
                    className="flex items-center gap-3 w-full bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">Sett opp merkevaren din</p>
                      <p className="text-xs text-white/60">Logo, farger, tone of voice og målgruppe</p>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
                
                {onboarding.hasBrand && !onboarding.hasSocial && (
                  <button
                    onClick={() => router.push('/dashboard/settings')}
                    className="flex items-center gap-3 w-full bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">Koble til sosiale medier</p>
                      <p className="text-xs text-white/60">Facebook, Instagram, LinkedIn og mer</p>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
