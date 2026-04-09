'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Music, Smartphone, CheckCircle2, Trash2, Pencil, Loader2, PartyPopper, Calendar, XCircle, Target, MessageSquare, FileText } from 'lucide-react'
import { getOverlayTemplate, PLATFORM_DIMENSIONS } from '@/lib/overlay-templates'
import type { OverlayOptions } from '@/lib/overlay-templates'
import { resolveOverlayStyle } from '@/lib/overlay-style-resolver'
import type { BrandVisualStyle } from '@/lib/overlay-style-resolver'
import type { CustomOverlayTemplate } from '@/lib/custom-overlay-types'
import { renderCustomOverlay } from '@/lib/custom-overlay-renderer'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  format: string
  status: string
  content_image_url: string | null
  created_at: string
  selected_overlay: string | null
  suggested_time: string | null
  scheduled_for: string | null
  headline: string | null
  subtitle: string | null
}

type Article = {
  id: string
  title: string
  content: string | null
  status: string
  org_id: string
  featured_image_url: string | null
  created_at: string
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music,
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'from-pink-500 to-purple-500',
  facebook: 'from-blue-500 to-blue-600',
  linkedin: 'from-sky-500 to-sky-600',
  tiktok: 'from-slate-700 to-slate-800',
}

// Parse suggested_time for scheduled_for auto-fill at approval time
function parseScheduledFromSuggested(timeStr: string): string | null {
  const explicitMatch = timeStr.match(/\((\d{4}-\d{2}-\d{2})\)/)
  const timeMatch = timeStr.match(/kl\s*(\d{1,2}):?(\d{2})?/)
  if (explicitMatch) {
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '09'
    const min = timeMatch?.[2] || '00'
    return `${explicitMatch[1]}T${hour}:${min}:00.000Z`
  }
  return null
}

// Full overlay preview rendered on canvas — uses platform-correct aspect ratio
function FullOverlayPreview({ post, brandColors, brandFonts, brandLogoUrl, brandVisualStyle, orgName, customTemplates }: {
  post: Post
  brandColors: Array<{ hex: string; role: string }>
  brandFonts: Array<{ family: string; role: string }>
  brandLogoUrl: string | null
  brandVisualStyle?: BrandVisualStyle | null
  orgName: string
  customTemplates: CustomOverlayTemplate[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderIdRef = useRef(0)
  const [rendered, setRendered] = useState(false)

  // Determine correct dimensions based on platform
  const platformDims = PLATFORM_DIMENSIONS[post.platform] || { width: 1080, height: 1080 }
  const aspectRatio = `${platformDims.width}/${platformDims.height}`

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !post.content_image_url) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Assign a render ID to detect stale renders
    const thisRenderId = ++renderIdRef.current

    const dims = PLATFORM_DIMENSIONS[post.platform] || { width: 1080, height: 1080 }
    canvas.width = dims.width
    canvas.height = dims.height
    ctx.clearRect(0, 0, dims.width, dims.height)

    const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src
    })

    try {
      const baseImage = await loadImage(post.content_image_url!)
      if (renderIdRef.current !== thisRenderId) return // stale render, abort

      let logo: HTMLImageElement | null = null
      if (brandLogoUrl) { try { logo = await loadImage(brandLogoUrl) } catch { /* skip */ } }
      if (renderIdRef.current !== thisRenderId) return

      const primaryColor = brandColors.find(c => c.role === 'primary')?.hex || '#9933ff'
      const accentColor = brandColors.find(c => c.role === 'accent')?.hex || primaryColor
      const headingFont = brandFonts.find(f => f.role === 'heading')?.family || 'Inter'
      const bodyFont = brandFonts.find(f => f.role === 'body')?.family || headingFont

      const headline = post.headline || (() => {
        const firstLine = (post.content_text || post.caption || '').split('\n')[0].trim()
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
      })()
      const subtitle = post.subtitle || ''

      const resolvedStyle = resolveOverlayStyle(brandVisualStyle)
      const options: OverlayOptions = {
        size: Math.min(dims.width, dims.height),
        width: dims.width,
        height: dims.height,
        baseImage, logo, headline, subtitle, brandName: orgName, primaryColor, accentColor, headingFont, bodyFont, visualStyle: resolvedStyle
      }

      const overlayId = post.selected_overlay || 'modern-dark'
      const customTmpl = customTemplates.find(t => `custom-${t.id}` === overlayId)
      if (customTmpl) {
        await renderCustomOverlay(ctx, customTmpl, options)
      } else {
        await getOverlayTemplate(overlayId).render(ctx, options)
      }

      if (renderIdRef.current !== thisRenderId) return
      setRendered(true)
    } catch {
      if (renderIdRef.current === thisRenderId) setRendered(false)
    }
  }, [post.content_image_url, post.selected_overlay, post.headline, post.subtitle, post.content_text, post.caption, post.platform, brandColors, brandFonts, brandLogoUrl, brandVisualStyle, orgName, customTemplates])

  useEffect(() => { render() }, [render])

  if (!post.content_image_url) return null

  return (
    <div className="relative bg-slate-100 rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`w-full ${rendered ? '' : 'hidden'}`}
        style={{ aspectRatio }}
      />
      {!rendered && (
        <img src={post.content_image_url} alt="" className="w-full" style={{ aspectRatio, objectFit: 'cover' }} />
      )}
    </div>
  )
}

export default function ApprovalPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('09:00')
  const [brandColors, setBrandColors] = useState<Array<{ hex: string; role: string }>>([])
  const [brandFonts, setBrandFonts] = useState<Array<{ family: string; role: string }>>([])
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [brandVisualStyle, setBrandVisualStyle] = useState<BrandVisualStyle | null>(null)
  const [orgName, setOrgName] = useState('')
  const [customTemplates, setCustomTemplates] = useState<CustomOverlayTemplate[]>([])
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [weeklyGoals, setWeeklyGoals] = useState<{ platform: string; weekly_target: number }[]>([])
  const [weeklyPostCounts, setWeeklyPostCounts] = useState<Record<string, number>>({})
  const supabase = createClient()

  useEffect(() => { loadPosts() }, [])

  async function loadPosts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
    if (!profile) return

    const { data: org } = await supabase.from('organizations').select('name, logo_url').eq('id', profile.org_id).single()
    if (org) setOrgName(org.name)

    const { data: bp } = await supabase.from('brand_profiles').select('logo_url, colors, fonts, visual_style')
      .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).single()
    if (bp) {
      setBrandColors(bp.colors || [])
      setBrandFonts(bp.fonts || [])
      setBrandLogoUrl(bp.logo_url)
      setBrandVisualStyle(bp.visual_style as BrandVisualStyle | null)
    }

    try {
      const res = await fetch('/api/overlay-templates')
      if (res.ok) setCustomTemplates(await res.json())
    } catch { /* ignore */ }

    const { data } = await supabase
      .from('social_posts')
      .select('id, content_text, caption, platform, format, status, content_image_url, created_at, selected_overlay, suggested_time, scheduled_for, headline, subtitle')
      .eq('org_id', profile.org_id)
      .in('status', ['pending_approval', 'draft'])
      .order('created_at', { ascending: false })

    setPosts(data || [])

    // Load draft articles for approval
    const { data: articleData } = await supabase
      .from('articles')
      .select('id, title, content, status, org_id, featured_image_url, created_at')
      .eq('org_id', profile.org_id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })

    setArticles(articleData || [])

    // Load weekly goals
    const { data: goals } = await supabase
      .from('weekly_posting_goals')
      .select('platform, weekly_target')
      .eq('org_id', profile.org_id)
    if (goals) setWeeklyGoals(goals)

    // Count posts scheduled/approved this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)
    const { data: weekPosts } = await supabase
      .from('social_posts')
      .select('platform')
      .eq('org_id', profile.org_id)
      .in('status', ['approved', 'scheduled', 'published'])
      .gte('created_at', weekStart.toISOString())
    if (weekPosts) {
      const counts: Record<string, number> = {}
      weekPosts.forEach(p => { counts[p.platform] = (counts[p.platform] || 0) + 1 })
      setWeeklyPostCounts(counts)
    }

    setLoading(false)
  }

  const handleApprove = async (postId: string) => {
    setActionLoadingId(postId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const post = posts.find(p => p.id === postId)
    let scheduledFor = post?.scheduled_for || null
    if (!scheduledFor && post?.suggested_time) {
      scheduledFor = parseScheduledFromSuggested(post.suggested_time)
    }

    const updates: Record<string, unknown> = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }
    if (scheduledFor) updates.scheduled_for = scheduledFor

    await supabase.from('social_posts').update(updates).eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    setActionLoadingId(null)
  }

  const handleReject = async (postId: string) => {
    if (!rejectionReason.trim()) return
    setActionLoadingId(postId)
    await supabase.from('social_posts').update({
      status: 'draft',
      rejection_reason: rejectionReason.trim(),
    }).eq('id', postId)
    // Save learning
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (profile) {
        await supabase.from('content_learnings').insert({
          tenant_id: profile.org_id,
          learning_type: 'rejection_reason',
          description: rejectionReason.trim(),
          source_post_id: postId,
        })
      }
    }
    setPosts(prev => prev.filter(p => p.id !== postId))
    setActionLoadingId(null)
    setRejectingId(null)
    setRejectionReason('')
  }

  const handleDiscard = async (postId: string) => {
    setActionLoadingId(postId)
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
      if (res.ok) setPosts(prev => prev.filter(p => p.id !== postId))
    } catch { /* ignore */ }
    setActionLoadingId(null)
    setConfirmDeleteId(null)
  }

  const handleDateSave = async (postId: string) => {
    if (!editDate) return
    const scheduledFor = `${editDate}T${editTime}:00.000Z`
    await supabase.from('social_posts').update({ scheduled_for: scheduledFor }).eq('id', postId)
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduled_for: scheduledFor } : p))
    setEditingDateId(null)
  }

  const handleApproveArticle = async (articleId: string) => {
    setActionLoadingId(articleId)
    await supabase.from('articles').update({ status: 'approved' }).eq('id', articleId)
    setArticles(prev => prev.filter(a => a.id !== articleId))
    setActionLoadingId(null)
  }

  const startEditDate = (post: Post) => {
    const existing = post.scheduled_for ? new Date(post.scheduled_for) : null
    setEditDate(existing ? existing.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    setEditTime(existing ? existing.toISOString().slice(11, 16) : '09:00')
    setEditingDateId(post.id)
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Godkjenning</h1>
          <p className="text-slate-500 text-sm mt-1">
            {(posts.length + articles.length) > 0
              ? `${posts.length + articles.length} element${posts.length + articles.length !== 1 ? 'er' : ''} venter på gjennomgang`
              : 'Ingen innlegg å gjennomgå'}
          </p>
        </div>
      </div>

      {/* Weekly Goals */}
      {weeklyGoals.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Ukentlig mål</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {weeklyGoals.map(goal => {
              const count = weeklyPostCounts[goal.platform] || 0
              const pct = Math.min((count / goal.weekly_target) * 100, 100)
              return (
                <div key={goal.platform} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600 capitalize">{goal.platform}</span>
                    <span className="text-xs text-slate-400">{count}/{goal.weekly_target}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {posts.length === 0 && articles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <PartyPopper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600">Ingen innlegg venter på godkjenning 🎉</p>
          <p className="text-sm text-slate-400 mt-2">Alt er oppdatert. Nye innlegg vil dukke opp her.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => {
            const PlatformIcon = PLATFORM_ICONS[post.platform] || Smartphone
            const platformGradient = PLATFORM_COLORS[post.platform] || 'from-slate-500 to-slate-600'
            const isLoading = actionLoadingId === post.id
            const isConfirmingDelete = confirmDeleteId === post.id

            const scheduledDate = post.scheduled_for
              ? new Date(post.scheduled_for).toLocaleString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
              : post.suggested_time || null

            return (
              <div key={post.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  {/* Left: Full overlay preview */}
                  <div className="lg:w-[480px] flex-shrink-0 p-4">
                    <FullOverlayPreview
                      post={post}
                      brandColors={brandColors}
                      brandFonts={brandFonts}
                      brandLogoUrl={brandLogoUrl}
                      brandVisualStyle={brandVisualStyle}
                      orgName={orgName}
                      customTemplates={customTemplates}
                    />
                  </div>

                  {/* Right: Info + Actions */}
                  <div className="flex-1 p-6 flex flex-col">
                    {/* Platform + Status */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platformGradient} flex items-center justify-center`}>
                        <PlatformIcon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{PLATFORM_LABELS[post.platform] || post.platform}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        post.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {post.status === 'draft' ? 'Utkast' : 'Venter'}
                      </span>
                    </div>

                    {/* Post text */}
                    <p className="text-sm text-slate-800 leading-relaxed line-clamp-6 mb-4">
                      {post.caption || post.content_text || 'Ingen innhold'}
                    </p>

                    {/* Scheduled date with edit */}
                    <div className="mb-4">
                      {editingDateId === post.id ? (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="flex-1 text-sm bg-white border border-indigo-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            />
                            <input
                              type="time"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-24 text-sm bg-white border border-indigo-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleDateSave(post.id)} className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700">Lagre dato</button>
                            <button onClick={() => setEditingDateId(null)} className="px-3 py-1.5 bg-white text-slate-500 rounded-lg text-xs hover:bg-slate-50 border border-slate-200">Avbryt</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditDate(post)}
                          className="flex items-center gap-2 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl transition-colors border border-indigo-100 w-full text-left"
                        >
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">
                            {scheduledDate || 'Velg publiseringsdato'}
                          </span>
                          <Pencil className="w-3 h-3 opacity-50" />
                        </button>
                      )}
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Actions */}
                    {rejectingId === post.id ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                          <p className="text-xs font-medium text-amber-800">Avvisningsgrunn</p>
                        </div>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Beskriv hvorfor innlegget avvises..."
                          rows={2}
                          className="w-full text-sm bg-white border border-amber-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleReject(post.id)} disabled={isLoading || !rejectionReason.trim()}
                            className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1">
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            Avvis
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectionReason('') }}
                            className="flex-1 bg-white text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 border border-slate-200">
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : isConfirmingDelete ? (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs text-red-700 mb-2 font-medium">Er du sikker? Innlegget slettes permanent.</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleDiscard(post.id)} disabled={isLoading}
                            className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1">
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Ja, slett
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 bg-white text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 border border-slate-200">
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button onClick={() => handleApprove(post.id)} disabled={isLoading}
                          className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Godkjenn og planlegg
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => setRejectingId(post.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all border border-slate-200">
                            <XCircle className="w-3.5 h-3.5" />
                            Avvis
                          </button>
                          <Link href={`/dashboard/posts/${post.id}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200">
                            <Pencil className="w-3.5 h-3.5" />
                            Rediger
                          </Link>
                          <button onClick={() => setConfirmDeleteId(post.id)} disabled={isLoading}
                            className="px-4 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all border border-slate-200">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Articles section separator */}
          {articles.length > 0 && (
            <>
              {posts.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-medium text-slate-500">Artikler</span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )}
              {articles.map((article) => {
                const isLoading = actionLoadingId === article.id
                return (
                  <div key={article.id} className="bg-white rounded-2xl border border-violet-200/60 shadow-sm overflow-hidden">
                    <div className="flex flex-col sm:flex-row">
                      {/* Featured image */}
                      {article.featured_image_url && (
                        <div className="sm:w-48 flex-shrink-0">
                          <img
                            src={article.featured_image_url}
                            alt=""
                            className="w-full h-36 sm:h-full object-cover"
                          />
                        </div>
                      )}
                      {/* Content + Actions */}
                      <div className="flex-1 p-6 flex flex-col">
                        {/* Badge + title */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-50 text-violet-700 border border-violet-100">
                                Artikkel
                              </span>
                              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                                Utkast
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                              {article.title || 'Uten tittel'}
                            </h3>
                          </div>
                        </div>

                        {/* Content preview */}
                        {article.content && (
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-4">
                            {article.content.replace(/<[^>]*>/g, '').substring(0, 200)}
                          </p>
                        )}

                        <div className="flex-1" />

                        {/* Actions */}
                        <div className="space-y-2">
                          <button
                            onClick={() => handleApproveArticle(article.id)}
                            disabled={isLoading}
                            className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Godkjenn artikkel
                          </button>
                          <Link
                            href={`/dashboard/articles/${article.id}`}
                            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all border border-slate-200"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Rediger artikkel
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
