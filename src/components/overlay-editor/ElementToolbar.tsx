'use client'

import { Type, Heading1, Image, Square, Circle, Triangle, RectangleHorizontal } from 'lucide-react'
import type { CanvasBackground } from '@/lib/custom-overlay-types'

type BrandProfile = {
  colors: Array<{ hex: string; role: string }>
  fonts: Array<{ family: string; role: string }>
  logo_url: string | null
  logos?: Array<{ url: string; label?: string }>
}

type Props = {
  brand: BrandProfile
  onAddHeadline: () => void
  onAddSubtitle: () => void
  onAddLogo: () => void
  onAddLogoFromUrl: (url: string) => void
  onAddShape: (type: 'rect' | 'circle' | 'triangle') => void
  onAddColorBlock: () => void
  canvasBackground: CanvasBackground
  onChangeBackground: (bg: CanvasBackground) => void
}

export function ElementToolbar({ brand, onAddHeadline, onAddSubtitle, onAddLogo, onAddLogoFromUrl, onAddShape, onAddColorBlock, canvasBackground, onChangeBackground }: Props) {
  const primaryColor = brand.colors.find(c => c.role === 'primary')?.hex || '#9933ff'
  const accentColor = brand.colors.find(c => c.role === 'accent')?.hex || '#ff6633'

  return (
    <div className="space-y-6">
      {/* Text elements */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tekst</h3>
        <div className="space-y-1.5">
          <button onClick={onAddHeadline} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left">
            <Heading1 className="w-4 h-4 text-slate-500" />
            Overskrift
          </button>
          <button onClick={onAddSubtitle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left">
            <Type className="w-4 h-4 text-slate-500" />
            Undertekst
          </button>
        </div>
      </div>

      {/* Brand elements */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Merkevare</h3>
        <div className="space-y-1.5">
          {brand.logo_url && (
            <button onClick={onAddLogo} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left">
              <Image className="w-4 h-4 text-slate-500" />
              Logo
            </button>
          )}
          <button onClick={onAddColorBlock} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left">
            <RectangleHorizontal className="w-4 h-4 text-slate-500" />
            Fargeblokk
          </button>
        </div>
      </div>

      {/* Logo picker from brand assets */}
      {(brand.logo_url || (brand.logos && brand.logos.length > 0)) && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Logoer</h3>
          <div className="grid grid-cols-3 gap-2">
            {brand.logo_url && (
              <button
                onClick={onAddLogo}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group"
                title="Hovedlogo"
              >
                <img src={brand.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded" />
                <span className="text-[9px] text-slate-500 group-hover:text-slate-300">Hoved</span>
              </button>
            )}
            {brand.logos?.map((logo, i) => (
              <button
                key={i}
                onClick={() => onAddLogoFromUrl(logo.url)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group"
                title={logo.label || `Logo ${i + 1}`}
              >
                <img src={logo.url} alt={logo.label || `Logo ${i + 1}`} className="w-10 h-10 object-contain rounded" />
                <span className="text-[9px] text-slate-500 group-hover:text-slate-300 truncate w-full text-center">{logo.label || `Logo ${i + 1}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shapes */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Former</h3>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => onAddShape('rect')} className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <Square className="w-5 h-5" />
            <span className="text-[10px]">Rektangel</span>
          </button>
          <button onClick={() => onAddShape('circle')} className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <Circle className="w-5 h-5" />
            <span className="text-[10px]">Sirkel</span>
          </button>
          <button onClick={() => onAddShape('triangle')} className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
            <Triangle className="w-5 h-5" />
            <span className="text-[10px]">Trekant</span>
          </button>
        </div>
      </div>

      {/* Brand colors */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Merkevarefarger</h3>
        <div className="flex flex-wrap gap-2">
          {brand.colors.map((c, i) => (
            <div key={i} className="group relative">
              <div
                className="w-8 h-8 rounded-lg border-2 border-slate-600 cursor-pointer hover:border-white transition-colors shadow-sm"
                style={{ backgroundColor: c.hex }}
                title={`${c.role}: ${c.hex}`}
              />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {c.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand fonts */}
      {brand.fonts.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Fonter</h3>
          <div className="space-y-1">
            {brand.fonts.map((f, i) => (
              <div key={i} className="text-xs text-slate-400 flex justify-between">
                <span style={{ fontFamily: f.family }}>{f.family}</span>
                <span className="text-slate-600">{f.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas background */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Bakgrunn</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => onChangeBackground({ type: 'transparent' })}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${canvasBackground.type === 'transparent' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              Gjennomsiktig
            </button>
            <button
              onClick={() => onChangeBackground({ type: 'solid', color: '#000000' })}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${canvasBackground.type === 'solid' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              Farge
            </button>
            <button
              onClick={() => onChangeBackground({
                type: 'gradient',
                gradient: { type: 'linear', colorStops: [{ offset: 0, color: primaryColor }, { offset: 1, color: accentColor }] }
              })}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${canvasBackground.type === 'gradient' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              Gradient
            </button>
          </div>
          {canvasBackground.type === 'solid' && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={canvasBackground.color || '#000000'}
                onChange={(e) => onChangeBackground({ type: 'solid', color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={canvasBackground.color || '#000000'}
                onChange={(e) => onChangeBackground({ type: 'solid', color: e.target.value })}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
