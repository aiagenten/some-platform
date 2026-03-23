'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, TrendingUp, DollarSign, Zap } from 'lucide-react'

type UsageData = {
  total_calls: number
  total_cost: number
  by_type: Record<string, { count: number; cost: number; success: number; failed: number }>
  by_provider: Record<string, { count: number; cost: number; success: number; failed: number }>
  by_model: Record<string, { count: number; cost: number; provider: string }>
  by_org: Record<string, { count: number; cost: number }>
  by_day: Record<string, { count: number; cost: number }>
}

type Org = { id: string; name: string }

const TYPE_LABELS: Record<string, string> = {
  text_generation: '📝 Tekst',
  image_generation: '🎨 Bilde',
  video_generation: '🎬 Video',
  music_generation: '🎵 Musikk',
  overlay_render: '🖼 Overlay',
}

const TYPE_COLORS: Record<string, string> = {
  text_generation: 'bg-blue-400',
  image_generation: 'bg-purple-400',
  video_generation: 'bg-pink-400',
  music_generation: 'bg-orange-400',
  overlay_render: 'bg-emerald-400',
}

function getLast30Days(): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [orgFilter, setOrgFilter] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (orgFilter) params.set('org_id', orgFilter)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)

    const [usageRes, orgsRes] = await Promise.all([
      fetch(`/api/admin/usage?${params}`),
      orgs.length === 0 ? fetch('/api/admin/orgs') : Promise.resolve(null),
    ])

    const usageData = await usageRes.json()
    setData(usageData)

    if (orgsRes) {
      const orgsData = await orgsRes.json()
      setOrgs(orgsData.orgs || [])
    }

    setLoading(false)
  }, [orgFilter, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const last30Days = getLast30Days()
  const dayData = data?.by_day || {}
  const maxDayCount = Math.max(...last30Days.map(d => dayData[d]?.count || 0), 1)

  const topModels = Object.entries(data?.by_model || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)

  const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]))

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Fra dato</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Til dato</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Organisasjon</label>
          <select
            value={orgFilter}
            onChange={e => setOrgFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
          >
            <option value="">Alle organisasjoner</option>
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-slate-400">Laster forbruksdata...</div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-medium text-slate-500">Totale kall</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{(data?.total_calls || 0).toLocaleString('nb-NO')}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-slate-500">Estimert kostnad</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">${(data?.total_cost || 0).toFixed(4)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-slate-500">Ulike modeller</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{Object.keys(data?.by_model || {}).length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium text-slate-500">Aktive orgs</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{Object.keys(data?.by_org || {}).length}</p>
            </div>
          </div>

          {/* Time series bar chart */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Bruk siste 30 dager</h3>
            <div className="flex items-end gap-0.5 h-32">
              {last30Days.map(day => {
                const count = dayData[day]?.count || 0
                const height = maxDayCount > 0 ? Math.max((count / maxDayCount) * 100, count > 0 ? 4 : 0) : 0
                const isToday = day === new Date().toISOString().slice(0, 10)
                return (
                  <div
                    key={day}
                    className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative"
                    title={`${day}: ${count} kall`}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-indigo-500' : 'bg-indigo-300 group-hover:bg-indigo-400'}`}
                      style={{ height: `${height}%` }}
                    />
                    {/* Tooltip */}
                    {count > 0 && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {day.slice(5)}: {count}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-400">{last30Days[0]?.slice(5)}</span>
              <span className="text-xs text-slate-400">{last30Days[last30Days.length - 1]?.slice(5)}</span>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By type */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Etter type</h3>
              <div className="space-y-3">
                {Object.entries(data?.by_type || {})
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([type, stats]) => {
                    const pct = data?.total_calls ? Math.round((stats.count / data.total_calls) * 100) : 0
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700">{TYPE_LABELS[type] || type}</span>
                          <span className="text-xs text-slate-500">{stats.count} kall · ${stats.cost.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${TYPE_COLORS[type] || 'bg-slate-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                {Object.keys(data?.by_type || {}).length === 0 && (
                  <p className="text-sm text-slate-400">Ingen data</p>
                )}
              </div>
            </div>

            {/* By provider */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Etter provider</h3>
              <div className="space-y-2">
                {Object.entries(data?.by_provider || {})
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([provider, stats]) => {
                    const pct = data?.total_calls ? Math.round((stats.count / data.total_calls) * 100) : 0
                    const successRate = stats.count > 0 ? Math.round((stats.success / stats.count) * 100) : 0
                    return (
                      <div key={provider}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700">{provider}</span>
                          <span className="text-xs text-slate-500">{stats.count} · {successRate}% OK · ${stats.cost.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                {Object.keys(data?.by_provider || {}).length === 0 && (
                  <p className="text-sm text-slate-400">Ingen data</p>
                )}
              </div>
            </div>

            {/* Top models */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Topp modeller</h3>
              {topModels.length === 0 ? (
                <p className="text-sm text-slate-400">Ingen data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 text-xs font-medium text-slate-500">Modell</th>
                        <th className="text-left py-1.5 text-xs font-medium text-slate-500">Provider</th>
                        <th className="text-right py-1.5 text-xs font-medium text-slate-500">Kall</th>
                        <th className="text-right py-1.5 text-xs font-medium text-slate-500">Kostnad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topModels.map(([model, stats]) => (
                        <tr key={model} className="border-b border-slate-50">
                          <td className="py-1.5 text-slate-700 font-mono text-xs max-w-[140px] truncate">{model}</td>
                          <td className="py-1.5 text-slate-500 text-xs">{stats.provider}</td>
                          <td className="py-1.5 text-right text-slate-600">{stats.count}</td>
                          <td className="py-1.5 text-right text-slate-700 font-medium">${stats.cost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* By org */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Etter organisasjon</h3>
              {Object.keys(data?.by_org || {}).length === 0 ? (
                <p className="text-sm text-slate-400">Ingen data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 text-xs font-medium text-slate-500">Org</th>
                        <th className="text-right py-1.5 text-xs font-medium text-slate-500">Kall</th>
                        <th className="text-right py-1.5 text-xs font-medium text-slate-500">Kostnad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data?.by_org || {})
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([orgId, stats]) => (
                          <tr key={orgId} className="border-b border-slate-50">
                            <td className="py-1.5 text-slate-700 max-w-[180px] truncate">
                              {orgMap[orgId] || orgId.slice(0, 8) + '...'}
                            </td>
                            <td className="py-1.5 text-right text-slate-600">{stats.count}</td>
                            <td className="py-1.5 text-right text-slate-700 font-medium">${stats.cost.toFixed(4)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
