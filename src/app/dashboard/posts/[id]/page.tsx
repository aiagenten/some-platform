'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import PlatformPreview from '@/components/PlatformPreview'
import { Instagram, Facebook, Linkedin, Music, Smartphone, CheckCircle2, RefreshCw, Send, Loader2, Clock, AlertCircle, Check, X as XIcon, Pencil, Sparkles, Layout, Download, Calendar } from 'lucide-react'
import { OVERLAY_TEMPLATES, getOverlayTemplate } from '@/lib/overlay-templates'
import type { OverlayOptions } from '@/lib/overlay-templates'
import type { CustomOverlayTemplate } from '@/lib/custom-overlay-types'
import { renderCustomOverlay } from '@/lib/custom-overlay-renderer'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  format: string
  status: string
  scheduled_for: string | null
  content_image_url: string | null
  content_video_url: string | null
  hashtags: string[]
  media_urls: string[]
  ai_generated: boolean
  ai_prompt: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  published_at: string | null
  published_id: string | null
  created_at: string
  updated_at: string
}

type Feedback = {
  id: string
  action: string
  comment: string | null
  rejection_reason: string | null
  created_at: string
  given_by: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-emerald-50 text-emerald-700',
  published: 'bg-indigo-50 text-indigo-700',
  rejected: 'bg-red-50 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  pending_approval: 'Venter på godkjenning',
  approved: 'Godkjent',
  scheduled: 'Planlagt',
  published: 'Publisert',
  rejected: 'Avvist',
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music,
}

export default function PostDetailPage() {
  const params = useParams()
  const postId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [post, setPost] = useState<Post | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgLogo, setOrgLogo] = useState<string | null>(null)
  const [selectedOverlay, setSelectedOverlay] = useState('modern-dark')
  const [brandColors, setBrandColors] = useState<Array<{hex: string; role: string}>>([])
  const [brandFonts, setBrandFonts] = useState<Array<{family: string; role: string}>>([])
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [customTemplates, setCustomTemplates] = useState<CustomOverlayTemplate[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.org_id)
        const { data: org } = await supabase.from('organizations').select('name, logo_url').eq('id', profile.org_id).single()
        if (org) { setOrgName(org.name); setOrgLogo(org.logo_url) }
        // Load brand profile for overlay
        const { data: bp } = await supabase.from('brand_profiles').select('logo_url, colors, fonts')
          .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).single()
        if (bp) {
          setBrandColors(bp.colors || [])
          setBrandFonts(bp.fonts || [])
          setBrandLogoUrl(bp.logo_url)
        }
      }

      // Load custom overlay templates
      try {
        const res = await fetch('/api/overlay-templates')
        if (res.ok) {
          const customData = await res.json()
          setCustomTemplates(customData)
        }
      } catch { /* ignore */ }

      const { data: postData } = await supabase.from('social_posts').select('*').eq('id', postId).single()
      if (postData) setPost(postData)

      const { data: feedbackData } = await supabase
        .from('content_feedback')
        .select('id, action, comment, rejection_reason, created_at, given_by')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
      if (feedbackData) setFeedback(feedbackData)
      setLoading(false)
    }
    load()
  }, [postId])

  // Overlay rendering for post image
  const renderPostOverlay = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !post?.content_image_url || brandColors.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = 1080
    canvas.width = size
    canvas.height = size

    const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src
    })

    try {
      const baseImage = await loadImage(post.content_image_url!)
      let logo: HTMLImageElement | null = null
      if (brandLogoUrl) { try { logo = await loadImage(brandLogoUrl) } catch { /* skip */ } }

      const primaryColor = brandColors.find(c => c.role === 'primary')?.hex || '#9933ff'
      const accentColor = brandColors.find(c => c.role === 'accent')?.hex || primaryColor
      const headingFont = brandFonts.find(f => f.role === 'heading')?.family || 'Inter'
      const bodyFont = brandFonts.find(f => f.role === 'body')?.family || headingFont

      // Extract headline from post text (first line, short)
      const firstLine = (post.content_text || post.caption || '').split('\n')[0].trim()
      const headline = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine

      const options: OverlayOptions = { size, baseImage, logo, headline, subtitle: '', brandName: orgName, primaryColor, accentColor, headingFont, bodyFont }

      // Check if it's a custom template
      const customTmpl = customTemplates.find(t => `custom-${t.id}` === selectedOverlay)
      if (customTmpl) {
        await renderCustomOverlay(ctx, customTmpl, options)
      } else {
        await getOverlayTemplate(selectedOverlay).render(ctx, options)
      }
    } catch (err) { console.error('Overlay error:', err) }
  }, [post?.content_image_url, brandColors, brandFonts, brandLogoUrl, orgName, selectedOverlay, post?.content_text, post?.caption, customTemplates])

  useEffect(() => { renderPostOverlay() }, [renderPostOverlay, selectedOverlay])

  const handleDownloadOverlay = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `post-${post?.id || 'image'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleApprove = async (withSchedule = false) => {
    if (!post || !userId || !orgId) return
    setActionLoading(true)

    const updates: Record<string, unknown> = {
      status: withSchedule && scheduleDate ? 'scheduled' : 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    }

    if (withSchedule && scheduleDate) {
      updates.scheduled_for = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    }

    await supabase.from('social_posts').update(updates).eq('id', post.id)
    await supabase.from('content_feedback').insert({
      post_id: post.id, org_id: orgId, given_by: userId, action: 'approved',
      comment: withSchedule && scheduleDate ? `Planlagt til ${scheduleDate} kl ${scheduleTime}` : 'Godkjent',
    })
    setPost({ ...post, ...updates } as Post)
    setShowSchedule(false)
    setActionLoading(false)
  }

  const handleReject = async () => {
    if (!post || !userId || !orgId || !rejectComment.trim()) return
    setActionLoading(true)
    await supabase.from('social_posts').update({ status: 'rejected', rejection_reason: rejectComment }).eq('id', post.id)
    await supabase.from('content_feedback').insert({
      post_id: post.id, org_id: orgId, given_by: userId, action: 'rejected', rejection_reason: rejectComment, comment: rejectComment,
    })
    setPost({ ...post, status: 'rejected', rejection_reason: rejectComment })
    setShowRejectForm(false)
    setRejectComment('')
    setActionLoading(false)
  }

  const handlePublish = async () => {
    if (!post) return
    setPublishLoading(true)
    try {
      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setPost({ ...post, status: 'publishing' })
        setTimeout(async () => {
          const { data: updated } = await supabase.from('social_posts').select('*').eq('id', post.id).single()
          if (updated) setPost(updated)
        }, 5000)
      } else {
        alert(data.error || 'Publisering feilet')
      }
    } catch { alert('Nettverksfeil') } finally { setPublishLoading(false) }
  }

  const handleRegenerate = async () => {
    if (!post) return
    setActionLoading(true)
    await supabase.from('social_posts').update({ status: 'draft' }).eq('id', post.id)
    setPost({ ...post, status: 'draft' })
    setActionLoading(false)
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Laster...</div>

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Innlegg ikke funnet</p>
        <Link href="/dashboard/posts" className="text-indigo-600 hover:underline mt-2 inline-block">← Tilbake til innlegg</Link>
      </div>
    )
  }

  const PlatformIcon = PLATFORM_ICONS[post.platform] || Smartphone

  return (
    <div className="animate-fade-in-up">
      <Link href="/dashboard/posts" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors">
        <span>←</span> Tilbake til innlegg
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                  <PlatformIcon className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 capitalize">{post.platform} · {post.format}</h2>
                  {post.scheduled_for && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Planlagt: {new Date(post.scheduled_for).toLocaleString('nb-NO')}
                    </p>
                  )}
                </div>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[post.status]}`}>
                {STATUS_LABELS[post.status] || post.status}
              </span>
            </div>

            <div className="prose prose-sm max-w-none">
              {post.caption && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-1.5">Tekst</h3>
                  <p className="text-slate-900 whitespace-pre-wrap">{post.caption}</p>
                </div>
              )}
              {post.content_text && post.content_text !== post.caption && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-1.5">Innhold</h3>
                  <p className="text-slate-900 whitespace-pre-wrap">{post.content_text}</p>
                </div>
              )}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {post.hashtags.map((tag, i) => (
                    <span key={i} className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {post.ai_generated && (
              <div className="mt-4 px-4 py-3 bg-purple-50 rounded-xl text-xs text-purple-700 flex items-center gap-2 border border-purple-100">
                <Sparkles className="w-4 h-4" />
                AI-generert innlegg
                {post.ai_prompt && <span className="block mt-1 opacity-75">Prompt: {post.ai_prompt}</span>}
              </div>
            )}
          </div>

          {(post.content_image_url || (post.media_urls && post.media_urls.length > 0)) && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-500">Bilde med merkevare</h3>
                {post.content_image_url && (
                  <button onClick={handleDownloadOverlay} className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 border border-emerald-100">
                    <Download className="w-3 h-3" /> Last ned
                  </button>
                )}
              </div>

              {/* Overlay canvas */}
              {post.content_image_url && (
                <div className="space-y-3">
                  <canvas ref={canvasRef} className="w-full rounded-xl shadow-sm border border-slate-200" style={{ aspectRatio: '1/1' }} />

                  {/* Overlay selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Layout className="w-3.5 h-3.5 text-slate-400" />
                    {OVERLAY_TEMPLATES.map((tmpl) => (
                      <button key={tmpl.id} onClick={() => setSelectedOverlay(tmpl.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedOverlay === tmpl.id ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                        {tmpl.name}
                      </button>
                    ))}
                    {customTemplates.length > 0 && (
                      <>
                        <span className="text-slate-300 text-xs">|</span>
                        {customTemplates.map((tmpl) => (
                          <button key={tmpl.id} onClick={() => setSelectedOverlay(`custom-${tmpl.id}`)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedOverlay === `custom-${tmpl.id}` ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-200'}`}>
                            ✨ {tmpl.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Original image */}
                  <details className="text-xs">
                    <summary className="text-slate-400 cursor-pointer hover:text-slate-600">Vis originalbilde</summary>
                    <img src={post.content_image_url} alt="" className="w-full rounded-xl object-cover mt-2" />
                  </details>
                </div>
              )}

              {/* Additional media */}
              {post.media_urls?.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {post.media_urls.map((url, i) => <img key={i} src={url} alt={`Media ${i + 1}`} className="w-full rounded-xl object-cover" />)}
                </div>
              )}
            </div>
          )}

          {post.content_video_url && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 mb-3">Video</h3>
              <video src={post.content_video_url} controls className="w-full rounded-xl" />
            </div>
          )}

          {(post.caption || post.content_text) && (
            <PlatformPreview caption={post.caption || post.content_text || ''} imageUrl={post.content_image_url} platform={post.platform} brandName={orgName} brandLogo={orgLogo} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Handlinger</h3>
            <div className="space-y-2">
              {(post.status === 'pending_approval' || post.status === 'draft') && (
                <>
                  <button onClick={() => handleApprove(false)} disabled={actionLoading}
                    className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Godkjenn nå
                  </button>
                  <button onClick={() => setShowSchedule(!showSchedule)} disabled={actionLoading}
                    className="w-full bg-indigo-50 text-indigo-600 py-2.5 rounded-xl font-medium hover:bg-indigo-100 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-indigo-100">
                    <Calendar className="w-4 h-4" /> Planlegg publisering
                  </button>

                  {showSchedule && (
                    <div className="mt-2 space-y-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="flex gap-2">
                        <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <button onClick={() => handleApprove(true)} disabled={!scheduleDate || actionLoading}
                        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                        <Calendar className="w-3.5 h-3.5" /> Godkjenn og planlegg
                      </button>
                    </div>
                  )}

                  <button onClick={() => setShowRejectForm(!showRejectForm)} disabled={actionLoading}
                    className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-red-100">
                    <XIcon className="w-4 h-4" /> Avvis med kommentar
                  </button>
                </>
              )}

              {showRejectForm && (
                <div className="mt-2 space-y-2">
                  <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Begrunn avvisningen..." rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none" />
                  <button onClick={handleReject} disabled={!rejectComment.trim() || actionLoading}
                    className="w-full bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-all duration-200 disabled:opacity-50">
                    Send avvisning
                  </button>
                </div>
              )}

              <button onClick={handleRegenerate} disabled={actionLoading}
                className="w-full bg-purple-50 text-purple-600 py-2.5 rounded-xl font-medium hover:bg-purple-100 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-purple-100">
                <RefreshCw className="w-4 h-4" /> Regenerer
              </button>

              {(post.status === 'approved' || post.status === 'scheduled') && (
                <button onClick={handlePublish} disabled={publishLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-sm">
                  {publishLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Publiserer...</> : <><Send className="w-4 h-4" /> Publiser nå</>}
                </button>
              )}

              {post.status === 'published' && post.published_at && (
                <div className="w-full bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-center text-sm font-medium mt-2 flex items-center justify-center gap-2 border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" /> Publisert {new Date(post.published_at).toLocaleString('nb-NO')}
                </div>
              )}

              {post.status === 'publishing' && (
                <div className="w-full bg-indigo-50 text-indigo-600 py-2.5 rounded-xl text-center text-sm font-medium mt-2 animate-pulse flex items-center justify-center gap-2 border border-indigo-100">
                  <Loader2 className="w-4 h-4 animate-spin" /> Publisering pågår...
                </div>
              )}

              {post.status === 'failed' && (
                <div className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl text-center text-sm font-medium mt-2 flex items-center justify-center gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4" /> Publisering feilet
                </div>
              )}
            </div>

            {post.approved_at && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                Godkjent {new Date(post.approved_at).toLocaleString('nb-NO')}
              </div>
            )}
            {post.rejection_reason && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-red-600 mb-1">Avvisningsgrunn:</p>
                <p className="text-xs text-slate-600">{post.rejection_reason}</p>
              </div>
            )}
          </div>

          {feedback.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Tilbakemeldinger</h3>
              <div className="space-y-3">
                {feedback.map((fb) => (
                  <div key={fb.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className={
                        fb.action === 'approved' ? 'text-emerald-600 flex items-center gap-1' :
                        fb.action === 'rejected' ? 'text-red-600 flex items-center gap-1' :
                        'text-slate-600 flex items-center gap-1'
                      }>
                        {fb.action === 'approved' ? <><Check className="w-3 h-3" /> Godkjent</> :
                         fb.action === 'rejected' ? <><XIcon className="w-3 h-3" /> Avvist</> :
                         <><Pencil className="w-3 h-3" /> Redigert</>}
                      </span>
                      <span>·</span>
                      <span>{new Date(fb.created_at).toLocaleString('nb-NO')}</span>
                    </div>
                    {(fb.comment || fb.rejection_reason) && (
                      <p className="text-xs text-slate-600 mt-1">{fb.comment || fb.rejection_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


