import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useVideoConfig } from 'remotion'
import type { VideoOverlayConfig } from '@/lib/video-overlay-templates'
import { LogoWatermark } from './overlays/LogoWatermark'
import { LowerThird } from './overlays/LowerThird'
import { FullBranded } from './overlays/FullBranded'
import { Outro } from './Outro'
import { SentenceSubtitle } from './subtitles/SentenceSubtitle'
import { KaraokeSubtitle } from './subtitles/KaraokeSubtitle'
import { BigWordSubtitle } from './subtitles/BigWordSubtitle'
import type { KaraokeSegment } from './subtitles/KaraokeSubtitle'

export type SubtitleVideoCompositionProps = {
  videoUrl: string
  musicUrl?: string | null
  musicVolume: number
  segments: KaraokeSegment[]
  subtitleStyle: 'sentences' | 'karaoke' | 'big-word' | 'none'
  subtitlePosition: 'bottom' | 'center' | 'top'
  subtitleColor: string
  subtitleBgColor: string
  overlayType: 'logo-watermark' | 'lower-third' | 'full-branded' | null
  showOutro: boolean
  brand: VideoOverlayConfig
  trimStart: number
  trimEnd: number
  durationInFrames: number
  outroDurationInFrames: number
  fps: number
}

export const SubtitleVideoComposition: React.FC<SubtitleVideoCompositionProps> = ({
  videoUrl,
  musicUrl,
  musicVolume,
  segments,
  subtitleStyle,
  subtitlePosition,
  subtitleColor,
  subtitleBgColor,
  overlayType,
  showOutro,
  brand,
  trimStart,
  durationInFrames,
  outroDurationInFrames,
}) => {
  const { fps } = useVideoConfig()
  const mainClipFrames = showOutro
    ? durationInFrames - outroDurationInFrames
    : durationInFrames

  const subtitleProps = {
    segments,
    position: subtitlePosition,
    textColor: subtitleColor,
    bgColor: subtitleBgColor,
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Layer 1: Video clip */}
      <Sequence from={0} durationInFrames={mainClipFrames}>
        <AbsoluteFill>
          <OffthreadVideo
            src={videoUrl}
            startFrom={Math.round(trimStart * fps)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>

        {/* Layer 2: Overlay */}
        {overlayType === 'logo-watermark' && (
          <LogoWatermark
            logoUrl={brand.logoUrl}
            brandName={brand.brandName}
            primaryColor={brand.primaryColor}
          />
        )}
        {overlayType === 'lower-third' && (
          <LowerThird
            logoUrl={brand.logoUrl}
            brandName={brand.brandName}
            tagline={brand.tagline}
            primaryColor={brand.primaryColor}
            accentColor={brand.accentColor}
          />
        )}
        {overlayType === 'full-branded' && (
          <FullBranded
            logoUrl={brand.logoUrl}
            brandName={brand.brandName}
            tagline={brand.tagline}
            primaryColor={brand.primaryColor}
            accentColor={brand.accentColor}
          />
        )}

        {/* Layer 3: Subtitles */}
        {subtitleStyle === 'sentences' && (
          <SentenceSubtitle {...subtitleProps} />
        )}
        {subtitleStyle === 'karaoke' && (
          <KaraokeSubtitle
            {...subtitleProps}
            accentColor={brand.accentColor}
          />
        )}
        {subtitleStyle === 'big-word' && (
          <BigWordSubtitle {...subtitleProps} />
        )}
      </Sequence>

      {/* Layer 4: Outro */}
      {showOutro && (
        <Sequence from={mainClipFrames} durationInFrames={outroDurationInFrames}>
          <Outro
            logoUrl={brand.logoUrl}
            brandName={brand.brandName}
            tagline={brand.tagline}
            primaryColor={brand.primaryColor}
            accentColor={brand.accentColor}
          />
        </Sequence>
      )}

      {/* Audio */}
      {musicUrl && (
        <Audio src={musicUrl} volume={musicVolume} />
      )}
    </AbsoluteFill>
  )
}
