'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { OverlayEditor } from '@/components/overlay-editor'
import type { CustomOverlayTemplate } from '@/lib/custom-overlay-types'
import { OVERLAY_TEMPLATES } from '@/lib/overlay-templates'
import { getStandardTemplateElements } from '@/lib/standard-template-elements'
import { Plus, Pencil, Trash2, Layout, Loader2, Eye, EyeOff, Copy } from 'lucide-react'

type BrandProfile = {
  colors: Array<{ hex: string; role: string }>
  fonts: Array<{ family: string; role: string }>
  logo_url: string | null
  logos?: Array<{ url: string; label?: string }>
}

export default function OverlayEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>}>
      <OverlayEditorContent />
    </Suspense>
  )
}

function OverlayEditorContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [templates, setTemplates] = useState<CustomOverlayTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomOverlayTemplate | null>(null)
  const [forkMode, setForkMode] = useState(false) // When editing a standard template (fork as new)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [standardVisibility, setStandardVisibility] = useState<Record<string, boolean>>({})
  const [togglingVisibility, setTogglingVisibility] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!profile) return

      // Load brand profile
      const { data: bp } = await supabase.from('brand_profiles').select('logo_url, colors, fonts, visual_style')
        .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).single()

      if (bp) {
        const extraLogos: Array<{ url: string; label?: string }> = []
        if (bp.visual_style && typeof bp.visual_style === 'object') {
          const vs = bp.visual_style as Record<string, unknown>
          if (Array.isArray(vs.logos)) {
            for (const l of vs.logos) {
              if (typeof l === 'string') extraLogos.push({ url: l })
              else if (l && typeof l === 'object' && 'url' in l) extraLogos.push(l as { url: string; label?: string })
            }
          }
        }
        setBrand({
          colors: bp.colors || [],
          fonts: bp.fonts || [],
          logo_url: bp.logo_url,
          logos: extraLogos,
        })
      } else {
        setBrand({ colors: [{ hex: '#9933ff', role: 'primary' }], fonts: [{ family: 'Inter', role: 'heading' }], logo_url: null })
      }

      // Load custom templates
      const res = await fetch('/api/overlay-templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)

        // Auto-open editor if edit param
        if (editId) {
          const tmpl = data.find((t: CustomOverlayTemplate) => t.id === editId)
          if (tmpl) {
            setEditingTemplate(tmpl)
            setEditorOpen(true)
          }
        }
      }

      // Load standard template visibility settings
      try {
        const visRes = await fetch('/api/overlay-templates/visibility')
        if (visRes.ok) {
          const visData = await visRes.json()
          setStandardVisibility(visData)
        }
      } catch { /* ignore */ }

      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async (data: { name: string; description: string; elements: unknown[]; canvas_background: unknown; thumbnail: string }) => {
    if (editingTemplate && !forkMode) {
      // Update existing
      const res = await fetch('/api/overlay-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTemplate.id, ...data }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
      }
    } else {
      // Create new (also used for forking standard templates)
      const res = await fetch('/api/overlay-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setTemplates(prev => [created, ...prev])
      }
    }
    setEditorOpen(false)
    setEditingTemplate(null)
    setForkMode(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på at du vil slette denne malen?')) return
    setDeleting(id)
    const res = await fetch(`/api/overlay-templates?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
    setDeleting(null)
  }

  const openEditor = (template?: CustomOverlayTemplate) => {
    setEditingTemplate(template || null)
    setForkMode(false)
    setEditorOpen(true)
  }

  const openStandardInEditor = (standardId: string) => {
    const stdTmpl = OVERLAY_TEMPLATES.find(t => t.id === standardId)
    if (!stdTmpl) return
    const { elements, canvas_background } = getStandardTemplateElements(standardId)
    // Create a fake CustomOverlayTemplate to load into editor
    const forkTemplate: CustomOverlayTemplate = {
      id: `fork-${standardId}`,
      org_id: '',
      created_by: null,
      name: `${stdTmpl.name} (kopi)`,
      description: stdTmpl.description,
      elements,
      canvas_background,
      thumbnail: null,
      width: 1080,
      height: 1080,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setEditingTemplate(forkTemplate)
    setForkMode(true)
    setEditorOpen(true)
  }

  const toggleCustomVisibility = async (tmpl: CustomOverlayTemplate) => {
    const newVisible = tmpl.is_visible === false ? true : false
    setTogglingVisibility(tmpl.id)
    const res = await fetch('/api/overlay-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tmpl.id, is_visible: newVisible }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
    }
    setTogglingVisibility(null)
  }

  const toggleStandardVisibility = async (templateId: string) => {
    const currentVisible = standardVisibility[templateId] !== false // default true
    const newVisible = !currentVisible
    setTogglingVisibility(templateId)
    try {
      await fetch('/api/overlay-templates/visibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, is_visible: newVisible }),
      })
      setStandardVisibility(prev => ({ ...prev, [templateId]: newVisible }))
    } catch { /* ignore */ }
    setTogglingVisibility(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (editorOpen && brand) {
    return (
      <OverlayEditor
        brand={brand}
        template={editingTemplate}
        onSave={handleSave}
        onClose={() => { setEditorOpen(false); setEditingTemplate(null); setForkMode(false) }}
      />
    )
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Overlay-maler</h1>
          <p className="text-sm text-slate-500 mt-1">Lag egne overlay-maler med drag-and-drop editor</p>
        </div>
        <button
          onClick={() => openEditor()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Ny mal
        </button>
      </div>

      {/* Custom templates grid */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Layout className="w-4 h-4 text-purple-500" />
          Egne maler
        </h2>
        {templates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
            <Layout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-2">Ingen egne maler ennå</p>
            <p className="text-sm text-slate-400 mb-4">Lag din første overlay-mal med editoren</p>
            <button
              onClick={() => openEditor()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Lag mal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className={`bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow group ${tmpl.is_visible === false ? 'opacity-60' : ''}`}>
                {/* Thumbnail */}
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  {tmpl.thumbnail ? (
                    <img src={tmpl.thumbnail} alt={tmpl.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Layout className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEditor(tmpl)}
                      className="bg-white text-slate-900 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Rediger
                    </button>
                    <button
                      onClick={() => toggleCustomVisibility(tmpl)}
                      disabled={togglingVisibility === tmpl.id}
                      className="bg-white text-slate-900 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      title={tmpl.is_visible === false ? 'Vis i postvelger' : 'Skjul fra postvelger'}
                    >
                      {tmpl.is_visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleDelete(tmpl.id)}
                      disabled={deleting === tmpl.id}
                      className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900 text-sm">{tmpl.name}</h3>
                    {tmpl.is_visible === false && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Skjult</span>
                    )}
                  </div>
                  {tmpl.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tmpl.description}</p>}
                  <p className="text-[10px] text-slate-400 mt-2">
                    {tmpl.elements.length} element{tmpl.elements.length !== 1 ? 'er' : ''} · {new Date(tmpl.created_at).toLocaleDateString('nb-NO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standard templates grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Layout className="w-4 h-4 text-indigo-500" />
          Standardmaler
          <span className="text-xs font-normal text-slate-400 ml-1">Klikk &quot;Rediger&quot; for å lage en kopi du kan tilpasse</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OVERLAY_TEMPLATES.map((tmpl) => {
            const isVisible = standardVisibility[tmpl.id] !== false
            return (
              <div key={tmpl.id} className={`bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow group ${!isVisible ? 'opacity-60' : ''}`}>
                <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden flex items-center justify-center">
                  <div className="text-center p-6">
                    <Layout className="w-16 h-16 text-indigo-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-600">{tmpl.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{tmpl.description}</p>
                  </div>
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => openStandardInEditor(tmpl.id)}
                      className="bg-white text-slate-900 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Rediger
                    </button>
                    <button
                      onClick={() => toggleStandardVisibility(tmpl.id)}
                      disabled={togglingVisibility === tmpl.id}
                      className="bg-white text-slate-900 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      title={isVisible ? 'Skjul fra postvelger' : 'Vis i postvelger'}
                    >
                      {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900 text-sm">{tmpl.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {!isVisible && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Skjult</span>
                      )}
                      <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">Standard</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{tmpl.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
