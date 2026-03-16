import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BeforeAfterConfig } from './types'
import { DEFAULT_BRAND } from './types'

export const BeforeAfter: React.FC<{ config: BeforeAfterConfig }> = ({ config }) => {
  const frame = useCurrentFrame()
  useVideoConfig()
  const brand = config.brand || DEFAULT_BRAND

  // Phase 1: Show "Before" (0-60)
  // Phase 2: Wipe transition (60-100)
  // Phase 3: Show "After" (100-160)
  // Phase 4: Split view (160-180)

  const wipeProgress = interpolate(frame, [60, 100], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const splitMode = frame >= 140
  const splitProgress = interpolate(frame, [140, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Title animation
  const titleOpacity = interpolate(frame, [0, 15, 45, 60], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const titleScale = interpolate(frame, [0, 15], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Label animations
  const beforeLabelOpacity = interpolate(frame, [15, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const afterLabelOpacity = interpolate(frame, [100, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ backgroundColor: brand.background }}>
      {/* Title overlay */}
      {frame < 60 && (
        <AbsoluteFill
          style={{
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}
        >
          <div
            style={{
              backgroundColor: `${brand.primary}ee`,
              padding: '20px 40px',
              borderRadius: 16,
            }}
          >
            <h1 style={{ color: '#fff', fontSize: 52, fontWeight: 800, margin: 0 }}>
              {config.title || 'Før & Etter'}
            </h1>
          </div>
        </AbsoluteFill>
      )}

      {splitMode ? (
        // Split view
        <AbsoluteFill style={{ flexDirection: 'row', display: 'flex' }}>
          <div style={{ width: '50%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            {config.beforeImageUrl && (
              <Img
                src={config.beforeImageUrl}
                style={{ width: '200%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 40,
                left: 20,
                right: 20,
                textAlign: 'center',
                opacity: splitProgress,
              }}
            >
              <span
                style={{
                  backgroundColor: `${brand.secondary}dd`,
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {config.beforeLabel || 'Før'}
              </span>
            </div>
          </div>
          <div style={{ width: 4, backgroundColor: '#fff', zIndex: 5 }} />
          <div style={{ width: '50%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            {config.afterImageUrl && (
              <Img
                src={config.afterImageUrl}
                style={{ width: '200%', height: '100%', objectFit: 'cover', marginLeft: '-100%' }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 40,
                left: 20,
                right: 20,
                textAlign: 'center',
                opacity: splitProgress,
              }}
            >
              <span
                style={{
                  backgroundColor: `${brand.accent}dd`,
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {config.afterLabel || 'Etter'}
              </span>
            </div>
          </div>
        </AbsoluteFill>
      ) : (
        // Wipe transition
        <AbsoluteFill>
          {/* Before image */}
          {config.beforeImageUrl && (
            <Img
              src={config.beforeImageUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }}
            />
          )}
          {/* After image with clip */}
          {config.afterImageUrl && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                clipPath: `inset(0 ${100 - wipeProgress}% 0 0)`,
              }}
            >
              <Img
                src={config.afterImageUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Before label */}
          <div
            style={{
              position: 'absolute',
              top: 40,
              left: 30,
              opacity: beforeLabelOpacity,
            }}
          >
            <span
              style={{
                backgroundColor: `${brand.secondary}dd`,
                color: '#fff',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {config.beforeLabel || 'Før'}
            </span>
          </div>

          {/* After label */}
          {wipeProgress > 50 && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                right: 30,
                opacity: afterLabelOpacity,
              }}
            >
              <span
                style={{
                  backgroundColor: `${brand.accent}dd`,
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {config.afterLabel || 'Etter'}
              </span>
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
