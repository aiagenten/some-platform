'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, Radio, Flame, Heart, MessageCircle, Share2, BarChart3, FileText, Instagram, Facebook, Linkedin, Music } from 'lucide-react'

type AnalyticsData = {
  totals: {
    impressions: number
    reach: number
    engagement: number
    likes: number
    comments: number
    shares: number
  }
  daily: { date: string; engagement: number }[]
  topPosts: {
    post: {
      id: string
      caption: string
      platform: string
      format: string
      content_image_url: string | null
      published_at: string | null
    }
    engagement: number
    impressions: number
    reach: number
  }[]
  postCount: number
  period: number
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music,
}

const PLATFORMS = [
  { value: '', label: 'Alle plattformer' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
]

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [platform, setPlatform] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setLoading(true)
      const params = new URLSearchParams({ period })
      if (platform) params.set('platform', platform)

      const res = await fetch(`/api/analytics?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
      setLoading(false)
    }
    load()
  }, [period, platform])

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  const maxDailyEngagement = data?.daily?.length
    ? Math.max(...data.daily.map(d => d.engagement), 1)
    : 1

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Oversikt over innholdsytelse</p>
        </div>
        <div className="flex gap-3">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:border-slate-300 transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {PLATFORMS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-white hover:border-slate-300 transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="7">Siste 7 dager</option>
            <option value="30">Siste 30 dager</option>
            <option value="90">Siste 90 dager</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Laster analytics...</div>
      ) : !data ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Kunne ikke hente data</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Visninger" value={formatNumber(data.totals.impressions)} icon={Eye} gradient="from-blue-500 to-blue-600" />
            <StatCard label="Rekkevidde" value={formatNumber(data.totals.reach)} icon={Radio} gradient="from-violet-500 to-violet-600" />
            <StatCard label="Engasjement" value={formatNumber(data.totals.engagement)} icon={Flame} gradient="from-orange-500 to-red-500" />
            <StatCard label="Likes" value={formatNumber(data.totals.likes)} icon={Heart} gradient="from-pink-500 to-rose-500" />
            <StatCard label="Kommentarer" value={formatNumber(data.totals.comments)} icon={MessageCircle} gradient="from-indigo-500 to-purple-500" />
            <StatCard label="Delinger" value={formatNumber(data.totals.shares)} icon={Share2} gradient="from-emerald-500 to-teal-500" />
          </div>

          {/* Engagement Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-8 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">
              Engasjement over tid ({data.period} dager)
            </h2>
            {data.daily.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Ingen data i perioden</p>
            ) : (
              <div className="flex items-end gap-1 h-48">
                {data.daily.map((d) => {
                  const height = (d.engagement / maxDailyEngagement) * 100
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap z-10 shadow-lg">
                        {new Date(d.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                        <br />
                        {d.engagement} engasjement
                      </div>
                      <div
                        className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-300 hover:from-indigo-700 hover:to-indigo-500 min-h-[2px]"
                        style={{ height: `${Math.max(height, 1)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            {data.daily.length > 0 && (
              <div className="flex justify-between text-xs text-slate-400 mt-3">
                <span>{new Date(data.daily[0].date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>
                <span>{new Date(data.daily[data.daily.length - 1].date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
          </div>

          {/* Top Posts */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">
              Beste innlegg ({data.topPosts.length})
            </h2>
            {data.topPosts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Ingen publiserte innlegg med analytics enda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topPosts.map((item, i) => {
                  const PlatformIcon = PLATFORM_ICONS[item.post.platform] || FileText
                  return (
                    <div
                      key={item.post.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all duration-200 cursor-pointer"
                      onClick={() => router.push(`/dashboard/posts/${item.post.id}`)}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-600">
                        {i + 1}
                      </div>
                      
                      {item.post.content_image_url ? (
                        <img
                          src={item.post.content_image_url}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                          <PlatformIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate font-medium">
                          {item.post.caption?.substring(0, 80) || 'Uten tekst'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <PlatformIcon className="w-3.5 h-3.5" />
                          <span className="capitalize">{item.post.platform}</span>
                          <span>·</span>
                          <span>{item.post.format}</span>
                          {item.post.published_at && (
                            <>
                              <span>·</span>
                              <span>{new Date(item.post.published_at).toLocaleDateString('nb-NO')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatNumber(item.engagement)}</p>
                          <p className="text-xs text-slate-500">engasjement</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatNumber(item.impressions)}</p>
                          <p className="text-xs text-slate-500">visninger</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatNumber(item.reach)}</p>
                          <p className="text-xs text-slate-500">rekkevidde</p>
                        </div>
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

function StatCard({ label, value, icon: Icon, gradient }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; gradient: string }) {
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
