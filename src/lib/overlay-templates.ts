// Overlay template definitions for SoMe post images
// Each template defines how brand elements are composited onto the AI image

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
    const pad = Math.round(60 * scale)

    drawBaseImage(ctx, baseImage, w, h)

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, w, h)

    // Logo + brand name top-left
    const logoH = Math.round(50 * scale)
    let logoBottom = pad + Math.round(30 * scale)
    const logoW = drawLogo(ctx, logo, pad, pad, logoH)
    ctx.font = `600 ${Math.round(24 * scale)}px '${headingFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textBaseline = 'middle'
    if (logoW > 0) {
      ctx.fillText(brandName, pad + logoW + Math.round(16 * scale), pad + logoH / 2)
      logoBottom = pad + logoH + Math.round(20 * scale)
    } else {
      ctx.textBaseline = 'top'
      ctx.fillText(brandName, pad, pad)
      logoBottom = pad + Math.round(40 * scale)
    }

    // Big headline
    if (headline) {
      const fontSize = Math.round(72 * scale)
      const lineH = Math.round(86 * scale)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      const lines = wrapText(ctx, headline, w - pad * 2)
      const headlineY = logoBottom + Math.round(40 * scale)
      lines.forEach((line, i) => { ctx.fillText(line, pad, headlineY + i * lineH) })

      // Accent line
      const accentY = headlineY + lines.length * lineH + Math.round(16 * scale)
      ctx.fillStyle = accentColor
      ctx.fillRect(pad, accentY, Math.round(80 * scale), Math.round(5 * scale))

      // Subtitle
      if (subtitle) {
        ctx.font = `400 ${Math.round(28 * scale)}px '${bodyFont}', sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        const subLines = wrapText(ctx, subtitle, w - pad * 2)
        subLines.slice(0, 2).forEach((line, i) => {
          ctx.fillText(line, pad, accentY + Math.round(30 * scale) + i * Math.round(36 * scale))
        })
      }
    }

    // Bottom accent line
    ctx.fillStyle = primaryColor
    ctx.fillRect(0, h - Math.round(5 * scale), w, Math.round(5 * scale))
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
    const pad = Math.round(50 * scale)

    drawBaseImage(ctx, baseImage, w, h)

    // Gradient only in bottom 40%
    const gradient = ctx.createLinearGradient(0, h * 0.55, 0, h)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.3, 'rgba(0,0,0,0.6)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)')
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
      const lineH = Math.round(68 * scale)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'bottom'
      const lines = wrapText(ctx, headline, w - pad * 2)
      const startY = h - pad - Math.round(80 * scale) - (lines.length - 1) * lineH
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, startY + i * lineH)
      })
    }

    // Subtitle
    if (subtitle) {
      ctx.font = `400 ${Math.round(24 * scale)}px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.textBaseline = 'bottom'
      ctx.fillText(subtitle, pad, h - pad - Math.round(40 * scale))
    }

    // Brand name bottom-right
    ctx.font = `500 ${Math.round(20 * scale)}px '${bodyFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'right'
    ctx.fillText(brandName, w - pad, h - pad)
    ctx.textAlign = 'left'

    // Accent line
    ctx.fillStyle = accentColor
    ctx.fillRect(0, h - Math.round(4 * scale), w, Math.round(4 * scale))
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
    const panelW = Math.floor(w * 0.4)
    const pad = Math.round(40 * scale)

    drawBaseImage(ctx, baseImage, w, h)

    // Semi-transparent colored left panel overlay
    ctx.fillStyle = primaryColor
    ctx.globalAlpha = 0.88
    ctx.fillRect(0, 0, panelW, h)
    ctx.globalAlpha = 1

    // Slight dark overlay for depth on sidebar
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, panelW, h)

    // Logo at top of panel
    let contentY = pad + Math.round(20 * scale)
    if (logo) {
      drawLogo(ctx, logo, pad, pad, Math.round(45 * scale))
      contentY = pad + Math.round(65 * scale)
    }

    // Brand name
    ctx.font = `600 ${Math.round(20 * scale)}px '${headingFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textBaseline = 'top'
    ctx.fillText(brandName, pad, contentY)
    contentY += Math.round(50 * scale)

    // Headline
    if (headline) {
      const fontSize = Math.round(40 * scale)
      const lineH = Math.round(50 * scale)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      const lines = wrapText(ctx, headline, panelW - pad * 2)
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * lineH)
      })
      contentY += lines.length * lineH + Math.round(20 * scale)

      // Accent line
      ctx.fillStyle = accentColor
      ctx.fillRect(pad, contentY, Math.round(50 * scale), Math.round(4 * scale))
      contentY += Math.round(24 * scale)
    }

    // Subtitle
    if (subtitle) {
      ctx.font = `400 ${Math.round(22 * scale)}px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      const subLines = wrapText(ctx, subtitle, panelW - pad * 2)
      subLines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * Math.round(30 * scale))
      })
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
    const pad = Math.round(60 * scale)

    drawBaseImage(ctx, baseImage, w, h)

    // Very subtle dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.fillRect(0, 0, w, h)

    // Centered headline
    if (headline) {
      const fontSize = Math.round(64 * scale)
      const lineH = Math.round(80 * scale)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      const lines = wrapText(ctx, headline, w - pad * 2)
      const totalH = lines.length * lineH
      const startY = h / 2 - totalH / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, startY + i * lineH + lineH / 2)
      })
      ctx.textAlign = 'left'

      // Thin accent line centered
      const lineW = Math.round(60 * scale)
      ctx.fillStyle = accentColor
      ctx.fillRect(w / 2 - lineW / 2, startY + totalH + Math.round(20 * scale), lineW, Math.round(3 * scale))
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
    ctx.fillText(brandName, w / 2, h - Math.round(20 * scale))
    ctx.textAlign = 'left'

    // Top + bottom accent lines
    const lineThick = Math.round(4 * scale)
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
    const pad = Math.round(50 * scale)

    drawBaseImage(ctx, baseImage, w, h)

    // Large colored block in upper portion
    const blockH = Math.floor(h * 0.45)
    ctx.fillStyle = primaryColor
    ctx.globalAlpha = 0.92
    ctx.fillRect(0, 0, w, blockH)
    ctx.globalAlpha = 1

    // Logo + brand in block
    const logoSize = Math.round(40 * scale)
    let contentY = pad
    if (logo) {
      const logoW = drawLogo(ctx, logo, pad, pad, logoSize)
      ctx.font = `600 ${Math.round(22 * scale)}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText(brandName, pad + logoW + Math.round(14 * scale), pad + logoSize / 2)
      contentY = pad + Math.round(60 * scale)
    } else {
      ctx.font = `600 ${Math.round(22 * scale)}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      ctx.fillText(brandName, pad, pad)
      contentY = pad + Math.round(40 * scale)
    }

    // Headline in block
    if (headline) {
      const fontSize = Math.round(52 * scale)
      const lineH = Math.round(64 * scale)
      ctx.font = `bold ${fontSize}px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      const lines = wrapText(ctx, headline, w - pad * 2)
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * lineH)
      })
      contentY += lines.length * lineH + Math.round(12 * scale)
    }

    // Subtitle in block
    if (subtitle && contentY < blockH - Math.round(40 * scale)) {
      ctx.font = `400 ${Math.round(24 * scale)}px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.textBaseline = 'top'
      ctx.fillText(subtitle, pad, contentY)
    }

    // Bottom accent
    ctx.fillStyle = accentColor
    ctx.fillRect(0, h - Math.round(5 * scale), w, Math.round(5 * scale))
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
