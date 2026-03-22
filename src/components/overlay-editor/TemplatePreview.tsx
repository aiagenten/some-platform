'use client'

import { useEffect, useRef } from 'react'
import type { OverlayTemplate, OverlayOptions } from '@/lib/overlay-templates'

type Props = {
  template: OverlayTemplate
  primaryColor?: string
  accentColor?: string
  size?: number
}

// Create a simple placeholder base image on a canvas
function createPlaceholderImage(size: number): HTMLImageElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#e2e8f0')
  grad.addColorStop(0.5, '#cbd5e1')
  grad.addColorStop(1, '#94a3b8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  // Simple "landscape" shapes
  // Mountain
  ctx.fillStyle = '#64748b'
  ctx.beginPath()
  ctx.moveTo(size * 0.1, size * 0.8)
  ctx.lineTo(size * 0.4, size * 0.35)
  ctx.lineTo(size * 0.7, size * 0.8)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#475569'
  ctx.beginPath()
  ctx.moveTo(size * 0.4, size * 0.8)
  ctx.lineTo(size * 0.65, size * 0.45)
  ctx.lineTo(size * 0.95, size * 0.8)
  ctx.closePath()
  ctx.fill()

  // Sun
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.arc(size * 0.8, size * 0.25, size * 0.08, 0, Math.PI * 2)
  ctx.fill()

  const img = new Image()
  img.src = canvas.toDataURL()
  return img
}

export function TemplatePreview({ template, primaryColor = '#6366f1', accentColor = '#f59e0b', size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderedRef = useRef(false)

  useEffect(() => {
    if (!canvasRef.current || renderedRef.current) return
    renderedRef.current = true

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const renderSize = 400 // Render at 2x for quality
    canvas.width = renderSize
    canvas.height = renderSize

    const placeholderImg = createPlaceholderImage(renderSize)

    const doRender = () => {
      const options: OverlayOptions = {
        size: renderSize,
        baseImage: placeholderImg,
        logo: null,
        headline: 'Eksempel tittel',
        subtitle: 'Undertekst her',
        brandName: 'Mitt Merke',
        primaryColor,
        accentColor,
        headingFont: 'Inter',
        bodyFont: 'Inter',
      }

      template.render(ctx, options).catch(() => {
        // Fallback: just show gradient
        ctx.fillStyle = '#e2e8f0'
        ctx.fillRect(0, 0, renderSize, renderSize)
      })
    }

    if (placeholderImg.complete) {
      doRender()
    } else {
      placeholderImg.onload = doRender
    }
  }, [template, primaryColor, accentColor])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="w-full h-full object-cover"
    />
  )
}
