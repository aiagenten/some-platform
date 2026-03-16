import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { PromoSlideshowConfig } from './types'
import { DEFAULT_BRAND } from './types'

export const PromoSlideshow: React.FC<{ config: PromoSlideshowConfig }> = ({ config }) => {
  const frame = useCurrentFrame()
  useVideoConfig()
  const brand = config.brand || DEFAULT_BRAND
  const slides = config.slides || []
  const slideDuration = config.slideDuration || 90
  const transitionDuration = config.transitionDuration || 15

  if (slides.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: brand.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: brand.text, fontSize: 40 }}>Legg til slides</p>
      </AbsoluteFill>
    )
  }

  const currentSlideIndex = Math.min(
    Math.floor(frame / slideDuration),
    slides.length - 1
  )
  const slideFrame = frame - currentSlideIndex * slideDuration
  const slide = slides[currentSlideIndex]

  // Fade in/out
  const opacity = interpolate(
    slideFrame,
    [0, transitionDuration, slideDuration - transitionDuration, slideDuration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  // Subtle zoom
  const scale = interpolate(
    slideFrame,
    [0, slideDuration],
    [1, 1.05],
    { extrapolateRight: 'clamp' }
  )

  // Text animation
  const textY = interpolate(
    slideFrame,
    [transitionDuration, transitionDuration + 15],
    [30, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const textOpacity = interpolate(
    slideFrame,
    [transitionDuration, transitionDuration + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return (
    <AbsoluteFill style={{ backgroundColor: brand.background }}>
      {/* Background image */}
      <AbsoluteFill style={{ opacity }}>
        {slide.imageUrl && (
          <Img
            src={slide.imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale})`,
            }}
          />
        )}
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50%',
            background: `linear-gradient(transparent, ${brand.primary}dd)`,
          }}
        />
      </AbsoluteFill>

      {/* Text */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          padding: '60px 40px',
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <h1 style={{ color: '#fff', fontSize: 56, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p style={{ color: '#ffffffcc', fontSize: 28, marginTop: 12 }}>
            {slide.subtitle}
          </p>
        )}
      </AbsoluteFill>

      {/* Logo */}
      {config.logoUrl && (
        <div style={{ position: 'absolute', top: 40, left: 40 }}>
          <Img src={config.logoUrl} style={{ height: 48 }} />
        </div>
      )}

      {/* Slide indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === currentSlideIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === currentSlideIndex ? '#fff' : '#ffffff66',
              transition: 'width 0.3s',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  )
}
