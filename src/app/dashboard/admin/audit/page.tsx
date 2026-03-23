'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, ChevronDown, ChevronRight, ChevronLeft, Filter, X } from 'lucide-react'

type AuditEvent = {
  id: string
  org_id: string
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_title: string | null
  changes: Record<string, unknown>
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  published: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  publishing: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  scheduled: 'bg-violet-50 text-violet-700 border-violet-200',
  deleted: 'bg-red-50 text-red-700 border-red-200',
  disconnected: 'bg-red-50 text-red-700 border-red-200',
  edited: 'bg-amber-50 text-amber-700 border-amber-200',
  updated: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-orange-50 text-orange-700 border-orange-200',
  linked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reverted_to_draft: 'bg-slate-100 text-slate-700 border-slate-200',
}

function getActionColor(action: string): string {
  const actionPart = action.split('.').pop() || ''
  return ACTION_COLORS[actionPart] || 'bg-slate-100 text-slate-600 border-slate-200'
}

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'Alle typer' },
  { value: 'post', label: 'Innlegg' },
  { value: 'media_asset', label: 'Media' },
  { value: 'brand_profile', label: 'Merkevare' },
  { value: 'social_account', label: 'Tilkobling' },
]

const PAGE_SIZE = 50

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [resourceType, setResourceType] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const supabase = createClient()

  const loadEvents = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('audit_trail')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (resourceType) query = query.eq('resource_type', resourceType)
    if (actionFilter) query = query.ilike('action', `%${actionFilter}%`)
    if (userFilter) query = query.ilike('user_email', `%${userFilter}%`)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')

    const { data, count } = await query
    setEvents(data || [])
    setTotalCount(count || 0)
    setHasMore(((page + 1) * PAGE_SIZE) < (count || 0))
    setLoading(false)
  }, [page, resourceType, actionFilter, userFilter, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadEvents() }, [loadEvents])

  const clearFilters = () => {
    setResourceType('')
    setActionFilter('')
    setUserFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }

  const hasActiveFilters = resourceType || actionFilter || userFilter || dateFrom || dateTo

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Hendelseslogg for alle endringer i systemet
        </p>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            showFilters || hasActiveFilters
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ressurstype</label>
              <select
                value={resourceType}
                onChange={(e) => { setResourceType(e.target.value); setPage(0) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                {RESOURCE_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Handling</label>
              <input
                type="text"
                placeholder="f.eks. approved, deleted..."
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(0) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bruker (e-post)</label>
              <input
                type="text"
                placeholder="Søk etter e-post..."
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setPage(0) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fra dato</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Til dato</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-3 h-3" />
              Nullstill filter
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          {totalCount} hendelse{totalCount !== 1 ? 'r' : ''} totalt
          {hasActiveFilters ? ' (filtrert)' : ''}
        </p>
        {totalCount > PAGE_SIZE && (
          <p className="text-xs text-slate-500">
            Side {page + 1} av {Math.ceil(totalCount / PAGE_SIZE)}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-slate-400">Laster hendelser...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Shield className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Ingen hendelser funnet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Tidspunkt</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Bruker</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Handling</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Ressurs</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const isExpanded = expandedId === event.id
                  const hasDetails = (event.changes && Object.keys(event.changes).length > 0) ||
                    (event.metadata && Object.keys(event.metadata).length > 0)
                  return (
                    <Fragment key={event.id}>
                      <tr
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${hasDetails ? 'cursor-pointer' : ''}`}
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : event.id)}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {hasDetails && (
                            isExpanded
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {new Date(event.created_at).toLocaleString('nb-NO', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {event.user_email || (event.user_id ? event.user_id.slice(0, 8) + '...' : 'System')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium border ${getActionColor(event.action)}`}>
                            {event.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{event.resource_type}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">
                          {event.resource_title || (event.resource_id ? event.resource_id.slice(0, 8) + '...' : '—')}
                        </td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              {event.changes && Object.keys(event.changes).length > 0 && (
                                <div>
                                  <p className="font-semibold text-slate-500 mb-1 uppercase tracking-wide">Endringer</p>
                                  <pre className="bg-white rounded-lg p-3 border border-slate-200 overflow-x-auto text-slate-700 whitespace-pre-wrap">
                                    {JSON.stringify(event.changes, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <div>
                                  <p className="font-semibold text-slate-500 mb-1 uppercase tracking-wide">Metadata</p>
                                  <pre className="bg-white rounded-lg p-3 border border-slate-200 overflow-x-auto text-slate-700 whitespace-pre-wrap">
                                    {JSON.stringify(event.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {event.resource_id && (
                                <div>
                                  <p className="font-semibold text-slate-500 mb-1 uppercase tracking-wide">Ressurs-ID</p>
                                  <code className="bg-white rounded-lg px-3 py-1 border border-slate-200 text-slate-600 text-xs">{event.resource_id}</code>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Forrige
          </button>
          <span className="text-sm text-slate-500">
            {page + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
          </span>
          <button
            onClick={() => hasMore && setPage(p => p + 1)}
            disabled={!hasMore}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Neste
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
