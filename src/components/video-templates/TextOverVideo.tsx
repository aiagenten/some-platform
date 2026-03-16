import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion'
import type { TextOverVideoConfig } from './types'
import { DEFAULT_BRAND } from './types'

export const TextOverVideo: React.FC<{ config: TextOverVideoConfig }> = ({ config }) => {
  const frame = useCurrentFrame()
  const brand = config.brand || DEFAULT_BRAND
  const lines = config.lines || []

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: '10%', left: 0, right: 0, textAlign: 'center' },
    center: { top: '40%', left: 0, right: 0, textAlign: 'center' },
    bottom: { bottom: '15%', left: 0, right: 0, textAlign: 'center' },
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background video */}
      {config.videoUrl ? (
        <OffthreadVideo
          src={config.videoUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${brand.primary}, ${brand.secondary})`,
          }}
        />
      )}

      {/* Dark overlay */}
      <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />

      {/* Text lines */}
      {lines.map((line, i) => {
        const isVisible = frame >= line.startFrame && frame <= line.endFrame
        if (!isVisible) return null

        const lineFrame = frame - line.startFrame
        const lineDuration = line.endFrame - line.startFrame

        const opacity = interpolate(
          lineFrame,
          [0, 10, lineDuration - 10, lineDuration],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )

        const y = interpolate(
          lineFrame,
          [0, 10],
          [20, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )

        const position = line.position || 'center'
        const fontSize = line.fontSize || 48

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...positionStyles[position],
              opacity,
              transform: `translateY(${y}px)`,
              padding: '0 40px',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontSize,
                fontWeight: 700,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                lineHeight: 1.3,
                display: 'inline-block',
                backgroundColor: `${brand.primary}99`,
                padding: '8px 20px',
                borderRadius: 8,
              }}
            >
              {line.text}
            </span>
          </div>
        )
      })}

      {/* Fallback when no lines */}
      {lines.length === 0 && (
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#fff', fontSize: 40, opacity: 0.6 }}>Legg til tekstlinjer</p>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
