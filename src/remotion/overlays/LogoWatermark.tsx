import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'

type Props = {
  logoUrl: string | null
  brandName: string
  primaryColor: string
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export const LogoWatermark: React.FC<Props> = ({
  logoUrl,
  brandName,
  position = 'top-right',
}) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 20], [0, 0.7], {
    extrapolateRight: 'clamp',
  })

  const positionStyles: React.CSSProperties = {
    'top-left': { top: 24, left: 24 },
    'top-right': { top: 24, right: 24 },
    'bottom-left': { bottom: 24, left: 24 },
    'bottom-right': { bottom: 24, right: 24 },
  }[position]

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          ...positionStyles,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {logoUrl && (
          <Img
            src={logoUrl}
            style={{ height: 28, width: 'auto', objectFit: 'contain' }}
          />
        )}
        <span
          style={{
            color: '#ffffff',
            fontSize: 24,
            fontWeight: 600,
            fontFamily: 'sans-serif',
            textShadow: `0 1px 3px rgba(0,0,0,0.5)`,
          }}
        >
          {brandName}
        </span>
      </div>
    </AbsoluteFill>
  )
}
