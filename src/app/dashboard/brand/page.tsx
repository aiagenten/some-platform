'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Palette, Upload, RefreshCw, Loader2, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react'

type BrandProfile = {
  id: string
  org_id: string
  colors: string[]
  fonts: string[]
  tone: string | null
  voice_description: string | null
  tone_keywords: string[]
  tagline: string | null
  description: string | null
  target_audience: string | null
  do_list: string[]
  dont_list: string[]
  key_messages: string[]
  logo_url: string | null
  source_url: string | null
}

type BrandAsset = {
  name: string
  url: string
}

type TrainingPost = {
  id: string
  platform: string
  content_text: string | null
  caption: string | null
  created_at: string
  status: string
  ai_generated: boolean
}

type Learning = {
  id: string
  rule: string
  learning_type: string
  active: boolean
  source_post_id: string | null
}

export default function BrandPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [trainingPosts, setTrainingPosts] = useState<TrainingPost[]>([])
  const [learnings, setLearnings] = useState<Learning[]>([])
  const [excludedPosts, setExcludedPosts] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
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

      const { data: brandData } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('org_id', profile.org_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (brandData) setBrand(brandData)

      // Load brand assets
      const { data: files } = await supabase.storage
        .from('brand-assets')
        .list(profile.org_id, { limit: 50 })

      if (files && files.length > 0) {
        const assetList = files.map((f) => {
          const { data: urlData } = supabase.storage
            .from('brand-assets')
            .getPublicUrl(`${profile.org_id}/${f.name}`)
          return { name: f.name, url: urlData.publicUrl }
        })
        setAssets(assetList)
      }

      const { data: postsData } = await supabase
        .from('social_posts')
        .select('id, platform, content_text, caption, created_at, status, ai_generated')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(20)

      setTrainingPosts(postsData || [])

      const { data: learningsData } = await supabase
        .from('brand_learnings')
        .select('id, rule, learning_type, active, source_post_id')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      setLearnings(learningsData || [])

      const inactivePostIds = (learningsData || [])
        .filter(l => !l.active && l.source_post_id)
        .map(l => l.source_post_id!)
      setExcludedPosts(Array.from(new Set(inactivePostIds)))

      setLoading(false)
    }
    load()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId) return

    setUploading(true)
    setMessage(null)

    const ext = file.name.split('.').pop()
    const path = `${orgId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('brand-assets')
      .upload(path, file)

    if (error) {
      setMessage({ type: 'error', text: `Opplasting feilet: ${error.message}` })
    } else {
      const { data: urlData } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(path)
      setAssets(prev => [...prev, { name: file.name, url: urlData.publicUrl }])
      setMessage({ type: 'success', text: 'Bilde lastet opp!' })
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRescrape = async () => {
    if (!orgId || !brand?.source_url) return
    setScraping(true)
    setMessage(null)

    try {
      const res = await fetch('/api/brand/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, website_url: brand.source_url }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.brand) setBrand(data.brand)
        setMessage({ type: 'success', text: 'Merkevare re-analysert!' })
      } else {
        setMessage({ type: 'error', text: 'Re-analyse feilet' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Nettverksfeil' })
    }

    setScraping(false)
  }

  const handleToggleExclude = async (postId: string) => {
    const isCurrentlyExcluded = excludedPosts.includes(postId)

    setExcludedPosts(prev =>
      isCurrentlyExcluded ? prev.filter(id => id !== postId) : [...prev, postId]
    )

    const postLearnings = learnings.filter(l => l.source_post_id === postId)
    for (const learning of postLearnings) {
      await supabase
        .from('brand_learnings')
        .update({ active: isCurrentlyExcluded })
        .eq('id', learning.id)
    }

    setLearnings(prev => prev.map(l =>
      l.source_post_id === postId ? { ...l, active: isCurrentlyExcluded } : l
    ))
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Merkevare</h1>
          <p className="text-slate-500 text-sm mt-1">Din merkevare-profil og visuell identitet</p>
        </div>
        {brand?.source_url && (
          <button
            onClick={handleRescrape}
            disabled={scraping}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-all duration-200 disabled:opacity-50 border border-indigo-100"
          >
            {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {scraping ? 'Analyserer...' : 'Re-analyser nettside'}
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {!brand ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
          <Palette className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Ingen merkevare-profil funnet.</p>
          <p className="text-sm text-slate-400 mt-1">Gå til innstillinger for å sette opp din merkevare.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Brand Profile */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Merkevareprofil</h2>
            {(brand.tagline || brand.description) && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Merkenavn</p>
                <p className="text-lg font-semibold text-slate-900">{brand.tagline || brand.description?.split(".")[0]}</p>
              </div>
            )}
            {brand.description && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Beskrivelse</p>
                <p className="text-sm text-slate-700">{brand.description}</p>
              </div>
            )}
            {brand.target_audience && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Målgruppe</p>
                <p className="text-sm text-slate-700">{brand.target_audience}</p>
              </div>
            )}
            {brand.colors && brand.colors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Farger</p>
                <div className="flex flex-wrap gap-2">
                  {brand.colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div
                        className="w-5 h-5 rounded-md border border-slate-200"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono text-slate-700">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tone of Voice */}
          {(brand.tone || brand.voice_description) && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-2">Tone og stemme</h2>
              {brand.tone && <p className="text-sm text-slate-700 mb-2"><span className="font-medium">Tone:</span> {brand.tone}</p>}
              {brand.voice_description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{brand.voice_description}</p>}
              {brand.tone_keywords && brand.tone_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {brand.tone_keywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Key Messages */}
          {brand.key_messages && brand.key_messages.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-3">Nøkkelbudskap</h2>
              <ul className="space-y-2">
                {brand.key_messages.map((msg, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Do / Don't */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {brand.do_list && brand.do_list.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <h2 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Gjør dette
                </h2>
                <ul className="space-y-2">
                  {brand.do_list.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {brand.dont_list && brand.dont_list.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <h2 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Unngå dette
                </h2>
                <ul className="space-y-2">
                  {brand.dont_list.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Logo Upload */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-slate-600" />
              Brand-bilder
            </h2>

            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition-all duration-200 disabled:opacity-50 border border-slate-200"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Laster opp...' : 'Last opp bilde'}
              </button>
            </div>

            {assets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {assets.map((asset, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Ingen bilder lastet opp enda</p>
            )}
          </div>

          {/* Treningsinnlegg */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900">Treningsinnlegg</h2>
                <p className="text-sm text-slate-500 mt-0.5">Innlegg AI-en lærer av. Fjern de som ikke representerer merkevaren godt.</p>
              </div>
            </div>

            {trainingPosts.length > 0 ? (
              trainingPosts.map(post => {
                const postLearnings = learnings.filter(l => l.source_post_id === post.id)
                const isExcluded = excludedPosts.includes(post.id)

                return (
                  <div key={post.id} className={`p-4 rounded-xl border mb-3 transition-all ${isExcluded ? 'opacity-40 border-slate-200 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500 uppercase">{post.platform}</span>
                          {post.ai_generated && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI-generert</span>}
                          {postLearnings.length > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{postLearnings.length} læring{postLearnings.length > 1 ? 'er' : ''}</span>}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{post.caption || post.content_text || 'Ingen tekst'}</p>
                      </div>
                      <button
                        onClick={() => handleToggleExclude(post.id)}
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-all ${isExcluded ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}`}
                      >
                        {isExcluded ? 'Inkluder' : 'Fjern'}
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Ingen treningsinnlegg ennå. Publiser innlegg for å trene merkevaren.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
