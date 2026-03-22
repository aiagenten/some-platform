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

function drawBaseImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const imgRatio = img.width / img.height
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (imgRatio > 1) { sx = (img.width - img.height) / 2; sw = img.height }
  else if (imgRatio < 1) { sy = (img.height - img.width) / 2; sh = img.width }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size)
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
    const { size, baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const pad = 60

    drawBaseImage(ctx, baseImage, size)

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, size, size)

    // Logo + brand name top-left
    let logoBottom = pad + 30
    const logoW = drawLogo(ctx, logo, pad, pad, 50)
    ctx.font = `600 24px '${headingFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textBaseline = 'middle'
    if (logoW > 0) {
      ctx.fillText(brandName, pad + logoW + 16, pad + 25)
      logoBottom = pad + 50 + 20
    } else {
      ctx.textBaseline = 'top'
      ctx.fillText(brandName, pad, pad)
      logoBottom = pad + 40
    }

    // Big headline
    if (headline) {
      ctx.font = `bold 72px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      const lines = wrapText(ctx, headline, size - pad * 2)
      const headlineY = logoBottom + 40
      lines.forEach((line, i) => { ctx.fillText(line, pad, headlineY + i * 86) })

      // Accent line
      const accentY = headlineY + lines.length * 86 + 16
      ctx.fillStyle = accentColor
      ctx.fillRect(pad, accentY, 80, 5)

      // Subtitle
      if (subtitle) {
        ctx.font = `400 28px '${bodyFont}', sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.75)'
        const subLines = wrapText(ctx, subtitle, size - pad * 2)
        subLines.slice(0, 2).forEach((line, i) => {
          ctx.fillText(line, pad, accentY + 30 + i * 36)
        })
      }
    }

    // Bottom accent line
    ctx.fillStyle = primaryColor
    ctx.fillRect(0, size - 5, size, 5)
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
    const { size, baseImage, logo, headline, subtitle, brandName, accentColor, headingFont, bodyFont } = opts
    const pad = 50

    drawBaseImage(ctx, baseImage, size)

    // Gradient only in bottom 40%
    const gradient = ctx.createLinearGradient(0, size * 0.55, 0, size)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.3, 'rgba(0,0,0,0.6)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    // Logo top-left (small, semi-transparent)
    if (logo) {
      ctx.save()
      ctx.globalAlpha = 0.8
      drawLogo(ctx, logo, pad, pad, 40)
      ctx.restore()
    }

    // Headline in bottom area
    if (headline) {
      ctx.font = `bold 56px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'bottom'
      const lines = wrapText(ctx, headline, size - pad * 2)
      const startY = size - pad - 80 - (lines.length - 1) * 68
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, startY + i * 68)
      })
    }

    // Subtitle
    if (subtitle) {
      ctx.font = `400 24px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.textBaseline = 'bottom'
      ctx.fillText(subtitle, pad, size - pad - 40)
    }

    // Brand name bottom-right
    ctx.font = `500 20px '${bodyFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'right'
    ctx.fillText(brandName, size - pad, size - pad)
    ctx.textAlign = 'left'

    // Accent line
    ctx.fillStyle = accentColor
    ctx.fillRect(0, size - 4, size, 4)
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
    const { size, baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const panelW = Math.floor(size * 0.4)
    const pad = 40

    // Draw base image full size (like all other overlay templates)
    drawBaseImage(ctx, baseImage, size)

    // Semi-transparent colored left panel overlay
    ctx.fillStyle = primaryColor
    ctx.globalAlpha = 0.88
    ctx.fillRect(0, 0, panelW, size)
    ctx.globalAlpha = 1

    // Slight dark overlay for depth on sidebar
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, panelW, size)

    // Logo at top of panel
    let contentY = pad + 20
    if (logo) {
      drawLogo(ctx, logo, pad, pad, 45)
      contentY = pad + 65
    }

    // Brand name
    ctx.font = `600 20px '${headingFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textBaseline = 'top'
    ctx.fillText(brandName, pad, contentY)
    contentY += 50

    // Headline
    if (headline) {
      ctx.font = `bold 40px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      const lines = wrapText(ctx, headline, panelW - pad * 2)
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * 50)
      })
      contentY += lines.length * 50 + 20

      // Accent line
      ctx.fillStyle = accentColor
      ctx.fillRect(pad, contentY, 50, 4)
      contentY += 24
    }

    // Subtitle
    if (subtitle) {
      ctx.font = `400 22px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      const subLines = wrapText(ctx, subtitle, panelW - pad * 2)
      subLines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * 30)
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
    const { size, baseImage, logo, headline, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const pad = 60

    drawBaseImage(ctx, baseImage, size)

    // Very subtle dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.fillRect(0, 0, size, size)

    // Centered headline
    if (headline) {
      ctx.font = `bold 64px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      const lines = wrapText(ctx, headline, size - pad * 2)
      const totalH = lines.length * 80
      const startY = size / 2 - totalH / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, size / 2, startY + i * 80 + 40)
      })
      ctx.textAlign = 'left'

      // Thin accent line centered
      const lineW = 60
      ctx.fillStyle = accentColor
      ctx.fillRect(size / 2 - lineW / 2, startY + totalH + 20, lineW, 3)
    }

    // Logo bottom-center
    if (logo) {
      const logoH = 35
      const logoRatio = logo.width / logo.height
      const logoW = logoH * logoRatio
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.drawImage(logo, size / 2 - logoW / 2, size - pad - logoH, logoW, logoH)
      ctx.restore()
    }

    // Brand name below or if no logo
    ctx.font = `500 18px '${bodyFont}', sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'center'
    ctx.fillText(brandName, size / 2, size - 20)
    ctx.textAlign = 'left'

    // Top + bottom accent lines
    ctx.fillStyle = primaryColor
    ctx.fillRect(0, 0, size, 4)
    ctx.fillRect(0, size - 4, size, 4)
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
    const { size, baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = opts
    const pad = 50

    drawBaseImage(ctx, baseImage, size)

    // Large colored block in upper portion
    const blockH = Math.floor(size * 0.45)
    ctx.fillStyle = primaryColor
    ctx.globalAlpha = 0.92
    ctx.fillRect(0, 0, size, blockH)
    ctx.globalAlpha = 1

    // Logo + brand in block
    let contentY = pad
    if (logo) {
      const logoW = drawLogo(ctx, logo, pad, pad, 40)
      ctx.font = `600 22px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.fillText(brandName, pad + logoW + 14, pad + 20)
      contentY = pad + 60
    } else {
      ctx.font = `600 22px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      ctx.fillText(brandName, pad, pad)
      contentY = pad + 40
    }

    // Headline in block
    if (headline) {
      ctx.font = `bold 52px '${headingFont}', sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textBaseline = 'top'
      const lines = wrapText(ctx, headline, size - pad * 2)
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, contentY + i * 64)
      })
      contentY += lines.length * 64 + 12
    }

    // Subtitle in block
    if (subtitle && contentY < blockH - 40) {
      ctx.font = `400 24px '${bodyFont}', sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.textBaseline = 'top'
      ctx.fillText(subtitle, pad, contentY)
    }

    // Bottom accent
    ctx.fillStyle = accentColor
    ctx.fillRect(0, size - 5, size, 5)
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
