import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from 'remotion'
import type { EditorState, Track, TrackItem } from '@/lib/editor-state'
import { LogoWatermark } from './overlays/LogoWatermark'
import { LowerThird } from './overlays/LowerThird'
import { FullBranded } from './overlays/FullBranded'
import { SentenceSubtitle } from './subtitles/SentenceSubtitle'
import { KaraokeSubtitle } from './subtitles/KaraokeSubtitle'
import { BigWordSubtitle } from './subtitles/BigWordSubtitle'

// ── Caption renderer ──────────────────────────────────────────────────────────

function CaptionItemRenderer({ item }: { item: TrackItem }) {
  const { fps } = useVideoConfig()
  if (!item.words && !item.text) return null

  const style = item.captionStyle || 'sentences'
  const position = item.captionPosition || 'bottom'
  const textColor = item.captionColor || '#ffffff'
  const bgColor = item.captionBgColor || 'rgba(0,0,0,0.6)'

  const startSec = item.from / fps
  const endSec = (item.from + item.durationInFrames) / fps

  if (style === 'karaoke' && item.words) {
    const karaokeSegs = [
      {
        words: item.words,
        start: item.words[0]?.start ?? startSec,
        end: item.words[item.words.length - 1]?.end ?? endSec,
        text: item.text || item.words.map(w => w.word).join(' '),
      },
    ]
    return (
      <KaraokeSubtitle
        segments={karaokeSegs}
        position={position}
        textColor={textColor}
        bgColor={bgColor}
      />
    )
  }

  if (style === 'big-word' && item.words) {
    const bigWordSegs = [
      {
        words: item.words,
        start: item.words[0]?.start ?? startSec,
        end: item.words[item.words.length - 1]?.end ?? endSec,
        text: item.text || item.words.map(w => w.word).join(' '),
      },
    ]
    return (
      <BigWordSubtitle
        segments={bigWordSegs}
        position={position}
        textColor={textColor}
        bgColor={bgColor}
      />
    )
  }

  // sentences (default)
  const sentSegs = [{ start: startSec, end: endSec, text: item.text || '' }]
  return (
    <SentenceSubtitle
      segments={sentSegs}
      position={position}
      textColor={textColor}
      bgColor={bgColor}
    />
  )
}

// ── Overlay renderer ──────────────────────────────────────────────────────────

function OverlayItemRenderer({
  item,
  brand,
}: {
  item: TrackItem
  brand: EditorState['brand']
}) {
  if (item.overlayType === 'logo-watermark') {
    return (
      <LogoWatermark
        logoUrl={brand.logoUrl}
        brandName={brand.brandName}
        primaryColor={brand.primaryColor}
      />
    )
  }
  if (item.overlayType === 'lower-third') {
    return (
      <LowerThird
        logoUrl={brand.logoUrl}
        brandName={brand.brandName}
        tagline={brand.tagline}
        primaryColor={brand.primaryColor}
        accentColor={brand.accentColor}
      />
    )
  }
  if (item.overlayType === 'full-branded') {
    return (
      <FullBranded
        logoUrl={brand.logoUrl}
        brandName={brand.brandName}
        tagline={brand.tagline}
        primaryColor={brand.primaryColor}
        accentColor={brand.accentColor}
      />
    )
  }
  return null
}

// ── Track renderer ────────────────────────────────────────────────────────────

function TrackRenderer({ track, brand }: { track: Track; brand: EditorState['brand'] }) {
  return (
    <>
      {track.items.map(item => (
        <Sequence
          key={item.id}
          from={item.from}
          durationInFrames={item.durationInFrames}
          layout="none"
        >
          {/* Video track: render images with Img, videos with OffthreadVideo */}
          {track.type === 'video' && item.src && item.type === 'image' && (
            <AbsoluteFill>
              <Img
                src={item.src}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </AbsoluteFill>
          )}

          {track.type === 'video' && item.src && item.type !== 'image' && (
            <AbsoluteFill>
              <OffthreadVideo
                src={item.src}
                startFrom={item.trimStart ? Math.round(item.trimStart * 30) : 0}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </AbsoluteFill>
          )}

          {track.type === 'overlay' && (
            <OverlayItemRenderer item={item} brand={brand} />
          )}

          {track.type === 'caption' && (
            <CaptionItemRenderer item={item} />
          )}

          {track.type === 'audio' && item.src && (
            <Audio src={item.src} volume={item.volume ?? 1} />
          )}
        </Sequence>
      ))}
    </>
  )
}

// ── Main composition ──────────────────────────────────────────────────────────

export type EditorCompositionProps = {
  editorState: EditorState
}

export const EditorComposition: React.FC<EditorCompositionProps> = ({ editorState }) => {
  const { tracks, brand } = editorState

  // Render in order: video tracks first, then overlays, then captions, then audio
  const ordered = [
    ...tracks.filter(t => t.type === 'video'),
    ...tracks.filter(t => t.type === 'overlay'),
    ...tracks.filter(t => t.type === 'caption'),
    ...tracks.filter(t => t.type === 'audio'),
  ]

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {ordered.map(track => (
        <TrackRenderer key={track.id} track={track} brand={brand} />
      ))}
    </AbsoluteFill>
  )
}
