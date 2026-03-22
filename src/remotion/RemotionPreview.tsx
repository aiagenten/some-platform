'use client'

import { Player } from '@remotion/player'
import { VideoComposition, type VideoCompositionProps } from './VideoComposition'

type RemotionPreviewProps = {
  videoUrl: string
  musicUrl?: string | null
  overlayType: VideoCompositionProps['overlayType']
  showOutro: boolean
  durationSec: number
  aspectRatio: string
  brand: VideoCompositionProps['brand']
}

export const RemotionPreview: React.FC<RemotionPreviewProps> = ({
  videoUrl,
  musicUrl,
  overlayType,
  showOutro,
  durationSec,
  aspectRatio,
  brand,
}) => {
  const fps = 30
  const outroDurationSec = showOutro ? 2.5 : 0
  const totalDurationInFrames = Math.ceil((durationSec + outroDurationSec) * fps)
  const outroDurationInFrames = Math.ceil(outroDurationSec * fps)

  const dimensions = {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
  }[aspectRatio] || { width: 1080, height: 1920 }

  // Scale player to fit container
  const maxHeight = 400
  const scale = maxHeight / dimensions.height
  const playerWidth = Math.round(dimensions.width * scale)
  const playerHeight = Math.round(dimensions.height * scale)

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Player
        component={VideoComposition}
        inputProps={{
          videoUrl,
          musicUrl: musicUrl || null,
          overlayType,
          showOutro,
          durationInFrames: totalDurationInFrames,
          outroDurationInFrames,
          fps,
          brand,
        }}
        durationInFrames={totalDurationInFrames}
        compositionWidth={dimensions.width}
        compositionHeight={dimensions.height}
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
