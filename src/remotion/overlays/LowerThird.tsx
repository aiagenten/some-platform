import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

type Props = {
  logoUrl: string | null
  brandName: string
  tagline: string
  primaryColor: string
  accentColor: string
}

export const LowerThird: React.FC<Props> = ({
  logoUrl,
  brandName,
  tagline,
  primaryColor,
  accentColor,
}) => {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  // Slide in after 1 second, stay for 3 seconds, then slide out
  const enterFrame = fps * 1
  const exitFrame = fps * 4

  const slideIn = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 15, stiffness: 80 },
  })

  const slideOut = frame > exitFrame
    ? spring({
        frame: frame - exitFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      })
    : 0

  const translateX = interpolate(slideIn - slideOut, [0, 1], [-width * 0.5, 0])
  const opacity = frame < enterFrame ? 0 : interpolate(slideOut, [0, 1], [1, 0], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: 0,
          right: 0,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            height: 3,
            backgroundColor: accentColor,
            marginLeft: '5%',
            marginRight: '20%',
            marginBottom: 0,
          }}
        />
        {/* Main bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 5%',
            background: `linear-gradient(135deg, ${primaryColor}ee, ${primaryColor}cc)`,
            marginRight: '20%',
          }}
        >
          {logoUrl && (
            <Img
              src={logoUrl}
              style={{ height: 32, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                color: '#ffffff',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'sans-serif',
                letterSpacing: 0.5,
              }}
            >
              {brandName}
            </span>
            {tagline && (
              <span
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 13,
                  fontWeight: 400,
                  fontFamily: 'sans-serif',
                }}
              >
                {tagline}
              </span>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
