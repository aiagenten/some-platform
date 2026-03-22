'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'
import type { OverlayElement, CanvasBackground, CustomOverlayTemplate } from '@/lib/custom-overlay-types'
import { ElementToolbar } from './ElementToolbar'
import { PropertyPanel } from './PropertyPanel'
import { Save, Undo2, Redo2, Layers, Grid3x3, ImageIcon } from 'lucide-react'

type BrandProfile = {
  colors: Array<{ hex: string; role: string }>
  fonts: Array<{ family: string; role: string }>
  logo_url: string | null
  logos?: Array<{ url: string; label?: string }>
}

type Props = {
  brand: BrandProfile
  template?: CustomOverlayTemplate | null
  onSave: (data: { name: string; description: string; elements: OverlayElement[]; canvas_background: CanvasBackground; thumbnail: string }) => Promise<void>
  onClose: () => void
}

export function OverlayEditor({ brand, template, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null)
  const [templateName, setTemplateName] = useState(template?.name || 'Ny mal')
  const [templateDesc, setTemplateDesc] = useState(template?.description || '')
  const [saving, setSaving] = useState(false)
  const [canvasBackground, setCanvasBackground] = useState<CanvasBackground>(
    template?.canvas_background || { type: 'transparent' }
  )
  const [showGrid, setShowGrid] = useState(false)
  const [showSampleBg, setShowSampleBg] = useState(true)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const skipHistoryRef = useRef(false)

  const CANVAS_SIZE = 1080
  const DISPLAY_SIZE = 540

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
    })

    fabricRef.current = canvas

    // Selection events
    canvas.on('selection:created', (e) => {
      setSelectedObject(e.selected?.[0] || null)
    })
    canvas.on('selection:updated', (e) => {
      setSelectedObject(e.selected?.[0] || null)
    })
    canvas.on('selection:cleared', () => {
      setSelectedObject(null)
    })

    // History tracking
    canvas.on('object:modified', () => saveToHistory())
    canvas.on('object:added', () => { if (!skipHistoryRef.current) saveToHistory() })
    canvas.on('object:removed', () => saveToHistory())

    // Load existing template elements
    if (template?.elements && template.elements.length > 0) {
      skipHistoryRef.current = true
      loadElements(canvas, template.elements)
      skipHistoryRef.current = false
    }

    // Apply background
    if (template?.canvas_background) {
      applyBackground(canvas, template.canvas_background)
    }

    // Initial history
    saveToHistory()

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveToHistory = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || skipHistoryRef.current) return
    const json = JSON.stringify(canvas.toJSON())
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(json)
      if (newHistory.length > 30) newHistory.shift()
      setHistoryIndex(newHistory.length - 1)
      return newHistory
    })
  }, [historyIndex])

  const undo = () => {
    if (historyIndex <= 0) return
    const canvas = fabricRef.current
    if (!canvas) return
    const newIndex = historyIndex - 1
    skipHistoryRef.current = true
    canvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      canvas.renderAll()
      skipHistoryRef.current = false
      setHistoryIndex(newIndex)
    })
  }

  const redo = () => {
    if (historyIndex >= history.length - 1) return
    const canvas = fabricRef.current
    if (!canvas) return
    const newIndex = historyIndex + 1
    skipHistoryRef.current = true
    canvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      canvas.renderAll()
      skipHistoryRef.current = false
      setHistoryIndex(newIndex)
    })
  }

  function loadElements(canvas: fabric.Canvas, elements: OverlayElement[]) {
    elements.forEach(el => {
      let obj: fabric.FabricObject | null = null

      switch (el.type) {
        case 'text': {
          obj = new fabric.IText(el.text || 'Tekst', {
            left: el.left,
            top: el.top,
            fontSize: el.fontSize || 48,
            fontFamily: el.fontFamily || 'Inter',
            fontWeight: el.fontWeight || 'normal',
            fill: el.fill || '#ffffff',
            textAlign: el.textAlign || 'left',
            angle: el.angle || 0,
            scaleX: el.scaleX || 1,
            scaleY: el.scaleY || 1,
            opacity: el.opacity ?? 1,
          })
          break
        }
        case 'shape': {
          if (el.shapeType === 'circle') {
            obj = new fabric.Circle({
              left: el.left,
              top: el.top,
              radius: (el.width || 100) / 2,
              fill: el.fill || '#9933ff',
              stroke: el.stroke || '',
              strokeWidth: el.strokeWidth || 0,
              angle: el.angle || 0,
              scaleX: el.scaleX || 1,
              scaleY: el.scaleY || 1,
              opacity: el.opacity ?? 1,
            })
          } else if (el.shapeType === 'triangle') {
            obj = new fabric.Triangle({
              left: el.left,
              top: el.top,
              width: el.width || 100,
              height: el.height || 100,
              fill: el.fill || '#9933ff',
              stroke: el.stroke || '',
              strokeWidth: el.strokeWidth || 0,
              angle: el.angle || 0,
              scaleX: el.scaleX || 1,
              scaleY: el.scaleY || 1,
              opacity: el.opacity ?? 1,
            })
          } else {
            // rect
            obj = new fabric.Rect({
              left: el.left,
              top: el.top,
              width: el.width || 200,
              height: el.height || 100,
              fill: el.fill || '#9933ff',
              stroke: el.stroke || '',
              strokeWidth: el.strokeWidth || 0,
              rx: el.rx || 0,
              ry: el.ry || 0,
              angle: el.angle || 0,
              scaleX: el.scaleX || 1,
              scaleY: el.scaleY || 1,
              opacity: el.opacity ?? 1,
            })
          }
          break
        }
        case 'color-block': {
          obj = new fabric.Rect({
            left: el.left,
            top: el.top,
            width: el.width || 1080,
            height: el.height || 200,
            fill: el.fill || 'rgba(0,0,0,0.5)',
            angle: el.angle || 0,
            scaleX: el.scaleX || 1,
            scaleY: el.scaleY || 1,
            opacity: el.opacity ?? 1,
            rx: el.rx || 0,
            ry: el.ry || 0,
          })
          break
        }
        case 'logo': {
          if (el.useBrandLogo && brand.logo_url) {
            fabric.FabricImage.fromURL(brand.logo_url, { crossOrigin: 'anonymous' }).then(img => {
              img.set({
                left: el.left,
                top: el.top,
                scaleX: el.scaleX || 0.2,
                scaleY: el.scaleY || 0.2,
                angle: el.angle || 0,
                opacity: el.opacity ?? 1,
              })
              ;(img as fabric.FabricObject & { customType?: string }).customType = 'logo'
              canvas.add(img)
              canvas.renderAll()
            })
            return // async, skip add below
          }
          break
        }
        case 'image': {
          if (el.imageUrl) {
            fabric.FabricImage.fromURL(el.imageUrl, { crossOrigin: 'anonymous' }).then(img => {
              img.set({
                left: el.left,
                top: el.top,
                scaleX: el.scaleX || 1,
                scaleY: el.scaleY || 1,
                angle: el.angle || 0,
                opacity: el.opacity ?? 1,
              })
              canvas.add(img)
              canvas.renderAll()
            })
            return
          }
          break
        }
      }

      if (obj) {
        // Store custom data
        ;(obj as fabric.FabricObject & { customType?: string; brandToken?: string }).customType = el.type
        if (el.brandToken) {
          ;(obj as fabric.FabricObject & { brandToken?: string }).brandToken = el.brandToken
        }
        canvas.add(obj)
      }
    })
    canvas.renderAll()
  }

  function applyBackground(canvas: fabric.Canvas, bg: CanvasBackground) {
    switch (bg.type) {
      case 'solid':
        canvas.backgroundColor = bg.color || '#ffffff'
        break
      case 'transparent':
        canvas.backgroundColor = 'transparent'
        break
      case 'gradient': {
        if (bg.gradient) {
          const gradType = bg.gradient.type
          if (gradType === 'linear') {
            const grad = new fabric.Gradient<'linear'>({
              type: 'linear',
              coords: { x1: 0, y1: 0, x2: CANVAS_SIZE, y2: CANVAS_SIZE },
              colorStops: bg.gradient.colorStops,
            })
            canvas.backgroundColor = grad
          } else {
            const grad = new fabric.Gradient<'radial'>({
              type: 'radial',
              coords: { x1: CANVAS_SIZE / 2, y1: CANVAS_SIZE / 2, x2: CANVAS_SIZE / 2, y2: CANVAS_SIZE / 2, r1: 0, r2: CANVAS_SIZE / 2 },
              colorStops: bg.gradient.colorStops,
            })
            canvas.backgroundColor = grad
          }
        }
        break
      }
    }
    canvas.renderAll()
  }

  // Add element functions
  const addHeadline = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const headingFont = brand.fonts.find(f => f.role === 'heading')?.family || 'Inter'
    const text = new fabric.IText('Overskrift', {
      left: 100,
      top: 200,
      fontSize: 72,
      fontFamily: headingFont,
      fontWeight: 'bold',
      fill: '#ffffff',
    })
    ;(text as unknown as { customType: string; brandToken: string }).customType = 'text'
    ;(text as unknown as { brandToken: string }).brandToken = 'headingFont'
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
  }

  const addSubtitle = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const bodyFont = brand.fonts.find(f => f.role === 'body')?.family || 'Inter'
    const text = new fabric.IText('Undertekst', {
      left: 100,
      top: 350,
      fontSize: 36,
      fontFamily: bodyFont,
      fontWeight: 'normal',
      fill: 'rgba(255,255,255,0.8)',
    })
    ;(text as unknown as { customType: string }).customType = 'text'
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
  }

  const addLogo = () => {
    const canvas = fabricRef.current
    if (!canvas || !brand.logo_url) return
    fabric.FabricImage.fromURL(brand.logo_url, { crossOrigin: 'anonymous' }).then(img => {
      const scale = Math.min(150 / img.width!, 150 / img.height!)
      img.set({
        left: 60,
        top: 60,
        scaleX: scale,
        scaleY: scale,
      })
      ;(img as unknown as { customType: string; useBrandLogo: boolean }).customType = 'logo'
      ;(img as unknown as { useBrandLogo: boolean }).useBrandLogo = true
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.renderAll()
    }).catch(() => {
      console.error('Failed to load logo')
    })
  }

  const addLogoFromUrl = (url: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then(img => {
      const scale = Math.min(150 / img.width!, 150 / img.height!)
      img.set({
        left: 60,
        top: 60,
        scaleX: scale,
        scaleY: scale,
      })
      ;(img as unknown as { customType: string; useBrandLogo: boolean }).customType = 'logo'
      ;(img as unknown as { useBrandLogo: boolean }).useBrandLogo = false
      ;(img as unknown as { imageUrl: string }).imageUrl = url
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.renderAll()
    }).catch(() => {
      console.error('Failed to load logo from URL')
    })
  }

  const addShape = (shapeType: 'rect' | 'circle' | 'triangle') => {
    const canvas = fabricRef.current
    if (!canvas) return
    const primaryColor = brand.colors.find(c => c.role === 'primary')?.hex || '#9933ff'
    let obj: fabric.FabricObject

    if (shapeType === 'circle') {
      obj = new fabric.Circle({
        left: 300,
        top: 300,
        radius: 80,
        fill: primaryColor,
        opacity: 0.9,
      })
    } else if (shapeType === 'triangle') {
      obj = new fabric.Triangle({
        left: 300,
        top: 300,
        width: 160,
        height: 160,
        fill: primaryColor,
        opacity: 0.9,
      })
    } else {
      obj = new fabric.Rect({
        left: 300,
        top: 300,
        width: 200,
        height: 120,
        fill: primaryColor,
        opacity: 0.9,
        rx: 8,
        ry: 8,
      })
    }
    ;(obj as unknown as { customType: string; shapeType: string }).customType = 'shape'
    ;(obj as unknown as { shapeType: string }).shapeType = shapeType
    canvas.add(obj)
    canvas.setActiveObject(obj)
    canvas.renderAll()
  }

  const addColorBlock = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const block = new fabric.Rect({
      left: 0,
      top: CANVAS_SIZE - 300,
      width: CANVAS_SIZE,
      height: 300,
      fill: 'rgba(0,0,0,0.6)',
    })
    ;(block as unknown as { customType: string }).customType = 'color-block'
    canvas.add(block)
    canvas.setActiveObject(block)
    canvas.renderAll()
  }

  const deleteSelected = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      canvas.remove(active)
      canvas.discardActiveObject()
      canvas.renderAll()
      setSelectedObject(null)
    }
  }

  const duplicateSelected = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return
    active.clone().then((cloned: fabric.FabricObject) => {
      cloned.set({ left: (active.left || 0) + 30, top: (active.top || 0) + 30 })
      canvas.add(cloned)
      canvas.setActiveObject(cloned)
      canvas.renderAll()
    })
  }

  const bringForward = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      canvas.bringObjectForward(active)
      canvas.renderAll()
    }
  }

  const sendBackward = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) {
      canvas.sendObjectBackwards(active)
      canvas.renderAll()
    }
  }

  // Extract elements from canvas for saving
  function extractElements(): OverlayElement[] {
    const canvas = fabricRef.current
    if (!canvas) return []
    const elements: OverlayElement[] = []

    canvas.getObjects().forEach((obj) => {
      const custom = obj as fabric.FabricObject & { customType?: string; brandToken?: string; useBrandLogo?: boolean; shapeType?: string }
      const base: Partial<OverlayElement> = {
        id: crypto.randomUUID(),
        left: obj.left || 0,
        top: obj.top || 0,
        width: obj.width || 0,
        height: obj.height || 0,
        angle: obj.angle || 0,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
        opacity: obj.opacity ?? 1,
      }

      if (custom.customType === 'text' || obj instanceof fabric.IText) {
        const t = obj as fabric.IText
        elements.push({
          ...base,
          type: 'text',
          text: t.text || '',
          fontSize: t.fontSize,
          fontFamily: t.fontFamily,
          fontWeight: t.fontWeight as string,
          fill: t.fill as string,
          textAlign: t.textAlign,
          brandToken: custom.brandToken,
        } as OverlayElement)
      } else if (custom.customType === 'logo') {
        elements.push({
          ...base,
          type: 'logo',
          useBrandLogo: custom.useBrandLogo ?? true,
        } as OverlayElement)
      } else if (custom.customType === 'shape') {
        const s = obj as fabric.Rect & { shapeType?: string }
        elements.push({
          ...base,
          type: 'shape',
          shapeType: custom.shapeType || 'rect',
          fill: s.fill as string,
          stroke: s.stroke as string,
          strokeWidth: s.strokeWidth,
          rx: (s as fabric.Rect).rx,
          ry: (s as fabric.Rect).ry,
        } as OverlayElement)
      } else if (custom.customType === 'color-block') {
        const r = obj as fabric.Rect
        elements.push({
          ...base,
          type: 'color-block',
          fill: r.fill as string,
          rx: r.rx,
          ry: r.ry,
        } as OverlayElement)
      }
    })

    return elements
  }

  const handleSave = async () => {
    const canvas = fabricRef.current
    if (!canvas) return
    setSaving(true)

    try {
      const elements = extractElements()

      // Generate thumbnail
      const thumbCanvas = document.createElement('canvas')
      thumbCanvas.width = 200
      thumbCanvas.height = 200
      const thumbCtx = thumbCanvas.getContext('2d')
      if (thumbCtx) {
        // Draw a checkerboard pattern for transparency
        thumbCtx.fillStyle = '#f0f0f0'
        thumbCtx.fillRect(0, 0, 200, 200)
        for (let x = 0; x < 200; x += 10) {
          for (let y = 0; y < 200; y += 10) {
            if ((x + y) % 20 === 0) {
              thumbCtx.fillStyle = '#e0e0e0'
              thumbCtx.fillRect(x, y, 10, 10)
            }
          }
        }
        // Draw canvas content scaled
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 200 / CANVAS_SIZE })
        const img = new Image()
        await new Promise<void>((resolve) => {
          img.onload = () => {
            thumbCtx.drawImage(img, 0, 0, 200, 200)
            resolve()
          }
          img.src = dataUrl
        })
      }

      const thumbnail = thumbCanvas.toDataURL('image/png', 0.7)

      await onSave({
        name: templateName,
        description: templateDesc,
        elements,
        canvas_background: canvasBackground,
        thumbnail,
      })
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  // Update background
  const updateBackground = (bg: CanvasBackground) => {
    setCanvasBackground(bg)
    const canvas = fabricRef.current
    if (canvas) applyBackground(canvas, bg)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if not editing text
        const canvas = fabricRef.current
        if (canvas) {
          const active = canvas.getActiveObject()
          if (active && active instanceof fabric.IText && (active as fabric.IText).isEditing) return
        }
        deleteSelected()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex, history])

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            ← Tilbake
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="bg-transparent text-white font-medium text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 w-48"
            placeholder="Malnavn..."
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={historyIndex <= 0} className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-700 transition-colors" title="Angre (⌘Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-700 transition-colors" title="Gjør om (⌘⇧Z)">
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Lagrer...' : 'Lagre mal'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Elements */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto p-4">
          <ElementToolbar
            brand={brand}
            onAddHeadline={addHeadline}
            onAddSubtitle={addSubtitle}
            onAddLogo={addLogo}
            onAddLogoFromUrl={addLogoFromUrl}
            onAddShape={addShape}
            onAddColorBlock={addColorBlock}
            canvasBackground={canvasBackground}
            onChangeBackground={updateBackground}
          />
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center bg-slate-900 overflow-auto p-8 relative">
          {/* Canvas toggles */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => setShowSampleBg(!showSampleBg)} className={`p-2 rounded-lg transition-colors ${showSampleBg ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Vis/skjul eksempelbakgrunn">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title="Vis rutenett">
              <Grid3x3 className="w-4 h-4" />
            </button>
          </div>

          <div className="relative" style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}>
            {/* Sample background or checkerboard for transparency */}
            <div className="absolute inset-0 rounded-lg overflow-hidden" style={showSampleBg ? {
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            } : {
              backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)',
              backgroundSize: '20px 20px',
            }}>
              {showSampleBg && (
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="30" width="100" height="60" rx="8" fill="white" />
                    <circle cx="40" cy="50" r="12" fill="white" opacity="0.6" />
                    <path d="M10 75 L45 55 L65 70 L85 45 L110 65 V82 C110 86.4183 106.418 90 102 90 H18 C13.5817 90 10 86.4183 10 82 V75Z" fill="white" opacity="0.4" />
                  </svg>
                </div>
              )}
            </div>
            {/* Grid overlay */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-10" style={{
                backgroundImage: `
                  linear-gradient(rgba(99,102,241,0.15) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(99,102,241,0.15) 1px, transparent 1px)
                `,
                backgroundSize: `${DISPLAY_SIZE / 12}px ${DISPLAY_SIZE / 12}px`,
              }} />
            )}
            <canvas
              ref={canvasRef}
              style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
              className="relative z-[5] rounded-lg shadow-2xl"
            />
          </div>
        </div>

        {/* Right sidebar - Properties */}
        <div className="w-72 bg-slate-800 border-l border-slate-700 overflow-y-auto p-4">
          {selectedObject ? (
            <PropertyPanel
              object={selectedObject}
              brand={brand}
              canvas={fabricRef.current}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onBringForward={bringForward}
              onSendBackward={sendBackward}
            />
          ) : (
            <div className="text-center text-slate-500 text-sm py-8">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Velg et element for å redigere egenskaper</p>
            </div>
          )}

          {/* Template description */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Beskrivelse</label>
            <textarea
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
              rows={3}
              placeholder="Beskriv malen..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
