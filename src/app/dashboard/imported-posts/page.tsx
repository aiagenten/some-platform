'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Linkedin, Facebook, Instagram, Heart, MessageCircle, Share2, CheckSquare, Square, Sparkles, ExternalLink, Trash2 } from 'lucide-react'

type ImportedPost = {
  id: string
  org_id: string
  platform: string
  external_id: string | null
  text_content: string | null
  image_urls: string[]
  permalink: string | null
  likes: number
  comments: number
  shares: number
  posted_at: string | null
  is_learning_material: boolean
  imported_at: string
}

const PLATFORM_CONFIG: Record<string, { icon: typeof Linkedin; label: string; color: string; bg: string }> = {
  linkedin: { icon: Linkedin, label: 'LinkedIn', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  facebook: { icon: Facebook, label: 'Facebook', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  instagram: { icon: Instagram, label: 'Instagram', color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
}

export default function ImportedPostsPage() {
  const [posts, setPosts] = useState<ImportedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
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

      const { data } = await supabase
        .from('imported_social_posts')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('posted_at', { ascending: false })

      setPosts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggleLearning = async (postId: string, current: boolean) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_learning_material: !current } : p))

    const { error } = await supabase
      .from('imported_social_posts')
      .update({ is_learning_material: !current })
      .eq('id', postId)

    if (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_learning_material: current } : p))
    }
  }

  const selectAll = async () => {
    setPosts(prev => prev.map(p => ({ ...p, is_learning_material: true })))
    await supabase
      .from('imported_social_posts')
      .update({ is_learning_material: true })
      .eq('org_id', orgId!)
  }

  const deselectAll = async () => {
    setPosts(prev => prev.map(p => ({ ...p, is_learning_material: false })))
    await supabase
      .from('imported_social_posts')
      .update({ is_learning_material: false })
      .eq('org_id', orgId!)
  }

  const analyzeTone = async () => {
    const learningPosts = posts.filter(p => p.is_learning_material && p.text_content)
    if (learningPosts.length === 0) {
      setMessage({ type: 'error', text: 'Ingen poster valgt som læringsmateriale med tekst.' })
      return
    }

    setAnalyzing(true)
    setMessage(null)

    try {
      const formattedPosts = learningPosts.map(p => ({
        id: p.id,
        text: p.text_content,
        platform: p.platform,
        created_at: p.posted_at,
      }))

      const res = await fetch('/api/brand/analyze-tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: formattedPosts, org_id: orgId }),
      })

      const data = await res.json()
      if (data.tone_profile) {
        setMessage({ type: 'success', text: `Tone-analyse fullført! Analyserte ${learningPosts.length} poster. Gå til Merkevare-siden for å se resultatene.` })
      } else {
        setMessage({ type: 'error', text: data.error || 'Tone-analyse feilet.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Nettverksfeil ved tone-analyse.' })
    }

    setAnalyzing(false)
  }

  const deletePost = async (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    await supabase
      .from('imported_social_posts')
      .delete()
      .eq('id', postId)
  }

  const deleteNonSelected = async () => {
    const nonSelected = posts.filter(p => !p.is_learning_material)
    if (nonSelected.length === 0) return

    const confirmed = window.confirm('Er du sikker på at du vil slette alle ikke-valgte poster? Dette kan ikke angres.')
    if (!confirmed) return

    const idsToDelete = nonSelected.map(p => p.id)
    setPosts(prev => prev.filter(p => p.is_learning_material))
    await supabase
      .from('imported_social_posts')
      .delete()
      .in('id', idsToDelete)
  }

  const selectedCount = posts.filter(p => p.is_learning_material).length
  const nonSelectedCount = posts.length - selectedCount

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
          <h1 className="text-2xl font-bold text-slate-900">Importerte poster</h1>
          <p className="text-slate-500 text-sm mt-1">
            {posts.length} poster importert — {selectedCount} valgt som læringsmateriale
          </p>
        </div>
        <button
          onClick={analyzeTone}
          disabled={analyzing || selectedCount === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Analyserer...' : 'Analyser tone'}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
          <p className="text-slate-500">Ingen importerte poster ennå.</p>
          <p className="text-sm text-slate-400 mt-1">Koble til SoMe-kontoer via onboarding for å importere poster.</p>
        </div>
      ) : (
        <>
          {/* Bulk actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Velg alle
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all"
            >
              <Square className="w-3.5 h-3.5" />
              Fjern alle
            </button>
            {nonSelectedCount > 0 && (
              <button
                onClick={deleteNonSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Slett ikke-valgte ({nonSelectedCount})
              </button>
            )}
          </div>

          {/* Post grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => {
              const config = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.facebook
              const Icon = config.icon
              return (
                <div
                  key={post.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${
                    post.is_learning_material ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200/60'
                  }`}
                >
                  {/* Image/Video thumbnail */}
                  {post.image_urls && post.image_urls.length > 0 && post.image_urls[0] && (
                    <div className="h-40 bg-slate-100 overflow-hidden">
                      {/\.(mp4|mov|webm|avi)(\?|$)/i.test(post.image_urls[0]) ? (
                        <video
                          src={post.image_urls[0]}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                          onMouseEnter={(e) => e.currentTarget.play()}
                          onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                        />
                      ) : (
                        <img
                          src={post.image_urls[0]}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback: try as video if image fails to load
                            const parent = e.currentTarget.parentElement
                            if (!parent) return
                            const video = document.createElement('video')
                            video.src = post.image_urls[0]
                            video.muted = true
                            video.playsInline = true
                            video.preload = 'metadata'
                            video.className = 'w-full h-full object-cover'
                            parent.replaceChild(video, e.currentTarget)
                          }}
                        />
                      )}
                    </div>
                  )}

                  <div className="p-4">
                    {/* Platform badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg border ${config.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                        {config.label}
                      </span>
                      {post.permalink && (
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Post text */}
                    <p className="text-sm text-slate-700 line-clamp-4 mb-3 min-h-[3rem]">
                      {post.text_content || 'Ingen tekst'}
                    </p>

                    {/* Engagement metrics */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" /> {post.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" /> {post.shares}
                      </span>
                    </div>

                    {/* Date */}
                    {post.posted_at && (
                      <p className="text-xs text-slate-400 mb-3">
                        {new Date(post.posted_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}

                    {/* Learning toggle + delete */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleLearning(post.id, post.is_learning_material)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium border transition-all duration-200 ${
                          post.is_learning_material
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {post.is_learning_material ? (
                          <><CheckSquare className="w-3.5 h-3.5" /> Læringsmateriale</>
                        ) : (
                          <><Square className="w-3.5 h-3.5" /> Læringsmateriale</>
                        )}
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="flex items-center justify-center px-2.5 py-2 rounded-xl text-xs font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all duration-200"
                        title="Slett"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
