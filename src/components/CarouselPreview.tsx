'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'

export type CarouselSlide = {
  slide_index: number
  headline: string
  subtitle: string
  cta_text: string
  text_content: string
  image_url: string | null
  overlay_image_url: string | null
}

type Props = {
  slides: CarouselSlide[]
  caption: string
  brandName: string
  brandLogo?: string | null
  onSlideChange?: (index: number) => void
}

export default function CarouselPreview({ slides, caption, brandName, brandLogo, onSlideChange }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchDelta, setTouchDelta] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const displayName = brandName || 'Brand Name'
  const avatar = brandLogo || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=80`
  const truncatedCaption = caption?.length > 300 ? caption.substring(0, 300) + '...' : caption

  const goToSlide = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, index))
    setCurrentSlide(clamped)
    onSlideChange?.(clamped)
  }, [slides.length, onSlideChange])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setTouchDelta(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    setTouchDelta(e.touches[0].clientX - touchStart)
  }

  const handleTouchEnd = () => {
    if (touchStart === null) return
    if (touchDelta < -50) goToSlide(currentSlide + 1)
    else if (touchDelta > 50) goToSlide(currentSlide - 1)
    setTouchStart(null)
    setTouchDelta(0)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1)
      else if (e.key === 'ArrowRight') goToSlide(currentSlide + 1)
    }
    const el = containerRef.current
    el?.addEventListener('keydown', handleKey)
    return () => el?.removeEventListener('keydown', handleKey)
  }, [currentSlide, goToSlide])

  if (!slides.length) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-4">Instagram-preview (Karusell)</h3>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-w-[400px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-3">
          <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
          <span className="text-sm font-semibold text-slate-900">{displayName.toLowerCase().replace(/\s+/g, '')}</span>
          <MoreHorizontal className="w-5 h-5 ml-auto text-slate-400" />
        </div>

        {/* Carousel image area */}
        <div
          ref={containerRef}
          className="relative aspect-square bg-slate-100 overflow-hidden select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          tabIndex={0}
          role="region"
          aria-label="Carousel"
        >
          {/* Slides */}
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{
              width: `${slides.length * 100}%`,
              transform: `translateX(calc(-${currentSlide * (100 / slides.length)}% + ${touchStart !== null ? touchDelta : 0}px))`,
            }}
          >
            {slides.map((slide, i) => (
              <div key={i} className="relative h-full" style={{ width: `${100 / slides.length}%` }}>
                {(slide.overlay_image_url || slide.image_url) ? (
                  <img
                    src={slide.overlay_image_url || slide.image_url!}
                    alt={`Slide ${i + 1}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                    <div className="text-center p-6">
                      <p className="text-lg font-bold text-slate-600">{slide.headline || `Slide ${i + 1}`}</p>
                      {slide.subtitle && <p className="text-sm text-slate-500 mt-1">{slide.subtitle}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation arrows */}
          {currentSlide > 0 && (
            <button
              onClick={() => goToSlide(currentSlide - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
          )}
          {currentSlide < slides.length - 1 && (
            <button
              onClick={() => goToSlide(currentSlide + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          )}

          {/* Slide counter */}
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {currentSlide + 1}/{slides.length}
          </div>
        </div>

        {/* Action bar + dots */}
        <div className="p-3">
          <div className="flex items-center gap-4 mb-2">
            <Heart className="w-6 h-6 text-slate-700" />
            <MessageCircle className="w-6 h-6 text-slate-700" />
            <Send className="w-6 h-6 text-slate-700" />

            {/* Dots indicator */}
            <div className="flex-1 flex justify-center gap-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === currentSlide
                      ? 'bg-blue-500 w-2'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            <Bookmark className="w-6 h-6 text-slate-700" />
          </div>

          {/* Caption */}
          <div className="text-sm">
            <span className="font-semibold mr-1">{displayName.toLowerCase().replace(/\s+/g, '')}</span>
            <span className="text-slate-800 whitespace-pre-wrap">{truncatedCaption}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
