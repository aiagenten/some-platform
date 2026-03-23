'use client'

import { Player } from '@remotion/player'
import { SubtitleVideoComposition } from './SubtitleVideoComposition'
import type { SubtitleVideoCompositionProps } from './SubtitleVideoComposition'

type SubtitlePreviewProps = Omit<SubtitleVideoCompositionProps, 'fps' | 'durationInFrames' | 'outroDurationInFrames'> & {
  durationSec: number
  aspectRatio?: string
}

export const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({
  durationSec,
  aspectRatio = '9:16',
  showOutro,
  ...rest
}) => {
  const fps = 30
  const outroDurationSec = showOutro ? 2.5 : 0
  const totalDurationInFrames = Math.max(1, Math.ceil((durationSec + outroDurationSec) * fps))
  const outroDurationInFrames = Math.ceil(outroDurationSec * fps)

  const dimensions: Record<string, { width: number; height: number }> = {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
  }
  const dim = dimensions[aspectRatio] ?? { width: 1080, height: 1920 }

  const maxHeight = 480
  const scale = maxHeight / dim.height
  const playerWidth = Math.round(dim.width * scale)
  const playerHeight = Math.round(dim.height * scale)

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Player
        component={SubtitleVideoComposition}
        inputProps={{
          ...rest,
          showOutro,
          fps,
          durationInFrames: totalDurationInFrames,
          outroDurationInFrames,
        }}
        durationInFrames={totalDurationInFrames}
        compositionWidth={dim.width}
        compositionHeight={dim.height}
        fps={fps}
        style={{
          width: playerWidth,
          height: playerHeight,
          borderRadius: 12,
          overflow: 'hidden',
        }}
        controls
        autoPlay={false}
      />
    </div>
  )
}
