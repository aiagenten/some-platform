import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

type Props = {
  logoUrl: string | null
  brandName: string
  tagline: string
  primaryColor: string
  accentColor: string
}

export const Outro: React.FC<Props> = ({
  logoUrl,
  brandName,
  tagline,
  primaryColor,
  accentColor,
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  // Logo scales in with spring
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  })

  // Brand name fades in after logo
  const nameOpacity = interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const nameTranslateY = interpolate(frame, [fps * 0.4, fps * 0.8], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Tagline fades in after brand name
  const taglineOpacity = interpolate(frame, [fps * 0.7, fps * 1.1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Subtle gradient animation - rotating gradient angle
  const gradientAngle = interpolate(frame, [0, fps * 3], [135, 155])

  return (
    <AbsoluteFill>
      {/* Animated gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${gradientAngle}deg, ${primaryColor}, #111118 60%, ${primaryColor}33)`,
        }}
      />

      {/* Subtle floating particles */}
      {[0, 1, 2, 3, 4].map(i => {
        const particleY = interpolate(
          frame,
          [0, fps * 3],
          [height * (0.3 + i * 0.12), height * (0.2 + i * 0.1)],
        )
        const particleX = width * (0.15 + i * 0.18)
        const particleOpacity = interpolate(
          frame,
          [fps * (i * 0.2), fps * (i * 0.2 + 0.5), fps * 2.5, fps * 3],
          [0, 0.15, 0.15, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: particleX,
              top: particleY,
              width: 4 + i * 2,
              height: 4 + i * 2,
              borderRadius: '50%',
              backgroundColor: accentColor,
              opacity: particleOpacity,
              filter: 'blur(2px)',
            }}
          />
        )
      })}

      {/* Centered content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {/* Logo */}
        {logoUrl && (
          <div style={{ transform: `scale(${logoScale})` }}>
            <Img
              src={logoUrl}
              style={{
                height: 64,
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
              }}
            />
          </div>
        )}

        {/* Brand name */}
        <div
          style={{
            opacity: nameOpacity,
            transform: `translateY(${nameTranslateY}px)`,
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontSize: 28,
              fontWeight: 700,
              fontFamily: 'sans-serif',
              letterSpacing: 1,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {brandName}
          </span>
        </div>

        {/* Accent line */}
        <div
          style={{
            width: interpolate(frame, [fps * 0.5, fps * 1], [0, 50], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            height: 2,
            backgroundColor: accentColor,
            borderRadius: 1,
          }}
        />

        {/* Tagline */}
        {tagline && (
          <div style={{ opacity: taglineOpacity }}>
            <span
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                fontWeight: 400,
                fontFamily: 'sans-serif',
                letterSpacing: 0.5,
              }}
            >
              {tagline}
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
