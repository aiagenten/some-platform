'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Sparkles, Plus, X, Check, Pencil, Camera } from 'lucide-react'

type ImageStyle = {
  id: string
  name: string
  prompt: string
  is_default: boolean
}

const DEFAULT_STYLES: ImageStyle[] = [
  {
    id: 'scandinavian-photo',
    name: 'Fotorealistisk skandinavisk',
    prompt: 'Photorealistic photograph, shot on Canon EOS R5 with 85mm f/1.4 lens. {situation}. Scandinavian home setting: white walls, light wood, IKEA-style. Natural window light, golden hour warmth. Real skin texture with visible pores, wrinkles, age-appropriate features. Everyday clothing (wool sweaters, jeans). Candid moment. Subtle film grain, ISO 800+. Muted Scandinavian color palette. No text on screens.',
    is_default: true,
  },
  {
    id: 'office-professional',
    name: 'Profesjonelt kontormiljø',
    prompt: 'Photorealistic photograph, shot on Sony A7 IV with 35mm f/1.8 lens. {situation}. Modern Scandinavian office: glass walls, standing desks, indoor plants, clean lines. Soft overhead lighting mixed with natural daylight. Business casual attire. Authentic candid expression. Sharp focus with shallow depth of field. Clean, minimal background. No text, no logos.',
    is_default: true,
  },
  {
    id: 'flat-illustration',
    name: 'Flat design illustrasjon',
    prompt: 'Modern flat design illustration, vector style. {situation}. Clean geometric shapes, bold colors, minimal detail. Inspired by Scandinavian design principles. Simple characters with no facial details. Muted but vibrant color palette. White or light background. No gradients, no shadows, no 3D effects. No text.',
    is_default: true,
  },
  {
    id: 'product-minimal',
    name: 'Minimalistisk produktfoto',
    prompt: 'Clean product photography on white background. {situation}. Studio lighting, soft shadows. Minimalist Scandinavian aesthetic. Shot on Phase One IQ4 150MP, 80mm lens. Perfect exposure, no clipping. Subtle reflection on surface. Professional commercial quality. No text, no watermarks.',
    is_default: true,
  },
  {
    id: 'nordic-outdoor',
    name: 'Utendørs nordisk natur',
    prompt: 'Photorealistic outdoor photograph, Nordic landscape setting. {situation}. Norwegian fjord, forest, or coastal scenery. Overcast sky with soft, diffused light. Cool blue-green tones. Person in practical outdoor clothing (hiking gear, rain jacket). Shot on Fujifilm X-T5 with 23mm f/2 lens. Natural colors, no filters. Moody Scandinavian atmosphere. No text.',
    is_default: true,
  },
]

const IMAGE_MODELS = [
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    description: 'Google Gemini — rask, god kvalitet, bred stilforståelse',
    badge: 'Anbefalt',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'gpt-image',
    name: 'GPT Image',
    description: 'OpenAI — fotorealistisk, ekstremt detaljert',
    badge: 'Premium',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
]

export default function ImageGenerationSettings() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('nano-banana')
  const [styles, setStyles] = useState<ImageStyle[]>([])
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [editingStyle, setEditingStyle] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile) return
      setOrgId(profile.org_id)

      // Load org settings
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.org_id)
        .single()

      const settings = (org?.settings as Record<string, unknown>) || {}
      setSelectedModel((settings.image_model as string) || 'nano-banana')
      setActiveStyleId((settings.active_image_style as string) || DEFAULT_STYLES[0].id)

      // Load styles from settings, or use defaults
      const savedStyles = (settings.image_styles as ImageStyle[]) || null
      setStyles(savedStyles || DEFAULT_STYLES)

      setLoading(false)
    }
    load()
  }, [])

  const saveToOrg = async (updates: Record<string, unknown>) => {
    if (!orgId) return
    setSaving(true)

    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    const currentSettings = (org?.settings as Record<string, unknown>) || {}

    await supabase
      .from('organizations')
      .update({ settings: { ...currentSettings, ...updates } })
      .eq('id', orgId)

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId)
    await saveToOrg({ image_model: modelId })
  }

  const handleStyleSelect = async (styleId: string) => {
    setActiveStyleId(styleId)
    await saveToOrg({ active_image_style: styleId })
  }

  const handleEditStyle = (style: ImageStyle) => {
    setEditingStyle(style.id)
    setEditName(style.name)
    setEditPrompt(style.prompt)
  }

  const handleSaveEdit = async () => {
    if (!editingStyle) return
    const updated = styles.map(s =>
      s.id === editingStyle ? { ...s, name: editName, prompt: editPrompt } : s
    )
    setStyles(updated)
    setEditingStyle(null)
    await saveToOrg({ image_styles: updated })
  }

  const handleAddStyle = async () => {
    if (!newName.trim() || !newPrompt.trim()) return
    const newStyle: ImageStyle = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      prompt: newPrompt.trim(),
      is_default: false,
    }
    const updated = [...styles, newStyle]
    setStyles(updated)
    setNewName('')
    setNewPrompt('')
    setShowAddForm(false)
    await saveToOrg({ image_styles: updated })
  }

  const handleDeleteStyle = async (styleId: string) => {
    if (!confirm('Slett denne bildestilen?')) return
    const updated = styles.filter(s => s.id !== styleId)
    setStyles(updated)
    if (activeStyleId === styleId && updated.length > 0) {
      setActiveStyleId(updated[0].id)
      await saveToOrg({ image_styles: updated, active_image_style: updated[0].id })
    } else {
      await saveToOrg({ image_styles: updated })
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Laster...</div>

  return (
    <div className="space-y-6">
      {/* Image Model Selection */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-900">Bildemodell</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">Velg hvilken AI-modell som brukes til å generere bilder</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {IMAGE_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                selectedModel === model.id
                  ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-slate-900">{model.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${model.badgeColor}`}>
                  {model.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500">{model.description}</p>
              {selectedModel === model.id && (
                <div className="flex items-center gap-1 mt-2 text-xs text-indigo-600 font-medium">
                  <Check className="w-3.5 h-3.5" /> Aktiv
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Image Style Categories */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-900">Bildestiler</h2>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ny stil
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Velg standard bildestil for nye innlegg. Du kan også lage egne.</p>

        <div className="space-y-3">
          {styles.map((style) => (
            <div key={style.id}>
              {editingStyle === style.id ? (
                <div className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    Bruk <code className="bg-slate-100 px-1 rounded">{'{situation}'}</code> der innleggets kontekst skal settes inn.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">Lagre</button>
                    <button onClick={() => setEditingStyle(null)} className="px-4 py-2 text-slate-600 text-sm rounded-lg hover:bg-slate-100 transition-colors">Avbryt</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleStyleSelect(style.id)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
                    activeStyleId === style.id
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{style.name}</p>
                      {style.is_default && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Standard</span>
                      )}
                      {activeStyleId === style.id && (
                        <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Aktiv
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditStyle(style) }}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!style.is_default && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteStyle(style.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 font-mono">{style.prompt}</p>
                </button>
              )}
            </div>
          ))}

          {showAddForm && (
            <div className="p-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Navn på ny bildestil"
                autoFocus
              />
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                placeholder="Prompt-mal for bildegenerering. Bruk {situation} som plassholder."
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddStyle}
                  disabled={!newName.trim() || !newPrompt.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Legg til
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewName(''); setNewPrompt('') }}
                  className="px-4 py-2 text-slate-600 text-sm rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save indicator */}
      {(saving || savedMsg) && (
        <div className={`fixed bottom-4 right-4 text-white text-sm px-4 py-2 rounded-xl shadow-lg transition-all duration-300 ${saving ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
          {saving ? 'Lagrer...' : '✓ Lagret'}
        </div>
      )}
    </div>
  )
}
