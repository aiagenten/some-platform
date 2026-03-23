import { registerRoot } from 'remotion'
import { Composition } from 'remotion'
import React from 'react'
import { VideoComposition } from './VideoComposition'
import type { VideoCompositionProps } from './VideoComposition'
import { SubtitleVideoComposition } from './SubtitleVideoComposition'
import type { SubtitleVideoCompositionProps } from './SubtitleVideoComposition'

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
      <Composition
        id="SubtitleVideoComposition"
        component={SubtitleVideoComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: '',
          musicUrl: null,
          musicVolume: 0.8,
          segments: [],
          subtitleStyle: 'sentences',
          subtitlePosition: 'bottom',
          subtitleColor: '#ffffff',
          subtitleBgColor: 'rgba(0,0,0,0.6)',
          overlayType: null,
          showOutro: false,
          brand: {
            brandName: '',
            primaryColor: '#9933ff',
            accentColor: '#6633ff',
            logoUrl: null,
            tagline: '',
            headingFont: 'sans-serif',
            bodyFont: 'sans-serif',
          },
          trimStart: 0,
          trimEnd: 0,
          durationInFrames: 300,
          outroDurationInFrames: 90,
          fps: 30,
        } as SubtitleVideoCompositionProps}
      />
    </>
  )
}

registerRoot(RemotionRoot)
