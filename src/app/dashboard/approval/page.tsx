'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Music, Smartphone, CheckCircle2, Trash2, Pencil, Loader2, PartyPopper } from 'lucide-react'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  format: string
  status: string
  content_image_url: string | null
  created_at: string
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music,
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'from-pink-500 to-purple-500',
  facebook: 'from-blue-500 to-blue-600',
  linkedin: 'from-sky-500 to-sky-600',
  tiktok: 'from-slate-700 to-slate-800',
}

export default function ApprovalPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) return

    const { data } = await supabase
      .from('social_posts')
      .select('id, content_text, caption, platform, format, status, content_image_url, created_at')
      .eq('org_id', profile.org_id)
      .in('status', ['pending_approval', 'draft'])
      .order('created_at', { ascending: false })

    setPosts(data || [])
    setLoading(false)
  }

  const handleApprove = async (postId: string) => {
    setActionLoadingId(postId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('social_posts')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('id', postId)

    setPosts(prev => prev.filter(p => p.id !== postId))
    setActionLoadingId(null)
  }

  const handleDiscard = async (postId: string) => {
    setActionLoadingId(postId)
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId))
      }
    } catch { /* ignore */ }
    setActionLoadingId(null)
    setConfirmDeleteId(null)
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Godkjenning</h1>
          <p className="text-slate-500 text-sm mt-1">
            {posts.length > 0
              ? `${posts.length} innlegg venter på gjennomgang`
              : 'Ingen innlegg å gjennomgå'}
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <PartyPopper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600">Ingen innlegg venter på godkjenning 🎉</p>
          <p className="text-sm text-slate-400 mt-2">Alt er oppdatert. Nye innlegg vil dukke opp her.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => {
            const PlatformIcon = PLATFORM_ICONS[post.platform] || Smartphone
            const platformGradient = PLATFORM_COLORS[post.platform] || 'from-slate-500 to-slate-600'
            const isLoading = actionLoadingId === post.id
            const isConfirmingDelete = confirmDeleteId === post.id

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Image or platform header */}
                {post.content_image_url ? (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={post.content_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platformGradient} flex items-center justify-center shadow-lg`}>
                        <PlatformIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium backdrop-blur-sm ${
                        post.status === 'draft' ? 'bg-slate-900/60 text-white' : 'bg-amber-500/90 text-white'
                      }`}>
                        {post.status === 'draft' ? 'Utkast' : 'Venter'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`h-24 bg-gradient-to-br ${platformGradient} flex items-center justify-center relative`}>
                    <PlatformIcon className="w-10 h-10 text-white/30" />
                    <div className="absolute top-3 right-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        post.status === 'draft' ? 'bg-white/20 text-white' : 'bg-amber-400/90 text-white'
                      }`}>
                        {post.status === 'draft' ? 'Utkast' : 'Venter'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-sm text-slate-800 line-clamp-3 flex-1">
                    {post.caption || post.content_text || 'Ingen innhold'}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                    <span className="capitalize">{post.platform}</span>
                    <span>·</span>
                    <span>{post.format}</span>
                    <span>·</span>
                    <span>{new Date(post.created_at).toLocaleDateString('nb-NO')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 space-y-2">
                  {isConfirmingDelete ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs text-red-700 mb-2 font-medium">Er du sikker? Innlegget slettes permanent.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDiscard(post.id)}
                          disabled={isLoading}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Ja, slett
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 bg-white text-slate-600 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all border border-slate-200"
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(post.id)}
                          disabled={isLoading}
                          className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Godkjenn
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(post.id)}
                          disabled={isLoading}
                          className="px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-all duration-200 disabled:opacity-50 border border-red-100"
                          title="Forkast"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Link
                        href={`/dashboard/posts/${post.id}`}
                        className="flex items-center justify-center gap-1.5 w-full py-2 text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rediger
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
