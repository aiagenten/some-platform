import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'

type Props = {
  logoUrl: string | null
  brandName: string
  tagline: string
  primaryColor: string
  accentColor: string
}

export const FullBranded: React.FC<Props> = ({
  logoUrl,
  brandName,
  tagline,
  accentColor,
}) => {
  const frame = useCurrentFrame()
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {/* Top-left logo */}
      {logoUrl && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            padding: '6px 10px',
            borderRadius: 8,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Img
            src={logoUrl}
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '35%',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        }}
      />

      {/* Bottom text */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: 40,
            height: 3,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 6,
          }}
        />
        <span
          style={{
            color: '#ffffff',
            fontSize: 32,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          {brandName}
        </span>
        {tagline && (
          <span
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 22,
              fontWeight: 400,
              fontFamily: 'sans-serif',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            {tagline}
          </span>
        )}
      </div>
    </AbsoluteFill>
  )
}
