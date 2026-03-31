'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, Upload, Trash2, Sparkles, Download, Image as ImageIcon, X, ChevronRight } from 'lucide-react'

type Product = {
  id: string
  org_id: string
  name: string
  description: string | null
  image_url: string
  thumbnail_url: string | null
  tags: string[]
  created_at: string
}

type Placement = {
  id: string
  product_id: string
  scene_prompt: string
  result_image_url: string | null
  status: string
  error_message: string | null
  model_used: string
  created_at: string
}

const SCENE_PRESETS = [
  { label: 'Utendørs urban', prompt: 'outdoor urban city setting, natural lighting' },
  { label: 'Kontormiljø', prompt: 'modern Scandinavian office environment' },
  { label: 'Studio hvit', prompt: 'clean white studio photography backdrop' },
  { label: 'Natur/friluft', prompt: 'Norwegian nature outdoor setting' },
  { label: 'Butikk/retail', prompt: 'modern retail store display' },
  { label: 'Livsstil hjemme', prompt: 'cozy Scandinavian home interior' },
]

export default function ProductPlacementPage() {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'products' | 'generate'>('products')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Product library state
  const [products, setProducts] = useState<Product[]>([])
  const [uploadingProduct, setUploadingProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [newProductFile, setNewProductFile] = useState<File | null>(null)
  const [newProductPreview, setNewProductPreview] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Generation state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [scenePrompt, setScenePrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Auth + org
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const adminOrgId = localStorage.getItem('admin_viewing_org_id')
      if (adminOrgId) {
        setOrgId(adminOrgId)
      } else {
        const { data: profile } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()
        if (!profile?.org_id) { router.push('/login'); return }
        setOrgId(profile.org_id)
      }
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (data) setProducts(data)
  }, [orgId, supabase])

  useEffect(() => {
    if (orgId) fetchProducts()
  }, [orgId, fetchProducts])

  // Fetch placements for selected product
  const fetchPlacements = useCallback(async () => {
    if (!orgId || !selectedProduct) return
    const { data } = await supabase
      .from('product_placements')
      .select('*')
      .eq('product_id', selectedProduct.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (data) setPlacements(data)
  }, [orgId, selectedProduct, supabase])

  useEffect(() => {
    if (selectedProduct) fetchPlacements()
  }, [selectedProduct, fetchPlacements])

  // Upload product
  const handleUploadProduct = async () => {
    if (!newProductFile || !newProductName.trim() || !orgId) return
    setUploadingProduct(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', newProductFile)
      formData.append('org_id', orgId)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) throw new Error('Opplasting feilet')
      const uploadData = await uploadRes.json()

      const { error: insertError } = await supabase
        .from('products')
        .insert({
          org_id: orgId,
          name: newProductName.trim(),
          description: newProductDescription.trim() || null,
          image_url: uploadData.url,
          thumbnail_url: uploadData.url,
        })

      if (insertError) throw new Error(insertError.message)

      setNewProductName('')
      setNewProductDescription('')
      setNewProductFile(null)
      setNewProductPreview(null)
      setShowUploadForm(false)
      setSuccess('Produkt lagt til!')
      setTimeout(() => setSuccess(null), 3000)
      fetchProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setUploadingProduct(false)
    }
  }

  // Delete product
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette produktet?')) return
    setDeletingId(productId)
    try {
      const { error: delError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
      if (delError) throw new Error(delError.message)
      if (selectedProduct?.id === productId) setSelectedProduct(null)
      fetchProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette')
    } finally {
      setDeletingId(null)
    }
  }

  // Generate scene
  const handleGenerate = async () => {
    if (!selectedProduct || !scenePrompt.trim() || !orgId) return
    setGenerating(true)
    setGeneratedImage(null)
    setError(null)

    try {
      const res = await fetch('/api/product-placement/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          scene_prompt: scenePrompt.trim(),
          org_id: orgId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generering feilet')

      setGeneratedImage(data.placement.result_image_url)
      setSuccess('Scene generert!')
      setTimeout(() => setSuccess(null), 3000)
      fetchPlacements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setGenerating(false)
    }
  }

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewProductFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setNewProductPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600" />
            Produktplassering
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Last opp produkter og generer realistiske scener med AI
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'products'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Produkter
        </button>
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'generate'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Generer scene
        </button>
      </div>

      {/* ========== PRODUKTER TAB ========== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Produktbibliotek</h2>
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Last opp produkt
            </button>
          </div>

          {/* Upload form */}
          {showUploadForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <h3 className="font-semibold text-slate-800">Nytt produkt</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Produktnavn *</label>
                    <input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="F.eks. Vinterjakke Pro"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Beskrivelse</label>
                    <textarea
                      value={newProductDescription}
                      onChange={(e) => setNewProductDescription(e.target.value)}
                      placeholder="Valgfri beskrivelse..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produktbilde *</label>
                  {newProductPreview ? (
                    <div className="relative">
                      <img src={newProductPreview} alt="Preview" className="w-full h-48 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                      <button
                        onClick={() => { setNewProductFile(null); setNewProductPreview(null) }}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-slate-100"
                      >
                        <X className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                      <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-500">Klikk for å velge bilde</span>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleUploadProduct}
                  disabled={!newProductFile || !newProductName.trim() || uploadingProduct}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingProduct ? 'Laster opp...' : 'Legg til produkt'}
                </button>
                <button
                  onClick={() => { setShowUploadForm(false); setNewProductFile(null); setNewProductPreview(null); setNewProductName(''); setNewProductDescription('') }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {/* Product grid */}
          {products.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Ingen produkter ennå. Last opp ditt første produkt!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="aspect-square bg-slate-50 relative">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-contain p-4"
                    />
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      disabled={deletingId === product.id}
                      className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800 text-sm">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <button
                      onClick={() => { setSelectedProduct(product); setActiveTab('generate') }}
                      className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Generer scene <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== GENERER SCENE TAB ========== */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Config */}
          <div className="space-y-4">
            {/* Product selector */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-slate-800 text-sm">Velg produkt</h3>
              {products.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Ingen produkter. <button onClick={() => setActiveTab('products')} className="text-indigo-600 hover:underline">Last opp et produkt først.</button>
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`rounded-lg border-2 p-1 transition-all ${
                        selectedProduct?.id === product.id
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img
                        src={product.thumbnail_url || product.image_url}
                        alt={product.name}
                        className="w-full aspect-square object-contain rounded bg-slate-50"
                      />
                      <p className="text-[10px] text-slate-600 mt-1 truncate px-1">{product.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scene prompt */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-slate-800 text-sm">Scene-beskrivelse</h3>
              <textarea
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                placeholder="Beskriv scenen du vil plassere produktet i, f.eks. 'Mann i urban setting med jakken på'"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />

              {/* Style presets */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Hurtigvalg for scene-stil:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SCENE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setScenePrompt(preset.prompt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        scenePrompt === preset.prompt
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedProduct || !scenePrompt.trim() || generating}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Genererer scene...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generer scene
                </>
              )}
            </button>
          </div>

          {/* Right: Result + Gallery */}
          <div className="space-y-4">
            {/* Result */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 text-sm mb-3">Resultat</h3>
              {generatedImage ? (
                <div className="space-y-3">
                  <img
                    src={generatedImage}
                    alt="Generated scene"
                    className="w-full rounded-lg border border-slate-200"
                  />
                  <a
                    href={generatedImage}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Last ned bilde
                  </a>
                </div>
              ) : generating ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
                  <p className="text-sm">Genererer scene...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ImageIcon className="w-10 h-10 mb-2" />
                  <p className="text-sm">Velg et produkt og beskriv en scene for å starte</p>
                </div>
              )}
            </div>

            {/* Gallery */}
            {selectedProduct && placements.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-800 text-sm mb-3">
                  Tidligere genereringer for {selectedProduct.name}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {placements
                    .filter((p) => p.status === 'completed' && p.result_image_url)
                    .map((placement) => (
                      <div key={placement.id} className="group relative">
                        <img
                          src={placement.result_image_url!}
                          alt={placement.scene_prompt}
                          className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end p-2">
                          <p className="text-white text-[10px] line-clamp-2">{placement.scene_prompt}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
