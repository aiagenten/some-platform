// Renders a custom overlay template onto a canvas context
// Used in the post detail page to apply custom overlays to post images

import type { OverlayElement, CanvasBackground, CustomOverlayTemplate } from './custom-overlay-types'
import type { OverlayOptions } from './overlay-templates'

export async function renderCustomOverlay(
  ctx: CanvasRenderingContext2D,
  template: CustomOverlayTemplate,
  options: OverlayOptions
) {
  const { size, baseImage, logo, headline, subtitle, brandName, primaryColor, headingFont, bodyFont } = options

  // Draw base image first (covers full canvas)
  const imgRatio = baseImage.width / baseImage.height
  let sx = 0, sy = 0, sw = baseImage.width, sh = baseImage.height
  if (imgRatio > 1) { sx = (baseImage.width - baseImage.height) / 2; sw = baseImage.height }
  else if (imgRatio < 1) { sy = (baseImage.height - baseImage.width) / 2; sh = baseImage.width }
  ctx.drawImage(baseImage, sx, sy, sw, sh, 0, 0, size, size)

  // Apply canvas background (over image if not transparent)
  renderBackground(ctx, template.canvas_background, size)

  // Render each element
  for (const el of template.elements) {
    ctx.save()

    // Apply transform
    const cx = el.left + (el.width * (el.scaleX || 1)) / 2
    const cy = el.top + (el.height * (el.scaleY || 1)) / 2
    ctx.translate(cx, cy)
    ctx.rotate((el.angle || 0) * Math.PI / 180)
    ctx.globalAlpha = el.opacity ?? 1

    const w = el.width * (el.scaleX || 1)
    const h = el.height * (el.scaleY || 1)

    switch (el.type) {
      case 'text':
        renderText(ctx, el, { headline, subtitle, brandName, headingFont, bodyFont, primaryColor })
        break
      case 'shape':
        renderShape(ctx, el, w, h)
        break
      case 'color-block':
        renderColorBlock(ctx, el, w, h)
        break
      case 'logo':
        if (logo) renderLogo(ctx, logo, w, h)
        break
    }

    ctx.restore()
  }
}

function renderBackground(ctx: CanvasRenderingContext2D, bg: CanvasBackground, size: number) {
  if (bg.type === 'transparent') return

  if (bg.type === 'solid') {
    ctx.fillStyle = bg.color || '#000000'
    ctx.globalAlpha = bg.opacity ?? 1
    ctx.fillRect(0, 0, size, size)
    ctx.globalAlpha = 1
  } else if (bg.type === 'gradient' && bg.gradient) {
    const grad = bg.gradient.type === 'linear'
      ? ctx.createLinearGradient(0, 0, size, size)
      : ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    bg.gradient.colorStops.forEach(stop => grad.addColorStop(stop.offset, stop.color))
    ctx.fillStyle = grad
    ctx.globalAlpha = bg.opacity ?? 1
    ctx.fillRect(0, 0, size, size)
    ctx.globalAlpha = 1
  }
}

function renderText(
  ctx: CanvasRenderingContext2D,
  el: OverlayElement,
  opts: { headline: string; subtitle: string; brandName: string; headingFont: string; bodyFont: string; primaryColor: string }
) {
  // Replace brand tokens in text
  let text = el.text || ''
  text = text.replace('{{headline}}', opts.headline)
  text = text.replace('{{subtitle}}', opts.subtitle)
  text = text.replace('{{brandName}}', opts.brandName)

  const font = el.fontFamily || opts.headingFont
  const weight = el.fontWeight || 'normal'
  const size = el.fontSize || 48

  ctx.font = `${weight} ${size}px '${font}', sans-serif`
  ctx.fillStyle = el.fill || '#ffffff'
  ctx.textBaseline = 'top'
  ctx.textAlign = (el.textAlign as CanvasTextAlign) || 'left'

  const w = el.width * (el.scaleX || 1)
  const lines = wrapText(ctx, text, w)
  const lineHeight = size * 1.2

  lines.forEach((line, i) => {
    ctx.fillText(line, -w / 2, -((el.height * (el.scaleY || 1)) / 2) + i * lineHeight)
  })
}

function renderShape(ctx: CanvasRenderingContext2D, el: OverlayElement, w: number, h: number) {
  ctx.fillStyle = el.fill || '#9933ff'
  if (el.stroke) {
    ctx.strokeStyle = el.stroke
    ctx.lineWidth = el.strokeWidth || 1
  }

  if (el.shapeType === 'circle') {
    ctx.beginPath()
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    if (el.stroke) ctx.stroke()
  } else if (el.shapeType === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(0, -h / 2)
    ctx.lineTo(w / 2, h / 2)
    ctx.lineTo(-w / 2, h / 2)
    ctx.closePath()
    ctx.fill()
    if (el.stroke) ctx.stroke()
  } else {
    // rect
    const rx = el.rx || 0
    if (rx > 0) {
      roundRect(ctx, -w / 2, -h / 2, w, h, rx)
      ctx.fill()
      if (el.stroke) ctx.stroke()
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h)
      if (el.stroke) ctx.strokeRect(-w / 2, -h / 2, w, h)
    }
  }
}

function renderColorBlock(ctx: CanvasRenderingContext2D, el: OverlayElement, w: number, h: number) {
  ctx.fillStyle = el.fill || 'rgba(0,0,0,0.5)'
  const rx = el.rx || 0
  if (rx > 0) {
    roundRect(ctx, -w / 2, -h / 2, w, h, rx)
    ctx.fill()
  } else {
    ctx.fillRect(-w / 2, -h / 2, w, h)
  }
}

function renderLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, w: number, h: number) {
  const ratio = logo.width / logo.height
  let drawW = w
  let drawH = w / ratio
  if (drawH > h) {
    drawH = h
    drawW = h * ratio
  }
  ctx.drawImage(logo, -drawW / 2, -drawH / 2, drawW, drawH)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
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
