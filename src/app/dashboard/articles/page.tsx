'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Search, Trash2, Loader2, Globe, Clock, Edit3, Sparkles } from 'lucide-react'
import ArticleGenerateModal from '@/components/ArticleGenerateModal'

type Article = {
  id: string
  title: string
  slug: string
  status: string
  excerpt: string | null
  featured_image_url: string | null
  wordpress_post_id: number | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  published: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-blue-50 text-blue-700',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  published: 'Publisert',
  scheduled: 'Planlagt',
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadArticles()
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadArticles() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    if (search) params.set('search', search)
    const res = await fetch(`/api/articles?${params}`)
    const data = await res.json()
    setArticles(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (deleteId !== id) {
      setDeleteId(id)
      return
    }
    setDeleting(true)
    await fetch(`/api/articles/${id}`, { method: 'DELETE' })
    setArticles(articles.filter(a => a.id !== id))
    setDeleteId(null)
    setDeleting(false)
  }

  async function handleCreate() {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Uten tittel' }),
    })
    const article = await res.json()
    if (article.id) router.push(`/dashboard/articles/${article.id}`)
  }

  const filtered = search
    ? articles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Artikler</h1>
          <p className="text-sm text-slate-500 mt-1">Skriv og publiser artikler til din nettside</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generer med AI
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Ny artikkel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Søk i artikler..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadArticles()}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
          />
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {['all', 'draft', 'published', 'scheduled'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === s
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'all' ? 'Alle' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Articles list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/60">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Ingen artikler ennå</h3>
          <p className="text-sm text-slate-500 mb-4">Opprett din første artikkel for å komme i gang</p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Ny artikkel
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(article => (
            <Link
              key={article.id}
              href={`/dashboard/articles/${article.id}`}
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              {/* Thumbnail */}
              {article.featured_image_url ? (
                <img
                  src={article.featured_image_url}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-indigo-300" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="text-sm text-slate-500 truncate mt-0.5">{article.excerpt}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${STATUS_COLORS[article.status]}`}>
                    {STATUS_LABELS[article.status] || article.status}
                  </span>
                  {article.wordpress_post_id && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                      <Globe className="w-3 h-3" /> WordPress
                    </span>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(article.updated_at).toLocaleDateString('nb-NO')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="p-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                  <Edit3 className="w-4 h-4" />
                </span>
                <button
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete(article.id)
                  }}
                  disabled={deleting}
                  className={`p-2 rounded-lg transition-colors ${
                    deleteId === article.id
                      ? 'text-red-600 bg-red-50'
                      : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  {deleting && deleteId === article.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
      {/* AI Generate Modal */}
      <ArticleGenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
      />
    </div>
  )
}
