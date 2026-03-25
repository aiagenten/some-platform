'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import PlatformPreview from '@/components/PlatformPreview'
import { Instagram, Facebook, Linkedin, Music, Smartphone, CheckCircle2, RefreshCw, Send, Loader2, Clock, AlertCircle, Check, X as XIcon, Pencil, Sparkles, Layout, Download, Calendar, History, Trash2, Copy } from 'lucide-react'
import { OVERLAY_TEMPLATES, getOverlayTemplate, PLATFORM_DIMENSIONS, ASPECT_RATIO_DIMENSIONS } from '@/lib/overlay-templates'
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
  headline: string | null
  subtitle: string | null
  cta_text: string | null
  aspect_ratio: string | null
  selected_overlay: string | null
  suggested_time: string | null
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

// Parse suggested_time strings like "Tirsdag kl 08:00 (2026-03-24)" or "Tirsdag-torsdag kl 08-10"
function parseSuggestedTime(timeStr: string): { date: string; time: string } | null {
  // Try explicit date format: "Dag kl HH:MM (YYYY-MM-DD)"
  const explicitMatch = timeStr.match(/\((\d{4}-\d{2}-\d{2})\)/)
  const timeMatch = timeStr.match(/kl\s*(\d{1,2}):?(\d{2})?/)
  if (explicitMatch) {
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '09'
    const min = timeMatch?.[2] || '00'
    return { date: explicitMatch[1], time: `${hour}:${min}` }
  }
  // Parse day range: "Tirsdag-torsdag kl 08-10"
  const dayMap: Record<string, number> = { mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6, søndag: 0 }
  const dayMatch = timeStr.match(/(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)/i)
  const hourRangeMatch = timeStr.match(/kl\s*(\d{1,2})/)
  if (dayMatch && hourRangeMatch) {
    const targetDay = dayMap[dayMatch[1].toLowerCase()]
    const hour = hourRangeMatch[1].padStart(2, '0')
    if (targetDay !== undefined) {
      const now = new Date()
      const currentDay = now.getDay()
      let daysAhead = targetDay - currentDay
      if (daysAhead <= 0) daysAhead += 7
      const target = new Date(now)
      target.setDate(now.getDate() + daysAhead)
      const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
      return { date: dateStr, time: `${hour}:00` }
    }
  }
  return null
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
  const [brandVisualStyle, setBrandVisualStyle] = useState<BrandVisualStyle | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [customTemplates, setCustomTemplates] = useState<CustomOverlayTemplate[]>([])
  const [standardVisibility, setStandardVisibility] = useState<Record<string, boolean>>({})
  const [imageHistory, setImageHistory] = useState<Array<{ id: string; image_url: string; prompt: string | null; created_at: string; is_selected: boolean }>>([])
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingHeadline, setEditingHeadline] = useState(false)
  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [headlineValue, setHeadlineValue] = useState('')
  const [subtitleValue, setSubtitleValue] = useState('')
  const [ctaValue, setCtaValue] = useState('')
  const [editingCTA, setEditingCTA] = useState(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [overlayRendered, setOverlayRendered] = useState(false)

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
        const { data: bp } = await supabase.from('brand_profiles').select('logo_url, colors, fonts, visual_style')
          .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).single()
        if (bp) {
          setBrandColors(bp.colors || [])
          setBrandFonts(bp.fonts || [])
          setBrandLogoUrl(bp.logo_url)
          setBrandVisualStyle(bp.visual_style as BrandVisualStyle | null)
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

      // Load standard template visibility settings
      try {
        const visRes = await fetch('/api/overlay-templates/visibility')
        if (visRes.ok) {
          const visData = await visRes.json()
          setStandardVisibility(visData)
        }
      } catch { /* ignore */ }

      const { data: postData } = await supabase.from('social_posts').select('*').eq('id', postId).single()
      if (postData) {
        setPost(postData)
        // Pre-select overlay from DB
        if (postData.selected_overlay) setSelectedOverlay(postData.selected_overlay)
        // Pre-fill headline/subtitle for inline editing
        if (postData.headline) setHeadlineValue(postData.headline)
        if (postData.subtitle) setSubtitleValue(postData.subtitle)
        if (postData.cta_text) setCtaValue(postData.cta_text)
        if (postData.aspect_ratio) setSelectedAspectRatio(postData.aspect_ratio)
        // Pre-fill schedule from scheduled_for or suggested_time
        if (postData.scheduled_for) {
          const d = new Date(postData.scheduled_for)
          setScheduleDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
          setScheduleTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
        } else if (postData.suggested_time) {
          const parsed = parseSuggestedTime(postData.suggested_time)
          if (parsed) {
            setScheduleDate(parsed.date)
            setScheduleTime(parsed.time)
          }
        }
      }

      // Load image generation history
      const { data: imgHistory } = await supabase
        .from('image_generations')
        .select('id, image_url, prompt, created_at, is_selected')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
      if (imgHistory) setImageHistory(imgHistory)

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

  // Overlay rendering for post image — uses platform-specific dimensions
  const renderPostOverlay = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !post?.content_image_url || brandColors.length === 0) return
    // For custom overlays, wait until customTemplates are loaded
    if (selectedOverlay.startsWith('custom-') && customTemplates.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dims = selectedAspectRatio !== '1:1'
      ? ASPECT_RATIO_DIMENSIONS[selectedAspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1']
      : (post.aspect_ratio && ASPECT_RATIO_DIMENSIONS[post.aspect_ratio]) || PLATFORM_DIMENSIONS[post.platform] || PLATFORM_DIMENSIONS.instagram
    canvas.width = dims.width
    canvas.height = dims.height

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

      // Use headline/subtitle from DB, fallback to extracting from text
      const headline = headlineValue || post.headline || (() => {
        const firstLine = (post.content_text || post.caption || '').split('\n')[0].trim()
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
      })()
      const subtitle = subtitleValue || post.subtitle || ''

      const resolvedStyle = resolveOverlayStyle(brandVisualStyle)
      const options: OverlayOptions = { size: dims.width, width: dims.width, height: dims.height, baseImage, logo, headline, subtitle, brandName: orgName, primaryColor, accentColor, headingFont, bodyFont, visualStyle: resolvedStyle, ctaText: ctaValue || post.cta_text || '' }

      // Check if it's a custom template
      const customTmpl = customTemplates.find(t => `custom-${t.id}` === selectedOverlay)
      if (customTmpl) {
        await renderCustomOverlay(ctx, customTmpl, options)
      } else {
        await getOverlayTemplate(selectedOverlay).render(ctx, options)
      }
      setOverlayRendered(true)

      // Auto-save overlay image for thumbnail use in post list
      try {
        canvas.toBlob(async (blob) => {
          if (!blob || !post?.id || !orgId) return
          const fileName = `${orgId}/overlay-${post.id}.png`
          const { data: uploadData } = await supabase.storage
            .from('post-images')
            .upload(fileName, blob, { contentType: 'image/png', upsert: true })
          if (uploadData?.path) {
            const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(uploadData.path)
            if (urlData?.publicUrl) {
              // Add cache buster to avoid stale thumbnails
              const overlayUrl = `${urlData.publicUrl}?t=${Date.now()}`
              await supabase.from('social_posts').update({ overlay_image_url: overlayUrl }).eq('id', post.id)
            }
          }
        }, 'image/png')
      } catch { /* non-critical, skip silently */ }
    } catch (err) {
      console.error('Overlay render error:', err)
      setOverlayRendered(false)
    }
  }, [post?.content_image_url, post?.platform, brandColors, brandFonts, brandLogoUrl, brandVisualStyle, orgName, selectedOverlay, post?.content_text, post?.caption, post?.headline, post?.subtitle, headlineValue, subtitleValue, ctaValue, post?.cta_text, selectedAspectRatio, post?.aspect_ratio, customTemplates, orgId])

  useEffect(() => { setOverlayRendered(false); renderPostOverlay() }, [renderPostOverlay, selectedOverlay])

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

  const saveHeadlineSubtitle = async (field: 'headline' | 'subtitle' | 'cta_text', value: string) => {
    if (!post) return
    await supabase.from('social_posts').update({ [field]: value }).eq('id', post.id)
    setPost({ ...post, [field]: value })
    if (field === 'headline') setEditingHeadline(false)
    else if (field === 'subtitle') setEditingSubtitle(false)
    else if (field === 'cta_text') setEditingCTA(false)
  }

  const saveAspectRatio = async (ratio: string) => {
    setSelectedAspectRatio(ratio)
    if (!post) return
    await supabase.from('social_posts').update({ aspect_ratio: ratio }).eq('id', post.id)
    setPost({ ...post, aspect_ratio: ratio })
  }

  const [overlaySaved, setOverlaySaved] = useState(false)
  const handleOverlayChange = async (overlayId: string) => {
    setSelectedOverlay(overlayId)
    if (post) {
      await supabase.from('social_posts').update({ selected_overlay: overlayId }).eq('id', post.id)
      setPost({ ...post, selected_overlay: overlayId })
      setOverlaySaved(true)
      setTimeout(() => setOverlaySaved(false), 2000)
    }
  }

  const handleRevertImage = async (imageUrl: string, generationId: string) => {
    if (!post) return
    setActionLoading(true)
    await supabase.from('social_posts').update({ content_image_url: imageUrl }).eq('id', post.id)
    await supabase.from('image_generations').update({ is_selected: false }).eq('post_id', post.id)
    await supabase.from('image_generations').update({ is_selected: true }).eq('id', generationId)
    setPost({ ...post, content_image_url: imageUrl })
    setImageHistory(prev => prev.map(h => ({ ...h, is_selected: h.id === generationId })))
    setActionLoading(false)
  }

  const handleDeletePost = async () => {
    if (!post) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard/posts')
      }
    } catch { /* ignore */ }
    setDeleteLoading(false)
  }

  const handleCopyToPlatform = async (targetPlatform: string) => {
    if (!post || !orgId) return
    setCopyLoading(true)
    try {
      const { data: newPost, error } = await supabase.from('social_posts').insert({
        org_id: orgId,
        platform: targetPlatform,
        format: post.format,
        status: 'draft',
        caption: post.caption,
        content_text: post.content_text,
        headline: post.headline,
        subtitle: post.subtitle,
        content_image_url: post.content_image_url,
        content_video_url: post.content_video_url,
        hashtags: post.hashtags,
        selected_overlay: post.selected_overlay,
        ai_generated: post.ai_generated,
        ai_prompt: post.ai_prompt,
      }).select('id').single()

      if (error) throw error
      if (newPost) {
        setShowCopyMenu(false)
        router.push(`/dashboard/posts/${newPost.id}`)
      }
    } catch (err) {
      console.error('Copy error:', err)
      alert('Kunne ikke kopiere innlegget')
    } finally {
      setCopyLoading(false)
    }
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

            {/* Inline headline/subtitle editing */}
            <div className="mt-4 space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Overskrift (overlay)</label>
                {editingHeadline ? (
                  <div className="flex gap-2">
                    <input type="text" value={headlineValue} onChange={e => setHeadlineValue(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') saveHeadlineSubtitle('headline', headlineValue); if (e.key === 'Escape') setEditingHeadline(false) }} />
                    <button onClick={() => saveHeadlineSubtitle('headline', headlineValue)} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs hover:bg-indigo-100"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingHeadline(false)} className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs hover:bg-slate-100"><XIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setHeadlineValue(post.headline || ''); setEditingHeadline(true) }}
                    className="text-sm text-slate-800 hover:bg-slate-50 px-3 py-1.5 rounded-lg w-full text-left flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200">
                    {post.headline || <span className="text-slate-400 italic">Klikk for å legge til overskrift</span>}
                    <Pencil className="w-3 h-3 text-slate-400 ml-auto flex-shrink-0" />
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Undertekst (overlay)</label>
                {editingSubtitle ? (
                  <div className="flex gap-2">
                    <input type="text" value={subtitleValue} onChange={e => setSubtitleValue(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') saveHeadlineSubtitle('subtitle', subtitleValue); if (e.key === 'Escape') setEditingSubtitle(false) }} />
                    <button onClick={() => saveHeadlineSubtitle('subtitle', subtitleValue)} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs hover:bg-indigo-100"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingSubtitle(false)} className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs hover:bg-slate-100"><XIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setSubtitleValue(post.subtitle || ''); setEditingSubtitle(true) }}
                    className="text-sm text-slate-800 hover:bg-slate-50 px-3 py-1.5 rounded-lg w-full text-left flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200">
                    {post.subtitle || <span className="text-slate-400 italic">Klikk for å legge til undertekst</span>}
                    <Pencil className="w-3 h-3 text-slate-400 ml-auto flex-shrink-0" />
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">CTA-knapp (overlay)</label>
                {editingCTA ? (
                  <div className="flex gap-2">
                    <input type="text" value={ctaValue} onChange={e => setCtaValue(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="F.eks. 'Les mer', 'Bestill nå'"
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') saveHeadlineSubtitle('cta_text', ctaValue); if (e.key === 'Escape') setEditingCTA(false) }} />
                    <button onClick={() => saveHeadlineSubtitle('cta_text', ctaValue)} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs hover:bg-indigo-100"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingCTA(false)} className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs hover:bg-slate-100"><XIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setCtaValue(post.cta_text || ''); setEditingCTA(true) }}
                    className="text-sm text-slate-800 hover:bg-slate-50 px-3 py-1.5 rounded-lg w-full text-left flex items-center gap-2 transition-colors border border-transparent hover:border-slate-200">
                    {post.cta_text || <span className="text-slate-400 italic">Klikk for å legge til CTA-knapp</span>}
                    <Pencil className="w-3 h-3 text-slate-400 ml-auto flex-shrink-0" />
                  </button>
                )}
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Format (aspect ratio)</label>
                <div className="flex gap-2">
                  {Object.entries(ASPECT_RATIO_DIMENSIONS).map(([key, dim]) => (
                    <button
                      key={key}
                      onClick={() => saveAspectRatio(key)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                        selectedAspectRatio === key
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className={`border border-current rounded-sm ${
                          key === '1:1' ? 'w-4 h-4' : key === '16:9' ? 'w-6 h-3' : key === '9:16' ? 'w-3 h-6' : 'w-4 h-5'
                        }`} />
                        <span className="text-[10px]">{dim.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
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
                  <canvas ref={canvasRef} className={`w-full rounded-xl shadow-sm border border-slate-200 ${!overlayRendered ? 'hidden' : ''}`} style={{ aspectRatio: `${(ASPECT_RATIO_DIMENSIONS[selectedAspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1']).width}/${(ASPECT_RATIO_DIMENSIONS[selectedAspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1']).height}` }} />
                  {!overlayRendered && post.content_image_url && (
                    <img src={post.content_image_url} alt="Post" className="w-full rounded-xl shadow-sm border border-slate-200 object-cover" style={{ aspectRatio: `${(ASPECT_RATIO_DIMENSIONS[selectedAspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1']).width}/${(ASPECT_RATIO_DIMENSIONS[selectedAspectRatio] || ASPECT_RATIO_DIMENSIONS['1:1']).height}` }} />
                  )}

                  {/* Overlay selector — custom templates first, then standard */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Layout className="w-3.5 h-3.5 text-slate-400" />
                    {overlaySaved && (
                      <span className="text-xs text-emerald-600 font-medium animate-pulse">✓ Lagret</span>
                    )}
                    {customTemplates.filter(t => t.is_visible !== false).map((tmpl) => (
                      <button key={tmpl.id} onClick={() => handleOverlayChange(`custom-${tmpl.id}`)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedOverlay === `custom-${tmpl.id}` ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-200'}`}>
                        {tmpl.name}
                      </button>
                    ))}
                    {customTemplates.filter(t => t.is_visible !== false).length > 0 && (
                      <span className="text-slate-300 text-xs">|</span>
                    )}
                    {OVERLAY_TEMPLATES.filter(t => standardVisibility[t.id] !== false).map((tmpl) => (
                      <button key={tmpl.id} onClick={() => handleOverlayChange(tmpl.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedOverlay === tmpl.id ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                        {tmpl.name}
                      </button>
                    ))}
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

          {/* Image generation history */}
          {imageHistory.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-medium text-slate-500">Bildehistorikk ({imageHistory.length} varianter)</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {imageHistory.map((gen) => (
                  <div
                    key={gen.id}
                    className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      gen.is_selected
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => {
                      if (!gen.is_selected) handleRevertImage(gen.image_url, gen.id)
                    }}
                  >
                    <div className="aspect-square">
                      <img src={gen.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    {gen.is_selected && (
                      <div className="absolute top-1 right-1 bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                        Aktiv
                      </div>
                    )}
                    {!gen.is_selected && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded-lg">
                          Bruk dette
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5">
                      <p className="text-[10px] text-white/80">
                        {new Date(gen.created_at).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(post.caption || post.content_text) && (
            <PlatformPreview caption={post.caption || post.content_text || ''} imageUrl={post.content_image_url} platform={post.platform} brandName={orgName} brandLogo={orgLogo} overlayId={selectedOverlay} headline={headlineValue || post.headline} subtitle={subtitleValue || post.subtitle} brandColors={brandColors} brandFonts={brandFonts} brandLogoUrl={brandLogoUrl} customTemplates={customTemplates} />
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
                      {post.suggested_time && (
                        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700">AI anbefaler: <strong>{post.suggested_time}</strong></p>
                        </div>
                      )}
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

              {(post.status === 'draft' || post.status === 'pending_approval' || post.status === 'rejected') && (
                <button onClick={handleRegenerate} disabled={actionLoading}
                  className="w-full bg-purple-50 text-purple-600 py-2.5 rounded-xl font-medium hover:bg-purple-100 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-purple-100">
                  <RefreshCw className="w-4 h-4" /> Regenerer
                </button>
              )}

              {/* Copy to another platform */}
              <div className="relative">
                <button onClick={() => setShowCopyMenu(!showCopyMenu)} disabled={copyLoading}
                  className="w-full bg-slate-50 text-slate-600 py-2.5 rounded-xl font-medium hover:bg-slate-100 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-200">
                  {copyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Kopier til annen plattform
                </button>
                {showCopyMenu && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                    {[
                      { key: 'instagram', label: 'Instagram', icon: Instagram },
                      { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
                      { key: 'facebook', label: 'Facebook', icon: Facebook },
                    ].filter(p => p.key !== post.platform).map(p => (
                      <button key={p.key} onClick={() => handleCopyToPlatform(p.key)}
                        className="w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors">
                        <p.icon className="w-4 h-4" /> {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(post.status === 'draft' || post.status === 'rejected') && (
                <>
                  {confirmDelete ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-2">
                      <p className="text-xs text-red-700 mb-2 font-medium">Er du sikker? Innlegget slettes permanent.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeletePost}
                          disabled={deleteLoading}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {deleteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Ja, slett
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 bg-white text-slate-600 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all border border-slate-200"
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-2 border border-red-100 mt-2"
                    >
                      <Trash2 className="w-4 h-4" /> Slett innlegg
                    </button>
                  )}
                </>
              )}

              {(post.status === 'approved' || post.status === 'scheduled') && (
                <>
                  {/* Show current scheduled date */}
                  {post.scheduled_for && (
                    <div className="w-full bg-indigo-50 text-indigo-700 py-2.5 px-3 rounded-xl text-sm font-medium flex items-center gap-2 border border-indigo-100">
                      <Calendar className="w-4 h-4" />
                      Planlagt: {new Date(post.scheduled_for).toLocaleString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {/* Schedule picker as primary action */}
                  <button onClick={() => setShowSchedule(!showSchedule)} disabled={actionLoading}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                    <Calendar className="w-4 h-4" /> {post.scheduled_for ? 'Endre tidspunkt' : 'Planlegg publisering'}
                  </button>

                  {showSchedule && (
                    <div className="mt-2 space-y-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      {post.suggested_time && (
                        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700">AI anbefaler: <strong>{post.suggested_time}</strong></p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <button onClick={async () => {
                        if (!scheduleDate) return
                        setActionLoading(true)
                        const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
                        await supabase.from('social_posts').update({ scheduled_for: scheduledFor, status: 'scheduled' }).eq('id', post.id)
                        setPost({ ...post, scheduled_for: scheduledFor, status: 'scheduled' })
                        setShowSchedule(false)
                        setActionLoading(false)
                      }} disabled={!scheduleDate || actionLoading}
                        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                        <Calendar className="w-3.5 h-3.5" /> Lagre tidspunkt
                      </button>
                    </div>
                  )}

                  {/* Publish now as secondary action */}
                  <button onClick={handlePublish} disabled={publishLoading}
                    className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl font-medium hover:bg-slate-200 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-slate-200">
                    {publishLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Publiserer...</> : <><Send className="w-4 h-4" /> Publiser nå</>}
                  </button>

                  {/* Revert to draft */}
                  <button onClick={async () => {
                    setActionLoading(true)
                    await supabase.from('social_posts').update({ status: 'draft', approved_by: null, approved_at: null }).eq('id', post.id)
                    setPost({ ...post, status: 'draft', approved_by: null, approved_at: null })
                    setActionLoading(false)
                  }} disabled={actionLoading}
                    className="w-full bg-amber-50 text-amber-700 py-2.5 rounded-xl font-medium hover:bg-amber-100 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 border border-amber-100">
                    <RefreshCw className="w-4 h-4" /> Tilbake til utkast
                  </button>
                </>
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


