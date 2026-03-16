'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  linkedin: '💼',
  tiktok: '🎵',
}

const PLATFORMS = [
  { value: '', label: 'Alle plattformer' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'linkedin', label: '💼 LinkedIn' },
  { value: 'tiktok', label: '🎵 TikTok' },
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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Oversikt over innholdsytelse</p>
        </div>
        <div className="flex gap-3">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            {PLATFORMS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="7">Siste 7 dager</option>
            <option value="30">Siste 30 dager</option>
            <option value="90">Siste 90 dager</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Laster analytics...</div>
      ) : !data ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500">Kunne ikke hente data</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Visninger" value={formatNumber(data.totals.impressions)} icon="👁️" />
            <StatCard label="Rekkevidde" value={formatNumber(data.totals.reach)} icon="📡" />
            <StatCard label="Engasjement" value={formatNumber(data.totals.engagement)} icon="🔥" />
            <StatCard label="Likes" value={formatNumber(data.totals.likes)} icon="❤️" />
            <StatCard label="Kommentarer" value={formatNumber(data.totals.comments)} icon="💬" />
            <StatCard label="Delinger" value={formatNumber(data.totals.shares)} icon="🔄" />
          </div>

          {/* Engagement Chart (CSS bars) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-4">
              Engasjement over tid ({data.period} dager)
            </h2>
            {data.daily.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Ingen data i perioden</p>
            ) : (
              <div className="flex items-end gap-1 h-48">
                {data.daily.map((d) => {
                  const height = (d.engagement / maxDailyEngagement) * 100
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {new Date(d.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                        <br />
                        {d.engagement} engasjement
                      </div>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600 min-h-[2px]"
                        style={{ height: `${Math.max(height, 1)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            {data.daily.length > 0 && (
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{new Date(data.daily[0].date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>
                <span>{new Date(data.daily[data.daily.length - 1].date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
          </div>

          {/* Top Posts */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Beste innlegg ({data.topPosts.length})
            </h2>
            {data.topPosts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-gray-400 text-sm">Ingen publiserte innlegg med analytics enda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topPosts.map((item, i) => (
                  <div
                    key={item.post.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition cursor-pointer"
                    onClick={() => router.push(`/dashboard/posts/${item.post.id}`)}
                  >
                    {/* Rank */}
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                      {i + 1}
                    </div>
                    
                    {/* Image */}
                    {item.post.content_image_url ? (
                      <img
                        src={item.post.content_image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                        {PLATFORM_ICONS[item.post.platform] || '📝'}
                      </div>
                    )}

                    {/* Caption */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">
                        {item.post.caption?.substring(0, 80) || 'Uten tekst'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>{PLATFORM_ICONS[item.post.platform]} {item.post.platform}</span>
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

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatNumber(item.engagement)}</p>
                        <p className="text-xs text-gray-500">engasjement</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatNumber(item.impressions)}</p>
                        <p className="text-xs text-gray-500">visninger</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatNumber(item.reach)}</p>
                        <p className="text-xs text-gray-500">rekkevidde</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
