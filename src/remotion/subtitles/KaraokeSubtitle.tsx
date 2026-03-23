import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

export type WordEntry = {
  word: string
  start: number
  end: number
}

export type KaraokeSegment = {
  start: number
  end: number
  text: string
  words?: WordEntry[]
}

type Props = {
  segments: KaraokeSegment[]
  position: 'bottom' | 'center' | 'top'
  textColor: string
  bgColor: string
  accentColor?: string
}

export const KaraokeSubtitle: React.FC<Props> = ({
  segments,
  position,
  textColor,
  bgColor,
  accentColor = '#facc15',
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
  const fadeFrames = Math.min(6, segLen * 0.15)

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

  // If we have word-level timestamps, highlight active word
  const words = currentSegment.words

  const renderContent = () => {
    if (!words || words.length === 0) {
      return (
        <span
          style={{
            color: textColor,
            fontSize: 44,
            fontWeight: 700,
            fontFamily: 'sans-serif',
          }}
        >
          {currentSegment.text}
        </span>
      )
    }

    return (
      <span style={{ display: 'inline' }}>
        {words.map((w, i) => {
          const isActive = currentTime >= w.start && currentTime < w.end
          const isPast = currentTime >= w.end
          return (
            <span
              key={i}
              style={{
                color: isActive ? accentColor : isPast ? `${textColor}88` : textColor,
                fontSize: 44,
                fontWeight: isActive ? 800 : 700,
                fontFamily: 'sans-serif',
                transition: 'color 0.05s',
                marginRight: 6,
                textDecoration: isActive ? 'underline' : 'none',
                textDecorationColor: accentColor,
              }}
            >
              {w.word}
            </span>
          )
        })}
      </span>
    )
  }

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
        <div
          style={{
            display: 'inline-block',
            backgroundColor: bgColor,
            padding: '10px 20px',
            borderRadius: 12,
            textShadow: bgColor === 'transparent' ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
            lineHeight: 1.4,
          }}
        >
          {renderContent()}
        </div>
      </div>
    </AbsoluteFill>
  )
}
