import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { KaraokeSegment, WordEntry } from './KaraokeSubtitle'

type Props = {
  segments: KaraokeSegment[]
  position: 'bottom' | 'center' | 'top'
  textColor: string
  bgColor: string
}

// Flatten all words from segments into a chronological list
function flattenWords(segments: KaraokeSegment[]): WordEntry[] {
  const words: WordEntry[] = []
  for (const seg of segments) {
    if (seg.words && seg.words.length > 0) {
      words.push(...seg.words)
    } else {
      // No word timestamps — split segment text into fake equal-duration words
      const rawWords = seg.text.trim().split(/\s+/)
      const duration = seg.end - seg.start
      const perWord = duration / rawWords.length
      rawWords.forEach((w, i) => {
        words.push({
          word: w,
          start: seg.start + i * perWord,
          end: seg.start + (i + 1) * perWord,
        })
      })
    }
  }
  return words
}

export const BigWordSubtitle: React.FC<Props> = ({
  segments,
  position,
  textColor,
  bgColor,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const currentTime = frame / fps

  const allWords = flattenWords(segments)
  const currentWord = allWords.find(w => currentTime >= w.start && currentTime < w.end)

  if (!currentWord) return null

  const wordStartFrame = currentWord.start * fps
  const wordDurationFrames = (currentWord.end - currentWord.start) * fps

  // Pop-in spring animation
  const scale = spring({
    frame: frame - wordStartFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
    durationInFrames: Math.max(8, wordDurationFrames * 0.4),
  })

  // Fade out at end
  const fadeOutStart = wordStartFrame + wordDurationFrames * 0.75
  const opacity = interpolate(
    frame,
    [fadeOutStart, wordStartFrame + wordDurationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  const positionStyle: React.CSSProperties =
    position === 'bottom'
      ? { bottom: '15%', top: 'auto' }
      : position === 'top'
        ? { top: '15%', bottom: 'auto' }
        : { top: '50%', transform: 'translateY(-50%)' }

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          width: '90%',
          textAlign: 'center',
          transform:
            position === 'center'
              ? `translate(-50%, -50%) scale(${scale})`
              : `translateX(-50%) scale(${scale})`,
          ...positionStyle,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundColor: bgColor,
            color: textColor,
            fontSize: 96,
            fontWeight: 900,
            fontFamily: 'sans-serif',
            lineHeight: 1.1,
            padding: '8px 24px',
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: -1,
            textShadow: bgColor === 'transparent' ? '0 4px 16px rgba(0,0,0,0.9)' : 'none',
          }}
        >
          {currentWord.word}
        </span>
      </div>
    </AbsoluteFill>
  )
}
