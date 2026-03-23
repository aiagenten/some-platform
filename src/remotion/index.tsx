import { registerRoot } from 'remotion'
import { Composition } from 'remotion'
import React from 'react'
import { VideoComposition } from './VideoComposition'
import type { VideoCompositionProps } from './VideoComposition'

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoComposition"
        component={VideoComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: '',
          musicUrl: null,
          overlayType: null,
          showOutro: false,
          durationInFrames: 300,
          outroDurationInFrames: 90,
          fps: 30,
          brand: {
            brandName: '',
            primaryColor: '#9933ff',
            accentColor: '#6633ff',
            logoUrl: null,
          },
        } as VideoCompositionProps}
      />
    </>
  )
}

registerRoot(RemotionRoot)
