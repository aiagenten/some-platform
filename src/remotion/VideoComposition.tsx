import { AbsoluteFill, OffthreadVideo, Sequence, Audio } from 'remotion'
import type { VideoOverlayConfig } from '@/lib/video-overlay-templates'
import { LogoWatermark } from './overlays/LogoWatermark'
import { LowerThird } from './overlays/LowerThird'
import { FullBranded } from './overlays/FullBranded'
import { Outro } from './Outro'

export type VideoCompositionProps = {
  videoUrl: string
  musicUrl?: string | null
  overlayType: 'logo-watermark' | 'lower-third' | 'full-branded' | null
  showOutro: boolean
  durationInFrames: number
  outroDurationInFrames: number
  fps: number
  brand: VideoOverlayConfig
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  videoUrl,
  musicUrl,
  overlayType,
  showOutro,
  durationInFrames,
  outroDurationInFrames,
  brand,
}) => {
  const mainClipFrames = showOutro
    ? durationInFrames - outroDurationInFrames
    : durationInFrames

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Layer 1: Raw video clip */}
      <Sequence from={0} durationInFrames={mainClipFrames}>
        <AbsoluteFill>
          <OffthreadVideo
            src={videoUrl}
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
      </Sequence>

      {/* Layer 3: Outro */}
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

      {/* Audio layer */}
      {musicUrl && (
        <Audio src={musicUrl} volume={0.8} />
      )}
    </AbsoluteFill>
  )
}
