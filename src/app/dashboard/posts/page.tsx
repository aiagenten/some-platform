'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Music, Smartphone, Inbox, Trash2, Loader2 } from 'lucide-react'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  format: string
  status: string
  scheduled_for: string | null
  content_image_url: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-emerald-50 text-emerald-700',
  published: 'bg-indigo-50 text-indigo-700',
  rejected: 'bg-red-50 text-red-700',
  publishing: 'bg-blue-50 text-blue-600',
  failed: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  pending_approval: 'Venter',
  approved: 'Godkjent',
  scheduled: 'Planlagt',
  published: 'Publisert',
  rejected: 'Avvist',
  publishing: 'Publiserer',
  failed: 'Feilet',
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music,
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'draft', label: 'Utkast' },
  { value: 'pending_approval', label: 'Venter' },
  { value: 'approved', label: 'Godkjent' },
  { value: 'published', label: 'Publisert' },
  { value: 'rejected', label: 'Avvist' },
]

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      let query = supabase
        .from('social_posts')
        .select('id, content_text, caption, platform, format, status, scheduled_for, content_image_url, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data } = await query
      setPosts(data || [])
      setLoading(false)
    }
    load()
  }, [filter])

  const handleDelete = async (postId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirmDeleteId !== postId) {
      setConfirmDeleteId(postId)
      return
    }
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId))
      }
    } catch { /* ignore */ }
    setDeleteLoading(false)
    setConfirmDeleteId(null)
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Innlegg</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              filter === opt.value
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className="ml-1.5 opacity-75">
                ({posts.filter(p => opt.value === 'all' || p.status === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Laster...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Ingen innlegg funnet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => {
            const PlatformIcon = PLATFORM_ICONS[post.platform] || Smartphone
            return (
              <Link
                key={post.id}
                href={`/dashboard/posts/${post.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all duration-300 group"
              >
                {/* Image thumbnail */}
                {post.content_image_url ? (
                  <img
                    src={post.content_image_url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0">
                    <PlatformIcon className="w-6 h-6 text-slate-400" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 truncate font-medium group-hover:text-indigo-700 transition-colors">
                    {post.caption || post.content_text || 'Ingen innhold'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                    <PlatformIcon className="w-3.5 h-3.5" />
                    <span className="capitalize">{post.platform}</span>
                    <span>·</span>
                    <span>{post.format}</span>
                    {post.scheduled_for && (
                      <>
                        <span>·</span>
                        <span>{new Date(post.scheduled_for).toLocaleDateString('nb-NO')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[post.status]}`}>
                  {STATUS_LABELS[post.status] || post.status}
                </span>

                {/* Delete button for draft/rejected */}
                {(post.status === 'draft' || post.status === 'rejected') && (
                  <button
                    onClick={(e) => handleDelete(post.id, e)}
                    className={`flex-shrink-0 p-2 rounded-xl transition-all duration-200 ${
                      confirmDeleteId === post.id
                        ? 'bg-red-100 text-red-700'
                        : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                    }`}
                    title={confirmDeleteId === post.id ? 'Klikk igjen for å bekrefte' : 'Slett innlegg'}
                  >
                    {deleteLoading && confirmDeleteId === post.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
