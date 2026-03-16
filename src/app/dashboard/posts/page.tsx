'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
  draft: 'bg-gray-200 text-gray-700',
  pending_approval: 'bg-yellow-200 text-yellow-800',
  approved: 'bg-green-200 text-green-800',
  scheduled: 'bg-green-200 text-green-800',
  published: 'bg-blue-200 text-blue-800',
  rejected: 'bg-red-200 text-red-800',
  publishing: 'bg-blue-100 text-blue-600',
  failed: 'bg-red-300 text-red-900',
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

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  linkedin: '💼',
  tiktok: '🎵',
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Innlegg</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className="ml-1 opacity-75">
                ({posts.filter(p => opt.value === 'all' || p.status === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Laster...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500">Ingen innlegg funnet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/dashboard/posts/${post.id}`}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition"
            >
              {/* Image thumbnail */}
              {post.content_image_url ? (
                <img
                  src={post.content_image_url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">
                  {PLATFORM_ICONS[post.platform] || '📱'}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">
                  {post.caption || post.content_text || 'Ingen innhold'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{PLATFORM_ICONS[post.platform]} {post.platform}</span>
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
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[post.status]}`}>
                {STATUS_LABELS[post.status] || post.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
