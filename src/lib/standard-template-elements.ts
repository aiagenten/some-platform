// Converts standard overlay template IDs to approximate OverlayElement arrays
// so they can be loaded into the drag-and-drop editor for forking/editing

import type { OverlayElement, CanvasBackground } from './custom-overlay-types'
import type { ResolvedOverlayStyle } from './overlay-style-resolver'

type StandardTemplateData = {
  elements: OverlayElement[]
  canvas_background: CanvasBackground
}

/** Apply resolved visual style to standard template elements */
function applyVisualStyle(data: StandardTemplateData, style?: ResolvedOverlayStyle | null): StandardTemplateData {
  if (!style) return data
  return {
    canvas_background: data.canvas_background,
    elements: data.elements.map(el => {
      const patched = { ...el }
      // Add border radius to color blocks and shapes
      if ((el.type === 'color-block' || el.type === 'shape') && style.useRoundedElements) {
        patched.rx = style.colorBlockBorderRadius
        patched.ry = style.colorBlockBorderRadius
      }
      // Add shadow to elements when enabled
      if (style.shadowEnabled && (el.type === 'color-block' || el.type === 'text')) {
        patched.stroke = undefined // ensure no conflict
      }
      return patched
    }),
  }
}

export function getStandardTemplateElements(templateId: string, visualStyle?: ResolvedOverlayStyle | null): StandardTemplateData {
  const uid = () => crypto.randomUUID()

  const result = (() => { switch (templateId) {
    case 'modern-dark':
      return {
        canvas_background: { type: 'solid', color: 'rgba(0,0,0,0.55)' },
        elements: [
          { id: uid(), type: 'logo', left: 60, top: 60, width: 50, height: 50, angle: 0, scaleX: 0.15, scaleY: 0.15, opacity: 1, useBrandLogo: true },
          { id: uid(), type: 'text', left: 136, top: 48, width: 300, height: 40, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.9, text: '{{brandName}}', fontSize: 24, fontWeight: '600', fill: 'rgba(255,255,255,0.9)', brandToken: 'headingFont' },
          { id: uid(), type: 'text', left: 60, top: 180, width: 960, height: 200, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, text: '{{headline}}', fontSize: 72, fontWeight: 'bold', fill: '#ffffff', brandToken: 'headingFont' },
          { id: uid(), type: 'color-block', left: 60, top: 400, width: 80, height: 5, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{accentColor}}' },
          { id: uid(), type: 'text', left: 60, top: 430, width: 960, height: 80, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.75, text: '{{subtitle}}', fontSize: 28, fontWeight: '400', fill: 'rgba(255,255,255,0.75)', brandToken: 'bodyFont' },
          { id: uid(), type: 'color-block', left: 0, top: 1075, width: 1080, height: 5, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{primaryColor}}' },
        ],
      }

    case 'gradient-banner':
      return {
        canvas_background: { type: 'gradient', gradient: { type: 'linear', colorStops: [{ offset: 0, color: 'rgba(0,0,0,0)' }, { offset: 0.6, color: 'rgba(0,0,0,0.6)' }, { offset: 1, color: 'rgba(0,0,0,0.85)' }] } },
        elements: [
          { id: uid(), type: 'logo', left: 50, top: 50, width: 40, height: 40, angle: 0, scaleX: 0.12, scaleY: 0.12, opacity: 0.8, useBrandLogo: true },
          { id: uid(), type: 'text', left: 50, top: 750, width: 980, height: 200, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, text: '{{headline}}', fontSize: 56, fontWeight: 'bold', fill: '#ffffff', brandToken: 'headingFont' },
          { id: uid(), type: 'text', left: 50, top: 960, width: 700, height: 40, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.7, text: '{{subtitle}}', fontSize: 24, fontWeight: '400', fill: 'rgba(255,255,255,0.7)', brandToken: 'bodyFont' },
          { id: uid(), type: 'text', left: 830, top: 1020, width: 200, height: 30, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.6, text: '{{brandName}}', fontSize: 20, fontWeight: '500', fill: 'rgba(255,255,255,0.6)', textAlign: 'right', brandToken: 'bodyFont' },
          { id: uid(), type: 'color-block', left: 0, top: 1076, width: 1080, height: 4, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{accentColor}}' },
        ],
      }

    case 'color-sidebar':
      return {
        canvas_background: { type: 'transparent' },
        elements: [
          { id: uid(), type: 'color-block', left: 0, top: 0, width: 432, height: 1080, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.88, fill: '{{primaryColor}}' },
          { id: uid(), type: 'logo', left: 40, top: 40, width: 45, height: 45, angle: 0, scaleX: 0.14, scaleY: 0.14, opacity: 1, useBrandLogo: true },
          { id: uid(), type: 'text', left: 40, top: 125, width: 352, height: 30, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.8, text: '{{brandName}}', fontSize: 20, fontWeight: '600', fill: 'rgba(255,255,255,0.8)', brandToken: 'headingFont' },
          { id: uid(), type: 'text', left: 40, top: 175, width: 352, height: 160, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, text: '{{headline}}', fontSize: 40, fontWeight: 'bold', fill: '#ffffff', brandToken: 'headingFont' },
          { id: uid(), type: 'color-block', left: 40, top: 370, width: 50, height: 4, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{accentColor}}' },
          { id: uid(), type: 'text', left: 40, top: 394, width: 352, height: 100, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.7, text: '{{subtitle}}', fontSize: 22, fontWeight: '400', fill: 'rgba(255,255,255,0.7)', brandToken: 'bodyFont' },
        ],
      }

    case 'minimalist':
      return {
        canvas_background: { type: 'solid', color: 'rgba(0,0,0,0.35)' },
        elements: [
          { id: uid(), type: 'text', left: 60, top: 400, width: 960, height: 200, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, text: '{{headline}}', fontSize: 64, fontWeight: 'bold', fill: '#ffffff', textAlign: 'center', brandToken: 'headingFont' },
          { id: uid(), type: 'color-block', left: 510, top: 630, width: 60, height: 3, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{accentColor}}' },
          { id: uid(), type: 'logo', left: 490, top: 970, width: 100, height: 35, angle: 0, scaleX: 0.1, scaleY: 0.1, opacity: 0.85, useBrandLogo: true },
          { id: uid(), type: 'text', left: 340, top: 1030, width: 400, height: 30, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.6, text: '{{brandName}}', fontSize: 18, fontWeight: '500', fill: 'rgba(255,255,255,0.6)', textAlign: 'center', brandToken: 'bodyFont' },
          { id: uid(), type: 'color-block', left: 0, top: 0, width: 1080, height: 4, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{primaryColor}}' },
          { id: uid(), type: 'color-block', left: 0, top: 1076, width: 1080, height: 4, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{primaryColor}}' },
        ],
      }

    case 'bold-block':
      return {
        canvas_background: { type: 'transparent' },
        elements: [
          { id: uid(), type: 'color-block', left: 0, top: 0, width: 1080, height: 486, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.92, fill: '{{primaryColor}}' },
          { id: uid(), type: 'logo', left: 50, top: 50, width: 40, height: 40, angle: 0, scaleX: 0.12, scaleY: 0.12, opacity: 1, useBrandLogo: true },
          { id: uid(), type: 'text', left: 114, top: 58, width: 300, height: 30, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, text: '{{brandName}}', fontSize: 22, fontWeight: '600', fill: '#ffffff', brandToken: 'headingFont' },
          { id: uid(), type: 'text', left: 50, top: 120, width: 980, height: 200, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, text: '{{headline}}', fontSize: 52, fontWeight: 'bold', fill: '#ffffff', brandToken: 'headingFont' },
          { id: uid(), type: 'text', left: 50, top: 360, width: 980, height: 40, angle: 0, scaleX: 1, scaleY: 1, opacity: 0.8, text: '{{subtitle}}', fontSize: 24, fontWeight: '400', fill: 'rgba(255,255,255,0.8)', brandToken: 'bodyFont' },
          { id: uid(), type: 'color-block', left: 0, top: 1075, width: 1080, height: 5, angle: 0, scaleX: 1, scaleY: 1, opacity: 1, fill: '{{accentColor}}' },
        ],
      }

    default:
      return { elements: [], canvas_background: { type: 'transparent' } }
  }
  })()
  return applyVisualStyle(result as StandardTemplateData, visualStyle)
}
