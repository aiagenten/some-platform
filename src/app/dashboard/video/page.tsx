'use client'

import { useState, useCallback, useMemo } from 'react'
import { Player } from '@remotion/player'
import { createClient } from '@/lib/supabase/client'
import {
  TEMPLATES,
  DEFAULT_BRAND,
  type TemplateInfo,
  type PromoSlideshowConfig,
  type TextOverVideoConfig,
  type BeforeAfterConfig,
  type QuoteCardConfig,
  type ProductShowcaseConfig,
  type BrandColors,
} from '@/components/video-templates/types'
import { PromoSlideshow } from '@/components/video-templates/PromoSlideshow'
import { TextOverVideo } from '@/components/video-templates/TextOverVideo'
import { BeforeAfter } from '@/components/video-templates/BeforeAfter'
import { QuoteCard } from '@/components/video-templates/QuoteCard'
import { ProductShowcase } from '@/components/video-templates/ProductShowcase'

// Default configs for each template
function getDefaultConfig(templateId: string, brand: BrandColors): Record<string, unknown> {
  switch (templateId) {
    case 'promo-slideshow':
      return {
        slides: [
          { imageUrl: '', title: 'Slide 1', subtitle: 'Undertekst' },
          { imageUrl: '', title: 'Slide 2', subtitle: 'Undertekst' },
        ],
        slideDuration: 90,
        transitionDuration: 15,
        brand,
      } satisfies PromoSlideshowConfig
    case 'text-over-video':
      return {
        videoUrl: '',
        lines: [
          { text: 'Din tekst her', startFrame: 0, endFrame: 90, position: 'center', fontSize: 48 },
          { text: 'Mer tekst', startFrame: 100, endFrame: 200, position: 'bottom', fontSize: 36 },
        ],
        brand,
      } satisfies TextOverVideoConfig
    case 'before-after':
      return {
        beforeImageUrl: '',
        afterImageUrl: '',
        beforeLabel: 'Før',
        afterLabel: 'Etter',
        title: 'Sammenligning',
        brand,
      } satisfies BeforeAfterConfig
    case 'quote-card':
      return {
        quote: 'Skriv ditt sitat her...',
        author: 'Forfatter',
        authorTitle: 'Tittel',
        backgroundStyle: 'gradient',
        brand,
      } satisfies QuoteCardConfig
    case 'product-showcase':
      return {
        products: [
          { imageUrl: '', name: 'Produkt 1', price: 'kr 299,-', description: 'Beskrivelse' },
        ],
        ctaText: 'Kjøp nå!',
        brand,
      } satisfies ProductShowcaseConfig
    default:
      return { brand }
  }
}

// Render the correct template component
function TemplateRenderer({ templateId, config }: { templateId: string; config: Record<string, unknown> }) {
  switch (templateId) {
    case 'promo-slideshow':
      return <PromoSlideshow config={config as unknown as PromoSlideshowConfig} />
    case 'text-over-video':
      return <TextOverVideo config={config as unknown as TextOverVideoConfig} />
    case 'before-after':
      return <BeforeAfter config={config as unknown as BeforeAfterConfig} />
    case 'quote-card':
      return <QuoteCard config={config as unknown as QuoteCardConfig} />
    case 'product-showcase':
      return <ProductShowcase config={config as unknown as ProductShowcaseConfig} />
    default:
      return <div>Ukjent template</div>
  }
}

export default function VideoPage() {
  const supabase = createClient()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const brand = DEFAULT_BRAND // TODO: Load from brand_profile

  const handleSelectTemplate = useCallback(
    (template: TemplateInfo) => {
      setSelectedTemplate(template)
      setConfig(getDefaultConfig(template.id, brand))
      setSaveMessage('')
    },
    [brand]
  )

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedTemplate) return
    setSaving(true)
    setSaveMessage('')

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        setSaveMessage('❌ Du må være logget inn')
        setSaving(false)
        return
      }

      // Get org_id from users table
      const { data: userRow } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', userData.user.id)
        .single()

      if (!userRow) {
        setSaveMessage('❌ Kunne ikke finne organisasjon')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('social_posts').insert({
        org_id: userRow.org_id,
        created_by: userData.user.id,
        platform: 'instagram',
        format: 'reel',
        caption: `Video: ${selectedTemplate.name}`,
        status: 'draft',
        ai_generated: false,
        metadata: {
          video_template: selectedTemplate.id,
          video_config: config,
          fps: selectedTemplate.fps,
          width: selectedTemplate.width,
          height: selectedTemplate.height,
          durationInFrames: selectedTemplate.durationInFrames,
        },
      })

      if (error) {
        setSaveMessage(`❌ ${error.message}`)
      } else {
        setSaveMessage('✅ Video-config lagret som reel-utkast!')
      }
    } catch {
      setSaveMessage('❌ Noe gikk galt')
    } finally {
      setSaving(false)
    }
  }, [selectedTemplate, config, supabase])

  // JSON config editor
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎬 Video-editor</h1>
          <p className="text-gray-500 mt-1">Velg en mal, tilpass innhold, og forhåndsvis</p>
        </div>
      </div>

      {!selectedTemplate ? (
        // Template selection
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t)}
              className="p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition text-left"
            >
              <div className="text-3xl mb-3">{t.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900">{t.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{t.description}</p>
              <div className="mt-3 flex gap-2 text-xs text-gray-400">
                <span>{t.width}×{t.height}</span>
                <span>·</span>
                <span>{t.fps} fps</span>
                <span>·</span>
                <span>{(t.durationInFrames / t.fps).toFixed(0)}s</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        // Editor view
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Preview */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← Tilbake til maler
              </button>
              <h2 className="text-lg font-semibold">
                {selectedTemplate.icon} {selectedTemplate.name}
              </h2>
            </div>

            <div className="bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: 640 }}>
              <Player
                component={() => <TemplateRenderer templateId={selectedTemplate.id} config={config} />}
                durationInFrames={selectedTemplate.durationInFrames}
                fps={selectedTemplate.fps}
                compositionWidth={selectedTemplate.width}
                compositionHeight={selectedTemplate.height}
                style={{ width: '100%', height: '100%' }}
                controls
                loop
                autoPlay
              />
            </div>
          </div>

          {/* Right: Config editor */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Konfigurer innhold</h3>

            {/* Quick config fields based on template type */}
            <TemplateConfigForm
              templateId={selectedTemplate.id}
              config={config}
              onChange={handleConfigChange}
            />

            {/* Raw JSON editor */}
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                Avansert: Rediger JSON direkte
              </summary>
              <textarea
                value={configJson}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setConfig(parsed)
                  } catch {
                    // Invalid JSON — ignore
                  }
                }}
                className="w-full mt-2 p-3 text-xs font-mono bg-gray-50 border rounded-lg"
                rows={15}
              />
            </details>

            {/* Save */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Lagrer...' : '💾 Lagre som reel-utkast'}
              </button>
              <button
                onClick={() => alert('TODO: Remotion Lambda eksport')}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                📤 Eksporter video (coming soon)
              </button>
            </div>
            {saveMessage && (
              <p className="mt-2 text-sm">{saveMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Template-specific config forms
function TemplateConfigForm({
  templateId,
  config,
  onChange,
}: {
  templateId: string
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  switch (templateId) {
    case 'promo-slideshow':
      return <PromoSlideshowForm config={config as unknown as PromoSlideshowConfig} onChange={onChange} />
    case 'quote-card':
      return <QuoteCardForm config={config as unknown as QuoteCardConfig} onChange={onChange} />
    case 'before-after':
      return <BeforeAfterForm config={config as unknown as BeforeAfterConfig} onChange={onChange} />
    case 'product-showcase':
      return <ProductShowcaseForm config={config as unknown as ProductShowcaseConfig} onChange={onChange} />
    case 'text-over-video':
      return <TextOverVideoForm config={config as unknown as TextOverVideoConfig} onChange={onChange} />
    default:
      return <p className="text-sm text-gray-500">Rediger JSON nedenfor</p>
  }
}

function PromoSlideshowForm({ config, onChange }: { config: PromoSlideshowConfig; onChange: (k: string, v: unknown) => void }) {
  const slides = config.slides || []
  const updateSlide = (index: number, field: string, value: string) => {
    const newSlides = [...slides]
    newSlides[index] = { ...newSlides[index], [field]: value }
    onChange('slides', newSlides)
  }
  const addSlide = () => onChange('slides', [...slides, { imageUrl: '', title: '', subtitle: '' }])

  return (
    <div className="space-y-4">
      {slides.map((slide, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-gray-500">Slide {i + 1}</p>
          <input
            type="text"
            placeholder="Bilde-URL"
            value={slide.imageUrl}
            onChange={(e) => updateSlide(i, 'imageUrl', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded"
          />
          <input
            type="text"
            placeholder="Tittel"
            value={slide.title}
            onChange={(e) => updateSlide(i, 'title', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded"
          />
          <input
            type="text"
            placeholder="Undertekst"
            value={slide.subtitle || ''}
            onChange={(e) => updateSlide(i, 'subtitle', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded"
          />
        </div>
      ))}
      <button onClick={addSlide} className="text-sm text-blue-600 hover:text-blue-800">+ Legg til slide</button>
    </div>
  )
}

function QuoteCardForm({ config, onChange }: { config: QuoteCardConfig; onChange: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <textarea
        placeholder="Sitat"
        value={config.quote || ''}
        onChange={(e) => onChange('quote', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
        rows={3}
      />
      <input
        type="text"
        placeholder="Forfatter"
        value={config.author || ''}
        onChange={(e) => onChange('author', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      />
      <input
        type="text"
        placeholder="Forfatter-tittel (valgfritt)"
        value={config.authorTitle || ''}
        onChange={(e) => onChange('authorTitle', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      />
      <select
        value={config.backgroundStyle || 'gradient'}
        onChange={(e) => onChange('backgroundStyle', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      >
        <option value="gradient">Gradient</option>
        <option value="particles">Partikler</option>
        <option value="waves">Bølger</option>
      </select>
    </div>
  )
}

function BeforeAfterForm({ config, onChange }: { config: BeforeAfterConfig; onChange: (k: string, v: unknown) => void }) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Tittel"
        value={config.title || ''}
        onChange={(e) => onChange('title', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      />
      <input
        type="text"
        placeholder="Før-bilde URL"
        value={config.beforeImageUrl || ''}
        onChange={(e) => onChange('beforeImageUrl', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      />
      <input
        type="text"
        placeholder="Etter-bilde URL"
        value={config.afterImageUrl || ''}
        onChange={(e) => onChange('afterImageUrl', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Før-label"
          value={config.beforeLabel || 'Før'}
          onChange={(e) => onChange('beforeLabel', e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded"
        />
        <input
          type="text"
          placeholder="Etter-label"
          value={config.afterLabel || 'Etter'}
          onChange={(e) => onChange('afterLabel', e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded"
        />
      </div>
    </div>
  )
}

function ProductShowcaseForm({ config, onChange }: { config: ProductShowcaseConfig; onChange: (k: string, v: unknown) => void }) {
  const products = config.products || []
  const updateProduct = (index: number, field: string, value: string) => {
    const newProducts = [...products]
    newProducts[index] = { ...newProducts[index], [field]: value }
    onChange('products', newProducts)
  }
  const addProduct = () => onChange('products', [...products, { imageUrl: '', name: '', price: '', description: '' }])

  return (
    <div className="space-y-4">
      {products.map((product, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-gray-500">Produkt {i + 1}</p>
          <input type="text" placeholder="Bilde-URL" value={product.imageUrl} onChange={(e) => updateProduct(i, 'imageUrl', e.target.value)} className="w-full px-3 py-2 text-sm border rounded" />
          <input type="text" placeholder="Produktnavn" value={product.name} onChange={(e) => updateProduct(i, 'name', e.target.value)} className="w-full px-3 py-2 text-sm border rounded" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Pris" value={product.price} onChange={(e) => updateProduct(i, 'price', e.target.value)} className="w-full px-3 py-2 text-sm border rounded" />
            <input type="text" placeholder="Beskrivelse" value={product.description || ''} onChange={(e) => updateProduct(i, 'description', e.target.value)} className="w-full px-3 py-2 text-sm border rounded" />
          </div>
        </div>
      ))}
      <button onClick={addProduct} className="text-sm text-blue-600 hover:text-blue-800">+ Legg til produkt</button>
      <input
        type="text"
        placeholder="CTA-tekst"
        value={config.ctaText || ''}
        onChange={(e) => onChange('ctaText', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded mt-2"
      />
    </div>
  )
}

function TextOverVideoForm({ config, onChange }: { config: TextOverVideoConfig; onChange: (k: string, v: unknown) => void }) {
  const lines = config.lines || []
  const updateLine = (index: number, field: string, value: unknown) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    onChange('lines', newLines)
  }
  const addLine = () => onChange('lines', [...lines, { text: '', startFrame: 0, endFrame: 90, position: 'center', fontSize: 48 }])

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Video-URL (valgfritt)"
        value={config.videoUrl || ''}
        onChange={(e) => onChange('videoUrl', e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded"
      />
      {lines.map((line, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-gray-500">Tekstlinje {i + 1}</p>
          <input type="text" placeholder="Tekst" value={line.text} onChange={(e) => updateLine(i, 'text', e.target.value)} className="w-full px-3 py-2 text-sm border rounded" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Start (frame)" value={line.startFrame} onChange={(e) => updateLine(i, 'startFrame', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border rounded" />
            <input type="number" placeholder="Slutt (frame)" value={line.endFrame} onChange={(e) => updateLine(i, 'endFrame', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 text-sm border rounded" />
            <select value={line.position || 'center'} onChange={(e) => updateLine(i, 'position', e.target.value)} className="w-full px-3 py-2 text-sm border rounded">
              <option value="top">Topp</option>
              <option value="center">Midt</option>
              <option value="bottom">Bunn</option>
            </select>
          </div>
        </div>
      ))}
      <button onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800">+ Legg til tekstlinje</button>
    </div>
  )
}
