// Overlay template definitions for SoMe post images
// Each template defines how brand elements are composited onto the AI image

import type { ResolvedOverlayStyle } from './overlay-style-resolver'

export type OverlayTemplate = {
  id: string
  name: string
  description: string
  render: (ctx: CanvasRenderingContext2D, options: OverlayOptions) => Promise<void>
}

export type OverlayOptions = {
  size: number
  width?: number
  height?: number
  baseImage: HTMLImageElement
  logo: HTMLImageElement | null
  headline: string
  subtitle: string
  brandName: string
  primaryColor: string
  accentColor: string
  headingFont: string
  bodyFont: string
  visualStyle?: ResolvedOverlayStyle
}

// Platform dimensions (full resolution)
export const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  linkedin: { width: 1200, height: 627 },
  facebook: { width: 1200, height: 630 },
}

/** Get effective width/height from options, falling back to size for backwards compat */
function getDimensions(opts: OverlayOptions): { w: number; h: number; scale: number } {
  const w = opts.width || opts.size
  const h = opts.height || opts.size
  const scale = w / 1080 // reference width = 1080
  return { w, h, scale }
}

function drawBaseImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const canvasRatio = w / h
  const imgRatio = img.width / img.height
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (imgRatio > canvasRatio) {
    // Image wider than canvas ratio — crop sides
    sw = img.height * canvasRatio
    sx = (img.width - sw) / 2
  } else if (imgRatio < canvasRatio) {
    // Image taller than canvas ratio — crop top/bottom
    sh = img.width / canvasRatio
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, maxH: number) {
  if (!logo) return 0
  const ratio = logo.width / logo.height
  const h = maxH
  const w = h * ratio
  ctx.drawImage(logo, x, y, w, h)
  return w
}

/** Default resolved style — matches original hardcoded values for backward compat */
const FALLBACK_STYLE: ResolvedOverlayStyle = {
  borderRadius: 0, shadowEnabled: false, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0.3)',
  shadowOffsetX: 0, shadowOffsetY: 2, overlayOpacity: 0.55, spacingMultiplier: 1.0,
  colorBlockHasGradient: false, colorBlockBorderRadius: 0, accentLineThickness: 5,
  accentLineRounded: false, textShadowEnabled: false, textShadowBlur: 0,
  useRoundedElements: false, isMinimal: false, isBold: false,
}

function getStyle(opts: OverlayOptions): ResolvedOverlayStyle {
  return opts.visualStyle ?? FALLBACK_STYLE
}

/** Draw a filled rounded rect. Falls back to fillRect when radius is 0. */
function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) { ctx.fillRect(x, y, w, h); return }
  const clampedR = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, clampedR)
  ctx.fill()
}

/** Apply shadow settings to ctx before drawing. Call resetShadow after. */
function applyShadow(ctx: CanvasRenderingContext2D, s: ResolvedOverlayStyle) {
  if (!s.shadowEnabled) return
  ctx.shadowBlur = s.shadowBlur
  ctx.shadowColor = s.shadowColor
  ctx.shadowOffsetX = s.shadowOffsetX
  ctx.shadowOffsetY = s.shadowOffsetY
}

function applyTextShadow(ctx: CanvasRenderingContext2D, s: ResolvedOverlayStyle) {
  if (!s.textShadowEnabled) return
  ctx.shadowBlur = s.textShadowBlur
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 1
}

function resetShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

/** Scale a padding/spacing value by the style's spacing multiplier */
function sp(base: number, s: ResolvedOverlayStyle): number {
  return Math.round(base * s.spacingMultiplier)
}

// ============================================
// TEMPLATE 1: Moderne Mørk (dark overlay)
// ============================================
const modernDark: OverlayTemplate = {
  id: 'modern-dark',
  name: 'Moderne mørk',
  description: 'Mørkt overlay med stor overskrift og logo øverst',
  render: async (ctx, opts) => {
    const { baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const { w, h, scale } = getDimensions(opts)
    const s = getStyle(opts)
    const pad = sp(Math.round(60 * scale), s)

    drawBaseImage(ctx, baseImage, w, h)

    // Dark overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${s.overlayOpacity})`
    ctx.fillRect(0, 0, w, h)

    // Logo + brand name top-left
    const logoH = Math.round(50 * scale)
    let logoBottom = pad + sp(Math.round(30 * scale), s)
    const logoW = drawLogo(ctx, logo, pad, pad, logoH)
    ctx.font = `600 ${Math.round(24 * scale)}px '${headingFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textBaseline = 'middle'
    applyTextShadow(ctx, s)
    if (logoW > 0) {
      ctx.fillText(brandName, pad + logoW + sp(Math.round(16 * scale), s), pad + logoH / 2)
      logoBottom = pad + logoH + sp(Math.round(20 * scale), s)
    } else {
      ctx.textBaseline = 'top'
      ctx.fillText(brandName, pad, pad)
      logoBottom = pad + sp(Math.round(40 * scale), s)
    }
    resetShadow(ctx)

    // Big headline
    if (headline) {
      const fontSize = Math.round(72 * scale)
      const lineH = sp(Math.round(86 * scale), s)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      applyTextShadow(ctx, s)
      const lines = wrapText(ctx, headline, w - pad * 2)
      const headlineY = logoBottom + sp(Math.round(40 * scale), s)
      lines.forEach((line, i) => { ctx.fillText(line, pad, headlineY + i * lineH) })
      resetShadow(ctx)

      // Accent line
      const accentY = headlineY + lines.length * lineH + sp(Math.round(16 * scale), s)
      ctx.fillStyle = accentColor
      applyShadow(ctx, s)
      const accentH = Math.round(s.accentLineThickness * scale)
      if (s.accentLineRounded) {
        fillRoundRect(ctx, pad, accentY, Math.round(80 * scale), accentH, accentH / 2)
      } else {
        ctx.fillRect(pad, accentY, Math.round(80 * scale), accentH)
      }
      resetShadow(ctx)

      // Subtitle
      if (subtitle) {
        ctx.font = `400 ${Math.round(28 * scale)}px '${bodyFont}', sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        applyTextShadow(ctx, s)
        const subLines = wrapText(ctx, subtitle, w - pad * 2)
        subLines.slice(0, 2).forEach((line, i) => {
          ctx.fillText(line, pad, accentY + sp(Math.round(30 * scale), s) + i * sp(Math.round(36 * scale), s))
        })
        resetShadow(ctx)
      }
    }

    // Bottom accent line
    ctx.fillStyle = primaryColor
    ctx.fillRect(0, h - Math.round(s.accentLineThickness * scale), w, Math.round(s.accentLineThickness * scale))
  }
}

// ============================================
// TEMPLATE 2: Gradient Banner (bottom third)
// ============================================
const gradientBanner: OverlayTemplate = {
  id: 'gradient-banner',
  name: 'Gradient banner',
  description: 'Bilde med gradient-banner nederst',
  render: async (ctx, opts) => {
    const { baseImage, logo, headline, subtitle, brandName, accentColor, headingFont, bodyFont } = opts
    const { w, h, scale } = getDimensions(opts)
    const s = getStyle(opts)
    const pad = sp(Math.round(50 * scale), s)

    drawBaseImage(ctx, baseImage, w, h)

    // Gradient only in bottom portion — opacity scaled by style
    const opacityMul = s.overlayOpacity / 0.55 // relative to default
    const gradient = ctx.createLinearGradient(0, h * 0.55, 0, h)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.3, `rgba(0,0,0,${(0.6 * opacityMul).toFixed(2)})`)
    gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.85 * opacityMul, 0.95).toFixed(2)})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // Logo top-left (small, semi-transparent)
    if (logo) {
      ctx.save()
      ctx.globalAlpha = 0.8
      drawLogo(ctx, logo, pad, pad, Math.round(40 * scale))
      ctx.restore()
    }

    // Headline in bottom area
    if (headline) {
      const fontSize = Math.round(56 * scale)
      const lineH = sp(Math.round(68 * scale), s)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'bottom'
      applyTextShadow(ctx, s)
      const lines = wrapText(ctx, headline, w - pad * 2)
      const startY = h - pad - sp(Math.round(80 * scale), s) - (lines.length - 1) * lineH
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, startY + i * lineH)
      })
      resetShadow(ctx)
    }

    // Subtitle
    if (subtitle) {
      ctx.font = `400 ${Math.round(24 * scale)}px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.textBaseline = 'bottom'
      applyTextShadow(ctx, s)
      ctx.fillText(subtitle, pad, h - pad - sp(Math.round(40 * scale), s))
      resetShadow(ctx)
    }

    // Brand name bottom-right
    ctx.font = `500 ${Math.round(20 * scale)}px '${bodyFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'right'
    applyTextShadow(ctx, s)
    ctx.fillText(brandName, w - pad, h - pad)
    resetShadow(ctx)
    ctx.textAlign = 'left'

    // Accent line
    const accentH = Math.round(s.accentLineThickness * scale * 0.8) // slightly thinner for banner
    ctx.fillStyle = accentColor
    if (s.accentLineRounded) {
      fillRoundRect(ctx, 0, h - accentH, w, accentH, accentH / 2)
    } else {
      ctx.fillRect(0, h - accentH, w, accentH)
    }
  }
}

// ============================================
// TEMPLATE 3: Sidebar (colored left panel)
// ============================================
const colorSidebar: OverlayTemplate = {
  id: 'color-sidebar',
  name: 'Farge-sidebar',
  description: 'Bilde i full størrelse med farget semi-transparent sidebar til venstre',
  render: async (ctx, opts) => {
    const { baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const { w, h, scale } = getDimensions(opts)
    const s = getStyle(opts)
    const panelW = Math.floor(w * 0.4)
    const pad = sp(Math.round(40 * scale), s)

    drawBaseImage(ctx, baseImage, w, h)

    // Semi-transparent colored left panel overlay
    ctx.fillStyle = primaryColor
    ctx.globalAlpha = Math.min(s.overlayOpacity + 0.33, 0.95)
    applyShadow(ctx, s)
    if (s.useRoundedElements && s.borderRadius > 0) {
      fillRoundRect(ctx, 0, 0, panelW, h, s.borderRadius)
    } else {
      ctx.fillRect(0, 0, panelW, h)
    }
    resetShadow(ctx)
    ctx.globalAlpha = 1

    // Slight dark overlay for depth on sidebar
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    if (s.useRoundedElements && s.borderRadius > 0) {
      fillRoundRect(ctx, 0, 0, panelW, h, s.borderRadius)
    } else {
      ctx.fillRect(0, 0, panelW, h)
    }

    // Logo at top of panel
    let contentY = pad + sp(Math.round(20 * scale), s)
    if (logo) {
      drawLogo(ctx, logo, pad, pad, Math.round(45 * scale))
      contentY = pad + sp(Math.round(65 * scale), s)
    }

    // Brand name
    ctx.font = `600 ${Math.round(20 * scale)}px '${headingFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textBaseline = 'top'
    applyTextShadow(ctx, s)
    ctx.fillText(brandName, pad, contentY)
    resetShadow(ctx)
    contentY += sp(Math.round(50 * scale), s)

    // Headline
    if (headline) {
      const fontSize = Math.round(40 * scale)
      const lineH = sp(Math.round(50 * scale), s)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      applyTextShadow(ctx, s)
      const lines = wrapText(ctx, headline, panelW - pad * 2)
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * lineH)
      })
      resetShadow(ctx)
      contentY += lines.length * lineH + sp(Math.round(20 * scale), s)

      // Accent line
      const accentH = Math.round(s.accentLineThickness * scale * 0.8)
      ctx.fillStyle = accentColor
      if (s.accentLineRounded) {
        fillRoundRect(ctx, pad, contentY, Math.round(50 * scale), accentH, accentH / 2)
      } else {
        ctx.fillRect(pad, contentY, Math.round(50 * scale), accentH)
      }
      contentY += sp(Math.round(24 * scale), s)
    }

    // Subtitle
    if (subtitle) {
      ctx.font = `400 ${Math.round(22 * scale)}px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      applyTextShadow(ctx, s)
      const subLines = wrapText(ctx, subtitle, panelW - pad * 2)
      subLines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * sp(Math.round(30 * scale), s))
      })
      resetShadow(ctx)
    }
  }
}

// ============================================
// TEMPLATE 4: Minimalist (clean, top text)
// ============================================
const minimalist: OverlayTemplate = {
  id: 'minimalist',
  name: 'Minimalistisk',
  description: 'Rent og enkelt — kun tekst og logo',
  render: async (ctx, opts) => {
    const { baseImage, logo, headline, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const { w, h, scale } = getDimensions(opts)
    const s = getStyle(opts)
    const pad = sp(Math.round(60 * scale), s)

    drawBaseImage(ctx, baseImage, w, h)

    // Very subtle dark overlay — use style opacity but cap lower for minimalist feel
    const minOverlay = s.isMinimal ? Math.min(s.overlayOpacity, 0.35) : s.overlayOpacity
    ctx.fillStyle = `rgba(0, 0, 0, ${minOverlay})`
    ctx.fillRect(0, 0, w, h)

    // Centered headline
    if (headline) {
      const fontSize = Math.round(64 * scale)
      const lineH = sp(Math.round(80 * scale), s)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      applyTextShadow(ctx, s)
      const lines = wrapText(ctx, headline, w - pad * 2)
      const totalH = lines.length * lineH
      const startY = h / 2 - totalH / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, startY + i * lineH + lineH / 2)
      })
      resetShadow(ctx)
      ctx.textAlign = 'left'

      // Thin accent line centered
      const lineW = Math.round(60 * scale)
      const accentH = Math.round(s.accentLineThickness * scale * 0.6) // thinner for minimalist
      ctx.fillStyle = accentColor
      if (s.accentLineRounded) {
        fillRoundRect(ctx, w / 2 - lineW / 2, startY + totalH + sp(Math.round(20 * scale), s), lineW, accentH, accentH / 2)
      } else {
        ctx.fillRect(w / 2 - lineW / 2, startY + totalH + sp(Math.round(20 * scale), s), lineW, accentH)
      }
    }

    // Logo bottom-center
    if (logo) {
      const logoH = Math.round(35 * scale)
      const logoRatio = logo.width / logo.height
      const logoW = logoH * logoRatio
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.drawImage(logo, w / 2 - logoW / 2, h - pad - logoH, logoW, logoH)
      ctx.restore()
    }

    // Brand name below or if no logo
    ctx.font = `500 ${Math.round(18 * scale)}px '${bodyFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'center'
    applyTextShadow(ctx, s)
    ctx.fillText(brandName, w / 2, h - sp(Math.round(20 * scale), s))
    resetShadow(ctx)
    ctx.textAlign = 'left'

    // Top + bottom accent lines
    const lineThick = Math.round(s.accentLineThickness * scale * 0.8)
    ctx.fillStyle = primaryColor
    ctx.fillRect(0, 0, w, lineThick)
    ctx.fillRect(0, h - lineThick, w, lineThick)
  }
}

// ============================================
// TEMPLATE 5: Bold Color Block
// ============================================
const boldBlock: OverlayTemplate = {
  id: 'bold-block',
  name: 'Bold fargeblokk',
  description: 'Stor farget blokk med tekst over bildet',
  render: async (ctx, opts) => {
    const { baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const { w, h, scale } = getDimensions(opts)
    const s = getStyle(opts)
    const pad = sp(Math.round(50 * scale), s)

    drawBaseImage(ctx, baseImage, w, h)

    // Large colored block in upper portion
    const blockH = Math.floor(h * 0.45)
    ctx.fillStyle = primaryColor
    ctx.globalAlpha = 0.92
    applyShadow(ctx, s)
    if (s.useRoundedElements && s.colorBlockBorderRadius > 0) {
      fillRoundRect(ctx, 0, 0, w, blockH, s.colorBlockBorderRadius)
    } else {
      ctx.fillRect(0, 0, w, blockH)
    }
    resetShadow(ctx)
    ctx.globalAlpha = 1

    // Logo + brand in block
    const logoSize = Math.round(40 * scale)
    let contentY = pad
    if (logo) {
      const logoW = drawLogo(ctx, logo, pad, pad, logoSize)
      ctx.font = `600 ${Math.round(22 * scale)}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      applyTextShadow(ctx, s)
      ctx.fillText(brandName, pad + logoW + sp(Math.round(14 * scale), s), pad + logoSize / 2)
      resetShadow(ctx)
      contentY = pad + sp(Math.round(60 * scale), s)
    } else {
      ctx.font = `600 ${Math.round(22 * scale)}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      applyTextShadow(ctx, s)
      ctx.fillText(brandName, pad, pad)
      resetShadow(ctx)
      contentY = pad + sp(Math.round(40 * scale), s)
    }

    // Headline in block
    if (headline) {
      const fontSize = Math.round(52 * scale)
      const lineH = sp(Math.round(64 * scale), s)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      applyTextShadow(ctx, s)
      const lines = wrapText(ctx, headline, w - pad * 2)
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * lineH)
      })
      resetShadow(ctx)
      contentY += lines.length * lineH + sp(Math.round(12 * scale), s)
    }

    // Subtitle in block
    if (subtitle && contentY < blockH - sp(Math.round(40 * scale), s)) {
      ctx.font = `400 ${Math.round(24 * scale)}px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.textBaseline = 'top'
      applyTextShadow(ctx, s)
      ctx.fillText(subtitle, pad, contentY)
      resetShadow(ctx)
    }

    // Bottom accent
    const accentH = Math.round(s.accentLineThickness * scale)
    ctx.fillStyle = accentColor
    ctx.fillRect(0, h - accentH, w, accentH)
  }
}

export const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  modernDark,
  gradientBanner,
  colorSidebar,
  minimalist,
  boldBlock,
]

export function getOverlayTemplate(id: string): OverlayTemplate {
  return OVERLAY_TEMPLATES.find(t => t.id === id) || OVERLAY_TEMPLATES[0]
}
