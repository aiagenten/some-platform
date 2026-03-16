'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type Post = {
  id: string
  content_text: string | null
  caption: string | null
  platform: string
  format: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  created_at?: string
  media_urls: string[]
  content_image_url: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  pending_approval: 'bg-yellow-200 text-yellow-800',
  approved: 'bg-green-200 text-green-800',
  scheduled: 'bg-blue-200 text-blue-800',
  published: 'bg-blue-200 text-blue-800',
  rejected: 'bg-red-200 text-red-800',
}

function useAutoResize() {
  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight
      window.parent.postMessage({ type: 'some-widget-resize', height }, '*')
    }
    sendHeight()
    const observer = new MutationObserver(sendHeight)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', sendHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sendHeight)
    }
  }, [])
}

function CalendarWidget({ posts, theme }: { posts: Post[]; theme: string }) {
  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50'

  const grouped = posts.reduce<Record<string, Post[]>>((acc, post) => {
    const date = post.scheduled_for
      ? new Date(post.scheduled_for).toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' })
      : 'Ikke planlagt'
    if (!acc[date]) acc[date] = []
    acc[date].push(post)
    return acc
  }, {})

  return (
    <div className={`${bg} p-4 rounded-lg`}>
      <h2 className="text-lg font-bold mb-4">Innholdskalender</h2>
      {Object.entries(grouped).map(([date, datePosts]) => (
        <div key={date} className="mb-4">
          <h3 className="text-sm font-semibold mb-2 capitalize">{date}</h3>
          <div className="space-y-2">
            {datePosts.map((post) => (
              <div key={post.id} className={`${cardBg} p-3 rounded-lg`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{PLATFORM_LABELS[post.platform] || post.platform}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status] || ''}`}>
                    {post.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs opacity-60">{post.format}</span>
                </div>
                <p className="text-sm line-clamp-2">{post.caption || post.content_text || '(Ingen tekst)'}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {Object.keys(grouped).length === 0 && (
        <p className="text-sm opacity-60">Ingen planlagte innlegg</p>
      )}
    </div>
  )
}

function ApprovalWidget({ posts, token, theme }: { posts: Post[]; token: string; theme: string }) {
  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50'

  const handleAction = async (postId: string, action: 'approve' | 'reject') => {
    console.log(`${action} post ${postId} with token ${token}`)
  }

  return (
    <div className={`${bg} p-4 rounded-lg`}>
      <h2 className="text-lg font-bold mb-4">Godkjenning</h2>
      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id} className={`${cardBg} p-4 rounded-lg`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">{PLATFORM_LABELS[post.platform] || post.platform}</span>
              <span className="text-xs opacity-60">{post.format}</span>
              {post.scheduled_for && (
                <span className="text-xs opacity-60">
                  {new Date(post.scheduled_for).toLocaleDateString('no-NO')}
                </span>
              )}
            </div>
            {post.content_image_url && (
              <img src={post.content_image_url} alt="" className="w-full h-40 object-cover rounded mb-2" />
            )}
            <p className="text-sm mb-3">{post.caption || post.content_text || '(Ingen tekst)'}</p>
            <div className="flex gap-2">
              <button onClick={() => handleAction(post.id, 'approve')} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition">
                Godkjenn
              </button>
              <button onClick={() => handleAction(post.id, 'reject')} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition">
                Avvis
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="text-sm opacity-60">Ingen innlegg venter på godkjenning</p>
        )}
      </div>
    </div>
  )
}

function FeedWidget({ posts, theme }: { posts: Post[]; theme: string }) {
  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50'

  return (
    <div className={`${bg} p-4 rounded-lg`}>
      <h2 className="text-lg font-bold mb-4">Publisert innhold</h2>
      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id} className={`${cardBg} p-3 rounded-lg`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">{PLATFORM_LABELS[post.platform] || post.platform}</span>
              <span className="text-xs opacity-60">{post.format}</span>
              {post.published_at && (
                <span className="text-xs opacity-60">
                  {new Date(post.published_at).toLocaleDateString('no-NO')}
                </span>
              )}
            </div>
            {post.content_image_url && (
              <img src={post.content_image_url} alt="" className="w-full h-40 object-cover rounded mb-2" />
            )}
            <p className="text-sm">{post.caption || post.content_text || '(Ingen tekst)'}</p>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="text-sm opacity-60">Ingen publiserte innlegg ennå</p>
        )}
      </div>
    </div>
  )
}

export default function EmbedPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const type = params.type as string
  const token = searchParams.get('token') || ''
  const theme = searchParams.get('theme') || 'light'

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useAutoResize()

  const fetchData = useCallback(async () => {
    if (!token) {
      setError('Mangler token')
      setLoading(false)
      return
    }
    try {
      const baseUrl = window.location.origin
      const res = await fetch(`${baseUrl}/api/embed/data?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Kunne ikke hente data')
        setLoading(false)
        return
      }
      const { data } = await res.json()
      setPosts(data || [])
    } catch {
      setError('Nettverksfeil')
    } finally {
      setLoading(false)
    }
  }, [token, type])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-center text-red-600 text-sm">{error}</div>
  }

  switch (type) {
    case 'calendar': return <CalendarWidget posts={posts} theme={theme} />
    case 'approval': return <ApprovalWidget posts={posts} token={token} theme={theme} />
    case 'feed': return <FeedWidget posts={posts} theme={theme} />
    default: return <div className="p-4 text-center text-red-600">Ukjent widget-type: {type}</div>
  }
}
