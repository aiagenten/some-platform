import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { QuoteCardConfig } from './types'
import { DEFAULT_BRAND } from './types'

// Animated background components
function GradientBg({ brand, frame }: { brand: typeof DEFAULT_BRAND; frame: number }) {
  const angle = interpolate(frame, [0, 150], [0, 360], { extrapolateRight: 'extend' })
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${brand.primary}, ${brand.secondary}, ${brand.accent})`,
        backgroundSize: '400% 400%',
      }}
    />
  )
}

function WavesBg({ brand, frame }: { brand: typeof DEFAULT_BRAND; frame: number }) {
  const offset = frame * 2
  return (
    <AbsoluteFill style={{ backgroundColor: brand.primary, overflow: 'hidden' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: -100 + i * 80,
            left: -200,
            width: '200%',
            height: 400,
            borderRadius: '50%',
            backgroundColor: `${brand.secondary}${30 + i * 15}`,
            transform: `translateX(${Math.sin((offset + i * 40) / 60) * 100}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  )
}

function ParticlesBg({ brand, frame }: { brand: typeof DEFAULT_BRAND; frame: number }) {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: ((i * 137) % 100),
    startY: 110 + ((i * 31) % 40),
    speed: 0.3 + (i % 5) * 0.1,
    size: 4 + (i % 8),
    opacity: 0.2 + (i % 5) * 0.1,
  }))

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${brand.primary}, ${brand.secondary})`,
        overflow: 'hidden',
      }}
    >
      {particles.map((p, i) => {
        const y = p.startY - frame * p.speed
        const adjustedY = ((y % 130) + 130) % 130 - 10
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${adjustedY}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: `${brand.accent}`,
              opacity: p.opacity,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

export const QuoteCard: React.FC<{ config: QuoteCardConfig }> = ({ config }) => {
  const frame = useCurrentFrame()
  useVideoConfig()
  const brand = config.brand || DEFAULT_BRAND
  const bgStyle = config.backgroundStyle || 'gradient'

  // Quote mark animation
  const quoteMarkOpacity = interpolate(frame, [0, 20], [0, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Quote text
  const textOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const textY = interpolate(frame, [10, 30], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Author
  const authorOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const authorX = interpolate(frame, [40, 55], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Decorative line
  const lineWidth = interpolate(frame, [35, 50], [0, 60], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill>
      {/* Animated background */}
      {bgStyle === 'gradient' && <GradientBg brand={brand} frame={frame} />}
      {bgStyle === 'waves' && <WavesBg brand={brand} frame={frame} />}
      {bgStyle === 'particles' && <ParticlesBg brand={brand} frame={frame} />}

      {/* Content overlay */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 50px',
        }}
      >
        {/* Large quote mark */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            fontSize: 300,
            color: '#fff',
            opacity: quoteMarkOpacity,
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <p
          style={{
            color: '#fff',
            fontSize: config.quote && config.quote.length > 100 ? 36 : 44,
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.4,
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            maxWidth: '90%',
            zIndex: 1,
          }}
        >
          {config.quote || 'Ditt sitat her...'}
        </p>

        {/* Decorative line */}
        <div
          style={{
            width: lineWidth,
            height: 3,
            backgroundColor: brand.accent,
            margin: '30px 0',
            borderRadius: 2,
            zIndex: 1,
          }}
        />

        {/* Author */}
        <div
          style={{
            opacity: authorOpacity,
            transform: `translateX(${authorX}px)`,
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          <p
            style={{
              color: '#fff',
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            — {config.author || 'Forfatter'}
          </p>
          {config.authorTitle && (
            <p
              style={{
                color: '#ffffffaa',
                fontSize: 20,
                marginTop: 8,
              }}
            >
              {config.authorTitle}
            </p>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
