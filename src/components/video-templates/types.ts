// Shared types for all video templates

export interface BrandColors {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}

export const DEFAULT_BRAND: BrandColors = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#f59e0b',
  background: '#ffffff',
  text: '#111827',
}

// Template configs

export interface PromoSlideshowConfig {
  slides: Array<{
    imageUrl: string
    title: string
    subtitle?: string
  }>
  transitionDuration?: number // frames
  slideDuration?: number // frames
  brand: BrandColors
  logoUrl?: string
}

export interface TextOverVideoConfig {
  videoUrl: string
  lines: Array<{
    text: string
    startFrame: number
    endFrame: number
    position?: 'top' | 'center' | 'bottom'
    fontSize?: number
  }>
  brand: BrandColors
}

export interface BeforeAfterConfig {
  beforeImageUrl: string
  afterImageUrl: string
  beforeLabel: string
  afterLabel: string
  title: string
  brand: BrandColors
}

export interface QuoteCardConfig {
  quote: string
  author: string
  authorTitle?: string
  backgroundStyle: 'gradient' | 'particles' | 'waves'
  brand: BrandColors
}

export interface ProductShowcaseConfig {
  products: Array<{
    imageUrl: string
    name: string
    price: string
    description?: string
  }>
  ctaText: string
  ctaUrl?: string
  brand: BrandColors
  logoUrl?: string
}

export type TemplateConfig =
  | { type: 'promo-slideshow'; config: PromoSlideshowConfig }
  | { type: 'text-over-video'; config: TextOverVideoConfig }
  | { type: 'before-after'; config: BeforeAfterConfig }
  | { type: 'quote-card'; config: QuoteCardConfig }
  | { type: 'product-showcase'; config: ProductShowcaseConfig }

export interface TemplateInfo {
  id: string
  name: string
  description: string
  icon: string
  durationInFrames: number
  fps: number
  width: number
  height: number
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'promo-slideshow',
    name: 'Promo Slideshow',
    description: 'Bilder + tekst-slides med fade transitions',
    icon: 'clapperboard',
    durationInFrames: 300,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: 'text-over-video',
    name: 'Tekst over Video',
    description: 'Bakgrunnsvideo med animert tekst',
    icon: 'file-text',
    durationInFrames: 300,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: 'before-after',
    name: 'Før & Etter',
    description: 'Split-screen sammenligning',
    icon: 'arrow-left-right',
    durationInFrames: 180,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: 'quote-card',
    name: 'Sitat-kort',
    description: 'Sitat med animert bakgrunn',
    icon: 'quote',
    durationInFrames: 150,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: 'product-showcase',
    name: 'Produkt Showcase',
    description: 'Produktbilder med pris og CTA',
    icon: 'shopping-bag',
    durationInFrames: 300,
    fps: 30,
    width: 1080,
    height: 1920,
  },
]
