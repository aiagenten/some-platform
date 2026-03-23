import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export type Segment = {
  start: number
  end: number
  text: string
}

type Props = {
  segments: Segment[]
  position: 'bottom' | 'center' | 'top'
  textColor: string
  bgColor: string
}

export const SentenceSubtitle: React.FC<Props> = ({
  segments,
  position,
  textColor,
  bgColor,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const currentTime = frame / fps

  const currentSegment = segments.find(
    seg => currentTime >= seg.start && currentTime < seg.end,
  )

  if (!currentSegment) return null

  const segStart = currentSegment.start * fps
  const segEnd = currentSegment.end * fps
  const segLen = segEnd - segStart

  // Fade in first 0.2s, fade out last 0.2s
  const fadeFrames = Math.min(6, segLen * 0.2)
  const opacity = interpolate(
    frame,
    [segStart, segStart + fadeFrames, segEnd - fadeFrames, segEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  const positionStyle: React.CSSProperties =
    position === 'bottom'
      ? { bottom: 120, top: 'auto' }
      : position === 'top'
        ? { top: 120, bottom: 'auto' }
        : { top: '50%', transform: 'translateY(-50%)' }

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: position === 'center' ? 'translate(-50%, -50%)' : 'translateX(-50%)',
          width: '88%',
          textAlign: 'center',
          ...positionStyle,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundColor: bgColor,
            color: textColor,
            fontSize: 44,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            lineHeight: 1.3,
            padding: '10px 20px',
            borderRadius: 12,
            textShadow: bgColor === 'transparent' ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
          }}
        >
          {currentSegment.text}
        </span>
      </div>
    </AbsoluteFill>
  )
}
