'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, FilePenLine, Clock, CheckCircle2, Send, Rocket, ArrowRight, Calendar, BookOpen, Sparkles } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, draft: 0, pending: 0, approved: 0, published: 0 })
  const [orgName, setOrgName] = useState('')
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)
  const [upcomingPosts, setUpcomingPosts] = useState<{ id: string; caption: string; platform: string; scheduled_for: string }[]>([])
  const [recentArticles, setRecentArticles] = useState<{ id: string; title: string; status: string }[]>([])
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

      // Check onboarding completion via onboarding_progress
      const { data: progress } = await supabase
        .from('onboarding_progress')
        .select('completed_at')
        .eq('org_id', profile.org_id)
        .single()

      if (progress?.completed_at) {
        setShowOnboardingBanner(false)
      } else {
        // Fallback: if brand_profiles exists with data, onboarding was completed via old flow
        const { data: brand } = await supabase
          .from('brand_profiles')
          .select('id, tone, colors')
          .eq('org_id', profile.org_id)
          .single()
        const hasCompletedOldFlow = brand && (brand.tone || (brand.colors && (brand.colors as unknown[]).length > 0))
        setShowOnboardingBanner(!hasCompletedOldFlow)
      }

      // Load post stats
      const { data: posts } = await supabase
        .from('social_posts')
        .select('status')
        .eq('org_id', profile.org_id)

      const postList = posts || []
      setStats({
        total: postList.length,
        draft: postList.filter(p => p.status === 'draft').length,
        pending: postList.filter(p => p.status === 'pending_approval').length,
        approved: postList.filter(p => p.status === 'approved' || p.status === 'scheduled').length,
        published: postList.filter(p => p.status === 'published').length,
      })

      // Load upcoming scheduled posts
      const { data: upcoming } = await supabase
        .from('social_posts')
        .select('id, caption, content_text, platform, scheduled_for')
        .eq('org_id', profile.org_id)
        .in('status', ['approved', 'scheduled'])
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for')
        .limit(5)

      if (upcoming) setUpcomingPosts(upcoming.map(p => ({ ...p, caption: p.caption || p.content_text || 'Ingen innhold' })))

      // Load recent articles
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, status')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (articles) setRecentArticles(articles)
    }
    load()
  }, [])

  const cards = [
    { label: 'Totalt', value: stats.total, icon: FileText, bg: 'bg-purple-50', border: 'border-purple-100', iconColor: 'text-purple-600', iconBg: 'bg-purple-100', valueColor: 'text-purple-900' },
    { label: 'Utkast', value: stats.draft, icon: FilePenLine, bg: 'bg-slate-50', border: 'border-slate-100', iconColor: 'text-slate-600', iconBg: 'bg-slate-100', valueColor: 'text-slate-900' },
    { label: 'Venter', value: stats.pending, icon: Clock, bg: 'bg-amber-50', border: 'border-amber-100', iconColor: 'text-amber-600', iconBg: 'bg-amber-100', valueColor: 'text-amber-900' },
    { label: 'Godkjent', value: stats.approved, icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-100', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', valueColor: 'text-emerald-900' },
    { label: 'Publisert', value: stats.published, icon: Send, bg: 'bg-indigo-50', border: 'border-indigo-100', iconColor: 'text-indigo-600', iconBg: 'bg-indigo-100', valueColor: 'text-indigo-900' },
  ]

  const PLATFORM_LABELS: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">{orgName}</p>
      </div>

      {/* Onboarding banner */}
      {showOnboardingBanner && (
        <div className="mb-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Rocket className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold mb-1">Kom i gang med SoMe-plattformen!</h2>
              <p className="text-white/80 text-sm">Sett opp merkevaren din, koble til sosiale medier og begynn å lage innhold.</p>
            </div>
            <button
              onClick={() => router.push('/onboarding')}
              className="flex items-center gap-2 bg-white text-indigo-600 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all duration-200 cursor-pointer flex-shrink-0"
            >
              Fullfør oppsett
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats cards - light theme with readable text */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.label}
              className={`${c.bg} border ${c.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}
            >
              <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${c.iconColor}`} />
              </div>
              <div className={`text-3xl font-bold ${c.valueColor}`}>{c.value}</div>
              <div className="text-sm mt-1 text-slate-500">{c.label}</div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/generate" className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Generer innhold</p>
            <p className="text-xs text-slate-500">Lag nytt bilde og innlegg</p>
          </div>
        </Link>
        <Link href="/dashboard/approval" className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-200">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Godkjenningskø</p>
            <p className="text-xs text-slate-500">{stats.pending} venter på gjennomgang</p>
          </div>
        </Link>
        <Link href="/dashboard/calendar" className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Kalender</p>
            <p className="text-xs text-slate-500">Se planlagte innlegg</p>
          </div>
        </Link>
      </div>

      {/* Upcoming posts and recent articles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming scheduled posts */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Kommende innlegg</h3>
          </div>
          {upcomingPosts.length > 0 ? (
            <div className="space-y-3">
              {upcomingPosts.map(post => (
                <Link key={post.id} href={`/dashboard/posts/${post.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{post.caption}</p>
                    <p className="text-xs text-slate-400">
                      {PLATFORM_LABELS[post.platform] || post.platform} — {new Date(post.scheduled_for).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Ingen planlagte innlegg</p>
          )}
        </div>

        {/* Recent articles */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-slate-900">Siste artikler</h3>
          </div>
          {recentArticles.length > 0 ? (
            <div className="space-y-3">
              {recentArticles.map(article => (
                <Link key={article.id} href={`/dashboard/articles/${article.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{article.title || 'Uten tittel'}</p>
                    <p className="text-xs text-slate-400 capitalize">{article.status === 'published' ? 'Publisert' : article.status === 'draft' ? 'Utkast' : article.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">Ingen artikler ennå</p>
          )}
        </div>
      </div>
    </div>
  )
}
