'use client'

import { useState, useEffect } from 'react'
import * as fabric from 'fabric'
import { Trash2, Copy, ArrowUp, ArrowDown, RotateCw } from 'lucide-react'

type BrandProfile = {
  colors: Array<{ hex: string; role: string }>
  fonts: Array<{ family: string; role: string }>
  logo_url: string | null
}

type Props = {
  object: fabric.FabricObject
  brand: BrandProfile
  canvas: fabric.Canvas | null
  onDelete: () => void
  onDuplicate: () => void
  onBringForward: () => void
  onSendBackward: () => void
}

export function PropertyPanel({ object, brand, canvas, onDelete, onDuplicate, onBringForward, onSendBackward }: Props) {
  const [fill, setFill] = useState((object.fill as string) || '#ffffff')
  const [opacity, setOpacity] = useState(Math.round((object.opacity ?? 1) * 100))
  const [angle, setAngle] = useState(Math.round(object.angle || 0))
  const [fontSize, setFontSize] = useState(0)
  const [fontFamily, setFontFamily] = useState('')
  const [fontWeight, setFontWeight] = useState('normal')
  const [stroke, setStroke] = useState((object.stroke as string) || '')
  const [strokeWidth, setStrokeWidth] = useState(object.strokeWidth || 0)
  const [rx, setRx] = useState(0)

  const isText = object instanceof fabric.IText
  const isRect = object instanceof fabric.Rect

  useEffect(() => {
    setFill((object.fill as string) || '#ffffff')
    setOpacity(Math.round((object.opacity ?? 1) * 100))
    setAngle(Math.round(object.angle || 0))
    setStroke((object.stroke as string) || '')
    setStrokeWidth(object.strokeWidth || 0)

    if (isText) {
      const t = object as fabric.IText
      setFontSize(t.fontSize || 48)
      setFontFamily(t.fontFamily || 'Inter')
      setFontWeight((t.fontWeight as string) || 'normal')
    }
    if (isRect) {
      setRx((object as fabric.Rect).rx || 0)
    }
  }, [object, isText, isRect])

  const updateProp = (prop: string, value: unknown) => {
    object.set(prop as keyof fabric.FabricObject, value as never)
    canvas?.renderAll()
  }

  const handleFillChange = (val: string) => {
    setFill(val)
    updateProp('fill', val)
  }

  const handleOpacityChange = (val: number) => {
    setOpacity(val)
    updateProp('opacity', val / 100)
  }

  const handleAngleChange = (val: number) => {
    setAngle(val)
    updateProp('angle', val)
  }

  const handleFontSizeChange = (val: number) => {
    setFontSize(val)
    updateProp('fontSize', val)
  }

  const handleFontFamilyChange = (val: string) => {
    setFontFamily(val)
    updateProp('fontFamily', val)
  }

  const handleFontWeightChange = (val: string) => {
    setFontWeight(val)
    updateProp('fontWeight', val)
  }

  const handleStrokeChange = (val: string) => {
    setStroke(val)
    updateProp('stroke', val)
  }

  const handleStrokeWidthChange = (val: number) => {
    setStrokeWidth(val)
    updateProp('strokeWidth', val)
  }

  const handleRxChange = (val: number) => {
    setRx(val)
    updateProp('rx', val)
    updateProp('ry', val)
  }

  const customType = (object as fabric.FabricObject & { customType?: string }).customType || 'element'
  const typeLabels: Record<string, string> = {
    text: 'Tekst',
    logo: 'Logo',
    shape: 'Form',
    'color-block': 'Fargeblokk',
    element: 'Element',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{typeLabels[customType]}</h3>
        <div className="flex items-center gap-1">
          <button onClick={onSendBackward} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors" title="Send bakover">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onBringForward} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors" title="Bring fremover">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDuplicate} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors" title="Dupliser (⌘D)">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-slate-700 transition-colors" title="Slett (Del)">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Text properties */}
      {isText && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Skriftstørrelse</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={12}
                max={200}
                value={fontSize}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <input
                type="number"
                value={fontSize}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Font</label>
            <select
              value={fontFamily}
              onChange={(e) => handleFontFamilyChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
            >
              {brand.fonts.map((f) => (
                <option key={f.family} value={f.family}>{f.family} ({f.role})</option>
              ))}
              <option value="Inter">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Vekt</label>
            <div className="flex gap-1">
              {['normal', 'bold', '300', '500', '700', '900'].map((w) => (
                <button
                  key={w}
                  onClick={() => handleFontWeightChange(w)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${fontWeight === w ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                >
                  {w === 'normal' ? 'Normal' : w === 'bold' ? 'Bold' : w}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fill color */}
      {customType !== 'logo' && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Farge</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fill.startsWith('rgba') ? '#ffffff' : fill}
              onChange={(e) => handleFillChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
            />
            <input
              type="text"
              value={fill}
              onChange={(e) => handleFillChange(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
          {/* Quick brand color buttons */}
          <div className="flex gap-1.5 mt-2">
            {brand.colors.map((c, i) => (
              <button
                key={i}
                onClick={() => handleFillChange(c.hex)}
                className="w-6 h-6 rounded border border-slate-600 hover:border-white transition-colors"
                style={{ backgroundColor: c.hex }}
                title={c.role}
              />
            ))}
            <button
              onClick={() => handleFillChange('#ffffff')}
              className="w-6 h-6 rounded border border-slate-600 hover:border-white transition-colors bg-white"
              title="Hvit"
            />
            <button
              onClick={() => handleFillChange('#000000')}
              className="w-6 h-6 rounded border border-slate-600 hover:border-white transition-colors bg-black"
              title="Svart"
            />
          </div>
        </div>
      )}

      {/* Stroke */}
      {(customType === 'shape' || customType === 'color-block') && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Kantlinje</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={stroke || '#ffffff'}
              onChange={(e) => handleStrokeChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
            />
            <input
              type="number"
              value={strokeWidth}
              min={0}
              max={20}
              onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-center"
              placeholder="px"
            />
          </div>
        </div>
      )}

      {/* Border radius for rects */}
      {isRect && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Hjørneradius</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={rx}
              onChange={(e) => handleRxChange(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-xs text-slate-400 w-8 text-right">{rx}</span>
          </div>
        </div>
      )}

      {/* Opacity */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Gjennomsiktighet</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => handleOpacityChange(Number(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs text-slate-400 w-8 text-right">{opacity}%</span>
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Rotasjon</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={360}
            value={angle}
            onChange={(e) => handleAngleChange(Number(e.target.value))}
            className="flex-1 accent-indigo-500"
          />
          <span className="text-xs text-slate-400 w-8 text-right">{angle}°</span>
          <button onClick={() => handleAngleChange(0)} className="p-1 text-slate-500 hover:text-white" title="Nullstill">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Position info */}
      <div className="text-[10px] text-slate-600 pt-2 border-t border-slate-700">
        <div className="flex justify-between">
          <span>X: {Math.round(object.left || 0)}</span>
          <span>Y: {Math.round(object.top || 0)}</span>
          <span>W: {Math.round((object.width || 0) * (object.scaleX || 1))}</span>
          <span>H: {Math.round((object.height || 0) * (object.scaleY || 1))}</span>
        </div>
      </div>
    </div>
  )
}
