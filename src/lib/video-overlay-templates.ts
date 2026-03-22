// Built-in video overlay template definitions for Remotion-based video compositions
// These work for both 9:16 (vertical) and 16:9 (horizontal) aspect ratios

export type VideoOverlayTemplate = {
  id: string
  name: string
  description: string
  component: 'LogoWatermark' | 'LowerThird' | 'FullBranded'
}

export type VideoOverlayConfig = {
  logoUrl: string | null
  brandName: string
  tagline: string
  primaryColor: string
  accentColor: string
  headingFont: string
  bodyFont: string
}

export const VIDEO_OVERLAY_TEMPLATES: VideoOverlayTemplate[] = [
  {
    id: 'logo-watermark',
    name: 'Logo-vannmerke',
    description: 'Liten logo i hjørnet, semi-transparent, alltid synlig',
    component: 'LogoWatermark',
  },
  {
    id: 'lower-third',
    name: 'Lower third',
    description: 'Animert bunnbar med merkenavn og tagline, glir inn etter 1s',
    component: 'LowerThird',
  },
  {
    id: 'full-branded',
    name: 'Full branded',
    description: 'Logo øverst, tekst nederst, subtil gradient-overlay',
    component: 'FullBranded',
  },
]

export function getVideoOverlayTemplate(id: string): VideoOverlayTemplate | undefined {
  return VIDEO_OVERLAY_TEMPLATES.find(t => t.id === id)
}
