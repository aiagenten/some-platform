// Renders a custom overlay template onto a canvas context
// Used in the post detail page to apply custom overlays to post images

import type { OverlayElement, CanvasBackground, CustomOverlayTemplate } from './custom-overlay-types'
import type { OverlayOptions } from './overlay-templates'

export async function renderCustomOverlay(
  ctx: CanvasRenderingContext2D,
  template: CustomOverlayTemplate,
  options: OverlayOptions
) {
  const { size, baseImage, logo, headline, subtitle, brandName, primaryColor, accentColor, headingFont, bodyFont } = options
  const canvasW = options.width || size
  const canvasH = options.height || size

  // Scale factor: templates are designed at template.width x template.height (usually 1080x1080)
  // When rendering at a different size (e.g. 540px preview), scale all positions/sizes
  const templateW = template.width || 1080
  const templateH = template.height || 1080
  const scaleX = canvasW / templateW
  const scaleY = canvasH / templateH

  // Resolve brand tokens in element fills
  const resolveFill = (fill: string | undefined): string => {
    if (!fill) return 'rgba(0,0,0,0.5)'
    return fill
      .replace('{{primaryColor}}', primaryColor)
      .replace('{{accentColor}}', accentColor)
      .replace('{{brandName}}', brandName)
  }

  // Draw base image first (covers full canvas, crop to fit aspect ratio)
  const canvasRatio = canvasW / canvasH
  const imgRatio = baseImage.width / baseImage.height
  let sx = 0, sy = 0, sw = baseImage.width, sh = baseImage.height
  if (imgRatio > canvasRatio) { sw = baseImage.height * canvasRatio; sx = (baseImage.width - sw) / 2 }
  else if (imgRatio < canvasRatio) { sh = baseImage.width / canvasRatio; sy = (baseImage.height - sh) / 2 }
  ctx.drawImage(baseImage, sx, sy, sw, sh, 0, 0, canvasW, canvasH)

  // Apply canvas background (over image if not transparent)
  renderBackground(ctx, template.canvas_background, canvasW, canvasH)

  // Render each element using Fabric.js left/top as top-left origin, scaled to canvas size
  for (const el of template.elements) {
    ctx.save()
    ctx.globalAlpha = el.opacity ?? 1

    // Scale element position and size from template coordinates to canvas coordinates
    const scaledEl = {
      ...el,
      left: el.left * scaleX,
      top: el.top * scaleY,
      fontSize: el.fontSize ? el.fontSize * Math.min(scaleX, scaleY) : undefined,
    }

    const w = el.width * (el.scaleX || 1) * scaleX
    const h = el.height * (el.scaleY || 1) * scaleY

    // Apply rotation around center of scaled element if needed
    if (el.angle) {
      const cx = scaledEl.left + w / 2
      const cy = scaledEl.top + h / 2
      ctx.translate(cx, cy)
      ctx.rotate(el.angle * Math.PI / 180)
      ctx.translate(-cx, -cy)
    }

    switch (el.type) {
      case 'text':
        renderText(ctx, scaledEl, w, h, { headline, subtitle, brandName, headingFont, bodyFont, primaryColor })
        break
      case 'shape':
        renderShape(ctx, scaledEl, w, h, resolveFill)
        break
      case 'color-block':
        renderColorBlock(ctx, scaledEl, w, h, resolveFill)
        break
      case 'logo':
        if (el.useBrandLogo === false && el.imageUrl) {
          await renderLogoFromUrl(ctx, scaledEl, el.imageUrl, w, h)
        } else if (logo) {
          renderLogo(ctx, scaledEl, logo, w, h)
        }
        break
    }

    ctx.restore()
  }
}

function renderBackground(ctx: CanvasRenderingContext2D, bg: CanvasBackground, w: number, h: number) {
  if (bg.type === 'transparent') return

  if (bg.type === 'solid') {
    ctx.fillStyle = bg.color || '#000000'
    ctx.globalAlpha = bg.opacity ?? 1
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  } else if (bg.type === 'gradient' && bg.gradient) {
    const grad = bg.gradient.type === 'linear'
      ? ctx.createLinearGradient(0, 0, w, h)
      : ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2)
    bg.gradient.colorStops.forEach(stop => grad.addColorStop(stop.offset, stop.color))
    ctx.fillStyle = grad
    ctx.globalAlpha = bg.opacity ?? 1
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }
}

function renderText(
  ctx: CanvasRenderingContext2D,
  el: OverlayElement,
  w: number,
  h: number,
  opts: { headline: string; subtitle: string; brandName: string; headingFont: string; bodyFont: string; primaryColor: string }
) {
  // Replace brand tokens in text
  let text = el.text || ''
  text = text.replace('{{headline}}', opts.headline)
  text = text.replace('{{subtitle}}', opts.subtitle)
  text = text.replace('{{brandName}}', opts.brandName)

  const font = el.fontFamily || opts.headingFont
  const weight = el.fontWeight || 'normal'
  const fontSize = el.fontSize || 48
  const scaledFontSize = fontSize * (el.scaleY || 1)

  ctx.font = `${weight} ${scaledFontSize}px '${font}', sans-serif`
  ctx.fillStyle = el.fill || '#ffffff'
  ctx.textBaseline = 'top'

  const align = (el.textAlign as CanvasTextAlign) || 'left'
  ctx.textAlign = align

  const lines = wrapText(ctx, text, w)
  const lineHeight = scaledFontSize * 1.2

  // Calculate x position based on text alignment
  let x = el.left
  if (align === 'center') x = el.left + w / 2
  else if (align === 'right') x = el.left + w

  lines.forEach((line, i) => {
    ctx.fillText(line, x, el.top + i * lineHeight)
  })
}

function renderShape(ctx: CanvasRenderingContext2D, el: OverlayElement, w: number, h: number, resolveFill: (f: string | undefined) => string) {
  ctx.fillStyle = resolveFill(el.fill)
  if (el.stroke) {
    ctx.strokeStyle = el.stroke
    ctx.lineWidth = el.strokeWidth || 1
  }

  if (el.shapeType === 'circle') {
    // Fabric circle: left/top is top-left of bounding box, draw ellipse at center
    ctx.beginPath()
    ctx.ellipse(el.left + w / 2, el.top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    if (el.stroke) ctx.stroke()
  } else if (el.shapeType === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(el.left + w / 2, el.top)
    ctx.lineTo(el.left + w, el.top + h)
    ctx.lineTo(el.left, el.top + h)
    ctx.closePath()
    ctx.fill()
    if (el.stroke) ctx.stroke()
  } else {
    // rect
    const rx = el.rx || 0
    if (rx > 0) {
      roundRect(ctx, el.left, el.top, w, h, rx)
      ctx.fill()
      if (el.stroke) ctx.stroke()
    } else {
      ctx.fillRect(el.left, el.top, w, h)
      if (el.stroke) ctx.strokeRect(el.left, el.top, w, h)
    }
  }
}

function renderColorBlock(ctx: CanvasRenderingContext2D, el: OverlayElement, w: number, h: number, resolveFill: (f: string | undefined) => string) {
  ctx.fillStyle = resolveFill(el.fill)
  const rx = el.rx || 0
  if (rx > 0) {
    roundRect(ctx, el.left, el.top, w, h, rx)
    ctx.fill()
  } else {
    ctx.fillRect(el.left, el.top, w, h)
  }
}

async function renderLogoFromUrl(ctx: CanvasRenderingContext2D, el: OverlayElement, url: string, w: number, h: number): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      renderLogo(ctx, el, img, w, h)
      resolve()
    }
    img.onerror = () => resolve() // silently skip if load fails
    img.src = url
  })
}

function renderLogo(ctx: CanvasRenderingContext2D, el: OverlayElement, logo: HTMLImageElement, w: number, h: number) {
  const ratio = logo.width / logo.height
  let drawW = w
  let drawH = w / ratio
  if (drawH > h) {
    drawH = h
    drawW = h * ratio
  }
  ctx.drawImage(logo, el.left, el.top, drawW, drawH)
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
