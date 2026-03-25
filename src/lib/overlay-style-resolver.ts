// Resolves brand visual_style (from website analysis) into concrete canvas values
// for overlay templates. Returns sensible defaults when no visual_style exists (backward compat).

export type BrandVisualStyle = {
  border_radius?: string
  button_style?: {
    border_radius?: string
    has_shadow?: boolean
    has_gradient?: boolean
    is_outlined?: boolean
    typical_padding?: string
  }
  card_style?: {
    border_radius?: string
    has_shadow?: boolean
    has_border?: boolean
    background?: string
  }
  spacing_feel?: 'tight' | 'normal' | 'airy'
  visual_weight?: 'light' | 'medium' | 'heavy'
  layout_style?: 'minimal' | 'modern' | 'classic' | 'bold' | 'playful'
  hero_pattern?: string
  signature_elements?: string[]
  color_usage?: {
    primary_usage?: string
    accent_usage?: string
    background_style?: string
  }
  typography_feel?: string
  overall_vibe?: string
}

export type ResolvedOverlayStyle = {
  // Border radius in pixels (for canvas roundRect)
  borderRadius: number
  // Shadow
  shadowEnabled: boolean
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  // Overlay darkness/lightness
  overlayOpacity: number
  // Spacing multiplier
  spacingMultiplier: number
  // Color block style
  colorBlockHasGradient: boolean
  colorBlockBorderRadius: number
  // Accent line style
  accentLineThickness: number
  accentLineRounded: boolean
  // Text shadow for readability
  textShadowEnabled: boolean
  textShadowBlur: number
  // Element shape preference
  useRoundedElements: boolean
  // Overall feel
  isMinimal: boolean
  isBold: boolean
}

/** Default style — matches the original hardcoded values exactly */
const DEFAULT_STYLE: ResolvedOverlayStyle = {
  borderRadius: 0,
  shadowEnabled: false,
  shadowBlur: 0,
  shadowColor: 'rgba(0,0,0,0.3)',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  overlayOpacity: 0.55,
  spacingMultiplier: 1.0,
  colorBlockHasGradient: false,
  colorBlockBorderRadius: 0,
  accentLineThickness: 5,
  accentLineRounded: false,
  textShadowEnabled: false,
  textShadowBlur: 0,
  useRoundedElements: false,
  isMinimal: false,
  isBold: false,
}

function parseBorderRadius(br?: string): { radius: number; rounded: boolean } {
  if (!br) return { radius: 0, rounded: false }
  const lower = br.toLowerCase().replace(/\s+/g, '-')
  if (lower.includes('full') || lower.includes('pill') || lower.includes('9999')) {
    return { radius: 9999, rounded: true }
  }
  if (lower.includes('2xl') || lower.includes('3xl')) return { radius: 24, rounded: true }
  if (lower.includes('xl')) return { radius: 20, rounded: true }
  if (lower.includes('lg')) return { radius: 16, rounded: true }
  if (lower.includes('md') || lower === 'rounded') return { radius: 12, rounded: true }
  if (lower.includes('sm')) return { radius: 8, rounded: true }
  if (lower.includes('none') || lower === '0') return { radius: 0, rounded: false }
  // Try to parse a raw number
  const num = parseInt(br, 10)
  if (!isNaN(num)) return { radius: num, rounded: num > 0 }
  return { radius: 8, rounded: true }
}

export function resolveOverlayStyle(visualStyle?: BrandVisualStyle | null): ResolvedOverlayStyle {
  if (!visualStyle) return { ...DEFAULT_STYLE }

  const { radius: mainRadius, rounded: mainRounded } = parseBorderRadius(visualStyle.border_radius)

  // Start from defaults
  const style: ResolvedOverlayStyle = { ...DEFAULT_STYLE }

  // --- Border radius ---
  style.borderRadius = mainRadius
  style.useRoundedElements = mainRounded
  style.colorBlockBorderRadius = mainRadius === 9999 ? 24 : mainRadius // pill blocks get 24, not full pill

  // --- Shadows ---
  const buttonShadow = visualStyle.button_style?.has_shadow ?? false
  const cardShadow = visualStyle.card_style?.has_shadow ?? false
  style.shadowEnabled = buttonShadow || cardShadow
  if (style.shadowEnabled) {
    style.shadowBlur = cardShadow ? 12 : 8
    style.shadowColor = 'rgba(0,0,0,0.25)'
    style.shadowOffsetX = 0
    style.shadowOffsetY = cardShadow ? 4 : 2
    style.textShadowEnabled = true
    style.textShadowBlur = 4
  }

  // --- Gradient ---
  style.colorBlockHasGradient = visualStyle.button_style?.has_gradient ?? false

  // --- Spacing ---
  switch (visualStyle.spacing_feel) {
    case 'tight':
      style.spacingMultiplier = 0.85
      break
    case 'airy':
      style.spacingMultiplier = 1.2
      break
    default:
      style.spacingMultiplier = 1.0
  }

  // --- Visual weight ---
  switch (visualStyle.visual_weight) {
    case 'light':
      style.overlayOpacity = 0.35
      style.isMinimal = true
      style.accentLineThickness = 3
      style.textShadowEnabled = true
      style.textShadowBlur = 6 // more text shadow for readability on lighter overlay
      break
    case 'heavy':
      style.overlayOpacity = 0.65
      style.isBold = true
      style.accentLineThickness = 7
      break
    default: // medium
      style.overlayOpacity = 0.55
      style.accentLineThickness = 5
  }

  // --- Layout style (can override/refine) ---
  switch (visualStyle.layout_style) {
    case 'minimal':
      style.isMinimal = true
      style.accentLineThickness = Math.min(style.accentLineThickness, 3)
      break
    case 'bold':
      style.isBold = true
      style.accentLineThickness = Math.max(style.accentLineThickness, 8)
      break
    case 'playful':
      style.useRoundedElements = true
      style.accentLineRounded = true
      if (style.borderRadius < 16) style.borderRadius = 16
      break
    case 'classic':
      style.accentLineRounded = false
      break
    // 'modern' — keep resolved values
  }

  // Accent line rounding follows element rounding by default
  if (style.useRoundedElements && visualStyle.layout_style !== 'classic') {
    style.accentLineRounded = true
  }

  return style
}
