'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { OverlayEditor } from '@/components/overlay-editor'
import type { CustomOverlayTemplate } from '@/lib/custom-overlay-types'
import { Plus, Pencil, Trash2, Layout, Loader2 } from 'lucide-react'

type BrandProfile = {
  colors: Array<{ hex: string; role: string }>
  fonts: Array<{ family: string; role: string }>
  logo_url: string | null
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
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!profile) return

      // Load brand profile
      const { data: bp } = await supabase.from('brand_profiles').select('logo_url, colors, fonts')
        .eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(1).single()

      if (bp) {
        setBrand({
          colors: bp.colors || [],
          fonts: bp.fonts || [],
          logo_url: bp.logo_url,
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

      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async (data: { name: string; description: string; elements: unknown[]; canvas_background: unknown; thumbnail: string }) => {
    if (editingTemplate) {
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
      // Create new
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
    setEditorOpen(true)
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
        onClose={() => { setEditorOpen(false); setEditingTemplate(null) }}
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

      {/* Standard templates info */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Layout className="w-5 h-5 text-indigo-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-indigo-900">5 standardmaler inkludert</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Moderne mørk, Gradient banner, Farge-sidebar, Minimalistisk og Bold fargeblokk er alltid tilgjengelige.
              Lag dine egne maler nedenfor!
            </p>
          </div>
        </div>
      </div>

      {/* Custom templates grid */}
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
            <div key={tmpl.id} className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
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
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => openEditor(tmpl)}
                    className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rediger
                  </button>
                  <button
                    onClick={() => handleDelete(tmpl.id)}
                    disabled={deleting === tmpl.id}
                    className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-slate-900 text-sm">{tmpl.name}</h3>
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
  )
}
