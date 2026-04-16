'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { ThumbsUp, MessageCircle, Share2, Send, Bookmark, Heart, MoreHorizontal } from 'lucide-react'
import { getOverlayTemplate, PLATFORM_DIMENSIONS } from '@/lib/overlay-templates'
import { renderCustomOverlay } from '@/lib/custom-overlay-renderer'
import type { OverlayOptions } from '@/lib/overlay-templates'
import type { CustomOverlayTemplate } from '@/lib/custom-overlay-types'

type Props = {
  caption: string
  imageUrl: string | null
  platform: string
  brandName: string
  brandLogo?: string | null
  overlayId?: string | null
  headline?: string | null
  subtitle?: string | null
  brandColors?: Array<{ hex: string; role: string }>
  brandFonts?: Array<{ family: string; role: string }>
  brandLogoUrl?: string | null
  customTemplates?: CustomOverlayTemplate[]
}

const PREVIEW_WIDTH = 540

export default function PlatformPreview({ caption, imageUrl, platform, brandName, brandLogo, overlayId, headline, subtitle, brandColors, brandFonts, brandLogoUrl, customTemplates }: Props) {
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)

  const truncatedCaption = caption?.length > 300 ? caption.substring(0, 300) + '...' : caption
  const displayName = brandName || 'Brand Name'
  const avatar = brandLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=80`

  // Get platform-specific dimensions scaled to preview width
  const activePlatform = platform || 'instagram'
  const fullDims = PLATFORM_DIMENSIONS[activePlatform] || PLATFORM_DIMENSIONS.instagram
  const previewScale = PREVIEW_WIDTH / fullDims.width
  const previewWidth = PREVIEW_WIDTH
  const previewHeight = Math.round(fullDims.height * previewScale)

  // Render overlay for preview
  const renderPreviewOverlay = useCallback(async () => {
    if (!imageUrl || !overlayId || overlayId === 'none' || !brandColors?.length) return
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = previewWidth
    canvas.height = previewHeight

    const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src
    })

    try {
      const baseImage = await loadImg(imageUrl)
      let logo: HTMLImageElement | null = null
      if (brandLogoUrl) { try { logo = await loadImg(brandLogoUrl) } catch { /* skip */ } }

      const primaryColor = brandColors.find(c => c.role === 'primary')?.hex || '#9933ff'
      const accentColor = brandColors.find(c => c.role === 'accent')?.hex || primaryColor
      const headingFont = brandFonts?.find(f => f.role === 'heading')?.family || 'Inter'
      const bodyFont = brandFonts?.find(f => f.role === 'body')?.family || headingFont

      const options: OverlayOptions = {
        size: previewWidth,
        width: previewWidth,
        height: previewHeight,
        baseImage, logo,
        headline: headline || '',
        subtitle: subtitle || '',
        brandName: displayName,
        primaryColor, accentColor, headingFont, bodyFont,
      }

      // Check if it's a custom template
      const customTmpl = customTemplates?.find(t => `custom-${t.id}` === overlayId)
      if (customTmpl) {
        await renderCustomOverlay(ctx, customTmpl, options)
      } else {
        await getOverlayTemplate(overlayId).render(ctx, options)
      }
      setOverlayDataUrl(canvas.toDataURL('image/png'))
    } catch (err) { console.error('Preview overlay error:', err) }
  }, [imageUrl, overlayId, brandColors, brandFonts, brandLogoUrl, headline, subtitle, displayName, previewWidth, previewHeight, customTemplates])

  useEffect(() => {
    if (overlayId && overlayId !== 'none' && imageUrl && brandColors?.length) {
      renderPreviewOverlay()
    } else {
      setOverlayDataUrl(null)
    }
  }, [renderPreviewOverlay, overlayId, imageUrl, brandColors, customTemplates])

  const platformLabel = activePlatform === 'instagram' ? 'Instagram' : activePlatform === 'linkedin' ? 'LinkedIn' : activePlatform === 'facebook' ? 'Facebook' : activePlatform

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-4">
        {platformLabel}-preview
      </h3>

      {/* Preview — only the selected platform */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {activePlatform === 'instagram' && (
          <InstagramPreview caption={truncatedCaption} imageUrl={overlayDataUrl || imageUrl} displayName={displayName} avatar={avatar} />
        )}
        {activePlatform === 'linkedin' && (
          <LinkedInPreview caption={truncatedCaption} imageUrl={overlayDataUrl || imageUrl} displayName={displayName} avatar={avatar} />
        )}
        {activePlatform === 'facebook' && (
          <FacebookPreview caption={truncatedCaption} imageUrl={overlayDataUrl || imageUrl} displayName={displayName} avatar={avatar} />
        )}
        {!['instagram', 'linkedin', 'facebook'].includes(activePlatform) && (
          <InstagramPreview caption={truncatedCaption} imageUrl={overlayDataUrl || imageUrl} displayName={displayName} avatar={avatar} />
        )}
        <canvas ref={overlayCanvasRef} className="hidden" />
      </div>
    </div>
  )
}

function InstagramPreview({ caption, imageUrl, displayName, avatar }: { caption: string; imageUrl: string | null; displayName: string; avatar: string }) {
  return (
    <div className="max-w-[400px] mx-auto">
      <div className="flex items-center gap-3 p-3">
        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
        <span className="text-sm font-semibold text-slate-900">{displayName.toLowerCase().replace(/\s+/g, '')}</span>
        <MoreHorizontal className="w-5 h-5 ml-auto text-slate-400" />
      </div>

      <div className="aspect-square bg-slate-100 relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-4 mb-2">
          <Heart className="w-6 h-6 text-slate-700" />
          <MessageCircle className="w-6 h-6 text-slate-700" />
          <Send className="w-6 h-6 text-slate-700" />
          <Bookmark className="w-6 h-6 text-slate-700 ml-auto" />
        </div>
        <div className="text-sm">
          <span className="font-semibold mr-1">{displayName.toLowerCase().replace(/\s+/g, '')}</span>
          <span className="text-slate-800 whitespace-pre-wrap">{caption}</span>
        </div>
      </div>
    </div>
  )
}

function LinkedInPreview({ caption, imageUrl, displayName, avatar }: { caption: string; imageUrl: string | null; displayName: string; avatar: string }) {
  return (
    <div className="max-w-[500px] mx-auto">
      <div className="flex items-start gap-3 p-4">
        <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="text-xs text-slate-500">Bedrift · 1t</p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-slate-400" />
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{caption}</p>
      </div>

      {imageUrl && (
        <div className="bg-slate-100 relative overflow-hidden" style={{ aspectRatio: '1200/627' }}>
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="px-4 py-2 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
          <span className="ml-1">24</span>
          <span className="ml-auto">3 kommentarer</span>
        </div>
      </div>

      <div className="flex items-center justify-around border-t border-slate-100 py-1">
        {[
          { icon: ThumbsUp, label: 'Liker' },
          { icon: MessageCircle, label: 'Kommenter' },
          { icon: Share2, label: 'Del' },
          { icon: Send, label: 'Send' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex-1 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors rounded font-medium flex items-center justify-center gap-1.5"
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FacebookPreview({ caption, imageUrl, displayName, avatar }: { caption: string; imageUrl: string | null; displayName: string; avatar: string }) {
  return (
    <div className="max-w-[500px] mx-auto">
      <div className="flex items-start gap-3 p-4">
        <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="text-xs text-slate-500">1 t</p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-slate-400" />
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-slate-800 whitespace-pre-wrap">{caption}</p>
      </div>

      {imageUrl && (
        <div className="bg-slate-100 relative overflow-hidden" style={{ aspectRatio: '1200/630' }}>
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="px-4 py-2">
        <div className="flex items-center text-xs text-slate-500 pb-2 border-b border-slate-100">
          <span>42</span>
          <span className="ml-auto">8 kommentarer · 2 delinger</span>
        </div>
      </div>

      <div className="flex items-center justify-around py-1 px-2">
        {[
          { icon: ThumbsUp, label: 'Liker' },
          { icon: MessageCircle, label: 'Kommenter' },
          { icon: Share2, label: 'Del' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex-1 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors rounded font-medium flex items-center justify-center gap-1.5"
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
