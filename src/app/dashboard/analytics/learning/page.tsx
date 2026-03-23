'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Brain,
  Lightbulb,
  BookOpen,
  AlertTriangle,
  Palette,
  MessageSquare,
  Layout,
  Clock,
  Hash,
} from 'lucide-react'

type SocialPost = {
  id: string
  status: string
  rejection_reason: string | null
  created_at: string
  selected_overlay: string | null
  org_id: string
}

type BrandLearning = {
  id: string
  org_id: string
  learning_type: string
  rule: string
  source: string
  source_post_id: string | null
  confidence: number
  active: boolean
  created_at: string
}

type WeekData = {
  label: string
  approved: number
  rejected: number
}

type RejectionGroup = {
  reason: string
  count: number
}

const LEARNING_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  style: Palette,
  tone: MessageSquare,
  topic: Hash,
  format: Layout,
  timing: Clock,
}

const LEARNING_TYPE_LABELS: Record<string, string> = {
  style: 'Stil',
  tone: 'Tone',
  topic: 'Tema',
  format: 'Format',
  timing: 'Timing',
}

const SOURCE_LABELS: Record<string, string> = {
  rejection: 'Avvisning',
  edit: 'Redigering',
  analytics: 'Analyse',
}

export default function LearningLoopPage() {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [learnings, setLearnings] = useState<BrandLearning[]>([])
  const [, setOrgId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile) return
      setOrgId(profile.org_id)

      // Load all social posts for the org
      const { data: postsData } = await supabase
        .from('social_posts')
        .select('id, status, rejection_reason, created_at, selected_overlay, org_id')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      setPosts(postsData || [])

      // Load brand learnings
      const { data: learningsData } = await supabase
        .from('brand_learnings')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      setLearnings(learningsData || [])
      setLoading(false)
    }
    load()
  }, [])

  // Computed stats
  const totalPosts = posts.length
  const approvedPosts = posts.filter(p =>
    p.status === 'approved' || p.status === 'published' || p.status === 'scheduled'
  )
  const rejectedPosts = posts.filter(p => p.rejection_reason != null)
  const approvalRate = totalPosts > 0
    ? Math.round((approvedPosts.length / totalPosts) * 100)
    : 0

  // Weekly chart data (last 30 days)
  const weeklyData = (() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentPosts = posts.filter(p => new Date(p.created_at) >= thirtyDaysAgo)

    const weeks: WeekData[] = []
    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
      const weekPosts = recentPosts.filter(p => {
        const d = new Date(p.created_at)
        return d >= weekStart && d < weekEnd
      })
      weeks.unshift({
        label: `${weekStart.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`,
        approved: weekPosts.filter(p =>
          p.status === 'approved' || p.status === 'published' || p.status === 'scheduled'
        ).length,
        rejected: weekPosts.filter(p => p.rejection_reason != null).length,
      })
    }
    return weeks
  })()

  const maxWeekly = Math.max(...weeklyData.map(w => w.approved + w.rejected), 1)

  // Rejection reasons grouped
  const rejectionGroups = (() => {
    const groups: Record<string, number> = {}
    rejectedPosts.forEach(p => {
      if (p.rejection_reason) {
        const reason = p.rejection_reason.trim()
        groups[reason] = (groups[reason] || 0) + 1
      }
    })
    return Object.entries(groups)
      .map(([reason, count]): RejectionGroup => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  })()

  // Most used overlay template
  const overlayUsage = (() => {
    const counts: Record<string, number> = {}
    posts.forEach(p => {
      if (p.selected_overlay) {
        counts[p.selected_overlay] = (counts[p.selected_overlay] || 0) + 1
      }
    })
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
    return sorted.length > 0 ? sorted[0][0] : null
  })()

  // Learnings grouped by type
  const learningsByType = (() => {
    const grouped: Record<string, BrandLearning[]> = {}
    learnings.forEach(l => {
      if (!grouped[l.learning_type]) grouped[l.learning_type] = []
      grouped[l.learning_type].push(l)
    })
    return grouped
  })()

  return (
    <div className="animate-fade-in-up">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Analytics
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laeringsloop</h1>
          <p className="text-slate-500 text-sm mt-1">
            Analyser innholdsytelse og laer fra godkjenninger
          </p>
        </div>
        <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Brain className="w-6 h-6 text-white" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Laster laeringsdata...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              label="Totalt innlegg"
              value={totalPosts}
              icon={FileText}
              gradient="from-blue-500 to-blue-600"
            />
            <SummaryCard
              label="Godkjente"
              value={approvedPosts.length}
              icon={CheckCircle2}
              gradient="from-emerald-500 to-emerald-600"
            />
            <SummaryCard
              label="Avviste"
              value={rejectedPosts.length}
              icon={XCircle}
              gradient="from-red-500 to-red-600"
            />
            <SummaryCard
              label="Godkjenningsrate"
              value={`${approvalRate}%`}
              icon={TrendingUp}
              gradient="from-violet-500 to-purple-600"
            />
          </div>

          {/* Approval/Rejection Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-8 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-1">
              Godkjenninger vs. avvisninger
            </h2>
            <p className="text-xs text-slate-400 mb-6">Siste 30 dager, per uke</p>

            {weeklyData.every(w => w.approved === 0 && w.rejected === 0) ? (
              <p className="text-slate-400 text-sm text-center py-8">Ingen data i perioden</p>
            ) : (
              <div className="space-y-4">
                {weeklyData.map((week, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-36 text-xs text-slate-500 shrink-0 text-right">
                      {week.label}
                    </div>
                    <div className="flex-1 flex items-center gap-1 h-8">
                      {week.approved > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg transition-all duration-500 flex items-center justify-center min-w-[24px]"
                          style={{ width: `${(week.approved / maxWeekly) * 100}%` }}
                        >
                          <span className="text-xs font-medium text-white">{week.approved}</span>
                        </div>
                      )}
                      {week.rejected > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-lg transition-all duration-500 flex items-center justify-center min-w-[24px]"
                          style={{ width: `${(week.rejected / maxWeekly) * 100}%` }}
                        >
                          <span className="text-xs font-medium text-white">{week.rejected}</span>
                        </div>
                      )}
                      {week.approved === 0 && week.rejected === 0 && (
                        <div className="h-full bg-slate-100 rounded-lg w-4" />
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 mt-2 ml-40">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-xs text-slate-500">Godkjent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span className="text-xs text-slate-500">Avvist</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rejection Reasons */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-900">Vanligste avvisningsgrunner</h2>
            </div>

            {rejectionGroups.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Ingen avvisninger registrert</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rejectionGroups.map((group, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center text-xs font-bold text-red-600 shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700 flex-1 leading-relaxed">
                      {group.reason}
                    </p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 shrink-0">
                      {group.count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per Brand Insights */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-900">Merkevareinnsikt</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Totalt innlegg</p>
                <p className="text-2xl font-bold text-slate-900">{totalPosts}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Godkjenningsrate</p>
                <p className="text-2xl font-bold text-slate-900">{approvalRate}%</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Mest brukt overlay</p>
                <p className="text-lg font-semibold text-slate-900 truncate">
                  {overlayUsage || 'Ingen'}
                </p>
              </div>
            </div>

            {learnings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                  Aktive laeringer: {learnings.filter(l => l.active).length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(learningsByType).map(([type, items]) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700"
                    >
                      {LEARNING_TYPE_LABELS[type] || type}
                      <span className="bg-indigo-200 text-indigo-800 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {items.length}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Learnings List */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-slate-900">
                Laeringer ({learnings.length})
              </h2>
            </div>

            {learnings.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Ingen laeringer enda</p>
                <p className="text-slate-400 text-xs mt-1">
                  Laeringer genereres automatisk fra avvisninger, redigeringer og hoeyt engasjement
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(learningsByType).map(([type, items]) => {
                  const TypeIcon = LEARNING_TYPE_ICONS[type] || Lightbulb
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-3">
                        <TypeIcon className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          {LEARNING_TYPE_LABELS[type] || type}
                        </h3>
                        <span className="text-xs text-slate-400">({items.length})</span>
                      </div>
                      <div className="space-y-2 ml-6">
                        {items.map(learning => (
                          <div
                            key={learning.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                              learning.active
                                ? 'border-slate-100 bg-white hover:border-indigo-200'
                                : 'border-slate-100 bg-slate-50 opacity-60'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800 leading-relaxed">
                                {learning.rule}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  learning.source === 'rejection'
                                    ? 'bg-red-50 text-red-600'
                                    : learning.source === 'edit'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {SOURCE_LABELS[learning.source] || learning.source}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Konfidens: {Math.round(learning.confidence * 100)}%
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(learning.created_at).toLocaleDateString('nb-NO', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                {!learning.active && (
                                  <span className="text-[10px] text-slate-400 italic">Inaktiv</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
      <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-3 shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
