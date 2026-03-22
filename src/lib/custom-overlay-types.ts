// Types for custom overlay templates (drag-and-drop editor)

export type OverlayElementType = 'text' | 'logo' | 'shape' | 'color-block' | 'image'

export type OverlayElement = {
  id: string
  type: OverlayElementType
  // Position & transform
  left: number
  top: number
  width: number
  height: number
  angle: number
  scaleX: number
  scaleY: number
  opacity: number
  // Text-specific
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  fill?: string
  textAlign?: string
  // Shape-specific
  shapeType?: 'rect' | 'circle' | 'triangle' | 'line'
  stroke?: string
  strokeWidth?: number
  rx?: number // border radius
  ry?: number
  // Background
  backgroundColor?: string
  // Gradient
  gradient?: {
    type: 'linear' | 'radial'
    colorStops: Array<{ offset: number; color: string }>
    coords?: { x1: number; y1: number; x2: number; y2: number }
  }
  // Brand token reference (e.g. 'primaryColor', 'headingFont')
  brandToken?: string
  // Logo uses brand logo
  useBrandLogo?: boolean
  // Image source
  imageUrl?: string
}

export type CanvasBackground = {
  type: 'transparent' | 'solid' | 'gradient' | 'image'
  color?: string
  gradient?: {
    type: 'linear' | 'radial'
    colorStops: Array<{ offset: number; color: string }>
    angle?: number
  }
  imageUrl?: string
  opacity?: number
}

export type CustomOverlayTemplate = {
  id: string
  org_id: string
  created_by: string | null
  name: string
  description: string
  elements: OverlayElement[]
  canvas_background: CanvasBackground
  thumbnail: string | null
  width: number
  height: number
  is_default: boolean
  is_visible?: boolean
  created_at: string
  updated_at: string
}
