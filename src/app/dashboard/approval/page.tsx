'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Music, Smartphone, CheckCircle2, Trash2, Pencil, Loader2, PartyPopper, Clock } from 'lucide-react'
import { getOverlayTemplate } from '@/lib/overlay-templates'
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
  content_image_url: string | null
  created_at: string
  selected_overlay: string | null
  suggested_time: string | null
  scheduled_for: string | null
  headline: string | null
  subtitle: string | null
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

// Parse suggested_time for scheduled_for auto-fill at approval time
function parseScheduledFromSuggested(timeStr: string): string | null {
  const explicitMatch = timeStr.match(/\((\d{4}-\d{2}-\d{2})\)/)
  const timeMatch = timeStr.match(/kl\s*(\d{1,2}):?(\d{2})?/)
  if (explicitMatch) {
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '09'
    const min = timeMatch?.[2] || '00'
    return `${explicitMatch[1]}T${hour}:${min}:00.000Z`
  }
  const dayMap: Record<string, number> = { søndag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6 }
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
      return `${dateStr}T${hour}:00:00.000Z`
    }
  }
  return null
}

// Component to render overlay preview on a small canvas
function OverlayPreview({ post, brandColors, brandFonts, brandLogoUrl, orgName, customTemplates }: {
  post: Post
  brandColors: Array<{ hex: string; role: string }>
  brandFonts: Array<{ family: string; role: string }>
  brandLogoUrl: string | null
  orgName: string
  customTemplates: CustomOverlayTemplate[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !post.content_image_url || brandColors.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = 540
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

      const headline = post.headline || (() => {
        const firstLine = (post.content_text || post.caption || '').split('\n')[0].trim()
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine
      })()
      const subtitle = post.subtitle || ''

      const options: OverlayOptions = { size, baseImage, logo, headline, subtitle, brandName: orgName, primaryColor, accentColor, headingFont, bodyFont }

      const overlayId = post.selected_overlay || 'modern-dark'
      const customTmpl = customTemplates.find(t => `custom-${t.id}` === overlayId)
      if (customTmpl) {
        await renderCustomOverlay(ctx, customTmpl, options)
      } else {
        await getOverlayTemplate(overlayId).render(ctx, options)
      }
      setRendered(true)
    } catch (err) {
      console.error('Overlay preview error:', err)
      setRendered(false)
    }
  }, [post.content_image_url, post.selected_overlay, post.headline, post.subtitle, post.content_text, post.caption, brandColors, brandFonts, brandLogoUrl, orgName, customTemplates])

  useEffect(() => { render() }, [render])

  if (!post.content_image_url) return null

  return (
    <div className="relative h-48 overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover ${rendered ? '' : 'hidden'}`}
        style={{ aspectRatio: '1/1' }}
      />
      {!rendered && (
        <img src={post.content_image_url} alt="" className="w-full h-full object-cover" />
      )}
    </div>
  )
}

export default function ApprovalPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [brandColors, setBrandColors] = useState<Array<{ hex: string; role: string }>>([])
  const [brandFonts, setBrandFonts] = useState<Array<{ family: string; role: string }>>([])
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [customTemplates, setCustomTemplates] = useState<CustomOverlayTemplate[]>([])
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

    // Load brand data for overlay rendering
    const { data: org } = await supabase.from('organizations').select('name, logo_url').eq('id', profile.org_id).single()
    if (org) setOrgName(org.name)

    const { data: bp } = await supabase.from('brand_profiles').select('logo_url, colors, fonts')
      .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).single()
    if (bp) {
      setBrandColors(bp.colors || [])
      setBrandFonts(bp.fonts || [])
      setBrandLogoUrl(bp.logo_url)
    }

    // Load custom overlay templates
    try {
      const res = await fetch('/api/overlay-templates')
      if (res.ok) {
        const customData = await res.json()
        setCustomTemplates(customData)
      }
    } catch { /* ignore */ }

    const { data } = await supabase
      .from('social_posts')
      .select('id, content_text, caption, platform, format, status, content_image_url, created_at, selected_overlay, suggested_time, scheduled_for, headline, subtitle')
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

    // Auto-set scheduled_for from suggested_time if not already set
    const post = posts.find(p => p.id === postId)
    let scheduledFor: string | null = null
    if (post?.suggested_time && !post?.scheduled_for) {
      scheduledFor = parseScheduledFromSuggested(post.suggested_time)
    }

    const updates: Record<string, unknown> = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }
    if (scheduledFor) {
      updates.scheduled_for = scheduledFor
    }

    await supabase
      .from('social_posts')
      .update(updates)
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
                {/* Image with overlay preview or platform header */}
                {post.content_image_url ? (
                  <div className="relative">
                    <OverlayPreview
                      post={post}
                      brandColors={brandColors}
                      brandFonts={brandFonts}
                      brandLogoUrl={brandLogoUrl}
                      orgName={orgName}
                      customTemplates={customTemplates}
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
                  {/* Show scheduled/suggested time */}
                  {(post.scheduled_for || post.suggested_time) && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {post.scheduled_for
                          ? `Planlagt: ${new Date(post.scheduled_for).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                          : post.suggested_time}
                      </span>
                    </div>
                  )}
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
