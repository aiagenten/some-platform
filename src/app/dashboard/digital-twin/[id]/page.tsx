'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Sparkles, Copy, Check, User, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'

type DigitalTwin = {
  id: string
  name: string
  trigger_word: string
  status: 'uploading' | 'training' | 'ready' | 'failed'
  training_images: string[]
  lora_url: string | null
  lora_scale: number
  sample_outputs: { url: string }[] | null
  created_at: string
}

type GeneratedImage = {
  url: string
  prompt: string
  created_at: string
}

const PRESET_PROMPTS = [
  { label: 'Profesjonelt portrett', prompt: 'TRIGGER in a modern Scandinavian office with white walls and light wood furniture. Wearing a fitted wool blazer over a simple t-shirt. Standing by a window, soft natural light from the left. Warm, confident expression with a slight smile' },
  { label: 'Casualt utendørs', prompt: 'TRIGGER walking through a Nordic forest trail in autumn. Wearing a casual wool sweater and jeans. Golden hour sunlight filtering through birch trees. Relaxed, genuine smile. Shallow depth of field with bokeh background' },
  { label: 'Konferansetaler', prompt: 'TRIGGER on stage at a tech conference, mid-gesture while speaking. Dark stage background with soft blue accent lighting. Wearing smart casual attire. Audience silhouettes visible. Confident, engaging expression' },
  { label: 'Kreativt studio', prompt: 'TRIGGER in a bright creative workspace with plants and books. Sitting casually on a desk edge. Wearing a simple black turtleneck. Large window providing natural sidelight. Thoughtful, focused expression' },
  { label: 'Kafé-setting', prompt: 'TRIGGER at a cozy Scandinavian café with minimalist interior. Holding a ceramic coffee cup with both hands. Wooden table, soft ambient lighting from pendant lamps. Relaxed, candid moment mid-conversation' },
  { label: 'LinkedIn profil', prompt: 'Headshot of TRIGGER against a clean light grey wall. Soft diffused window light from the right. Wearing a crisp collared shirt. Warm, approachable smile. Shallow depth of field, shoulders slightly angled' },
]

export default function DigitalTwinDetailPage() {
  const params = useParams()
  const twinId = params.id as string
  const [twin, setTwin] = useState<DigitalTwin | null>(null)
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState('landscape_16_9')
  const [triggerWords, setTriggerWords] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (!profile) return

      const { data } = await supabase
        .from('digital_twins')
        .select('*')
        .eq('id', twinId)
        .eq('tenant_id', profile.org_id)
        .single()

      if (data) {
        setTwin(data as DigitalTwin)
        setTriggerWords((data as DigitalTwin).trigger_word)
      }
      setLoading(false)
    }
    load()
  }, [twinId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll status if training
  useEffect(() => {
    if (!twin || twin.status !== 'training') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/digital-twin/status?twin_id=${twin.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status !== 'training') {
            setTwin(prev => prev ? { ...prev, status: data.status, lora_url: data.lora_url || prev.lora_url, sample_outputs: data.sample_outputs || prev.sample_outputs } : prev)
          }
        }
      } catch { /* ignore */ }
    }, 10_000)

    return () => clearInterval(interval)
  }, [twin?.status, twin?.id])

  const handleGenerate = async (promptText?: string) => {
    const finalPrompt = promptText || prompt
    if (!twin || !finalPrompt) return

    // Replace TRIGGER with actual trigger word(s)
    const resolvedPrompt = finalPrompt.replace(/TRIGGER/g, triggerWords || twin.trigger_word)

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/digital-twin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twin_id: twin.id,
          prompt: resolvedPrompt,
          image_size: imageSize,
          num_images: 1,
        }),
      })

      if (!res.ok) {
        let errorMessage = 'Generering feilet'
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server-feil (${res.status}) — prøv igjen senere`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()

      // If images returned directly, display them
      if (data.images?.length) {
        const newImages = data.images.map((img: { url: string }) => ({
          url: img.url,
          prompt: resolvedPrompt,
          created_at: new Date().toISOString(),
        }))
        setGeneratedImages(prev => [...newImages, ...prev])
        return
      }

      // If queued, poll for result
      if (data.queued && data.request_id) {
        const maxAttempts = 60 // ~120 seconds with 2s interval
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 2000))

          const params = new URLSearchParams({
            request_id: data.request_id,
            twin_id: twin.id,
            prompt: resolvedPrompt,
            num_images: '1',
          })
          const pollRes = await fetch(`/api/digital-twin/generate?${params}`)

          if (!pollRes.ok) {
            const pollErr = await pollRes.json().catch(() => ({}))
            if (pollErr.status === 'failed') throw new Error('Generering feilet hos fal.ai')
            continue
          }

          const pollData = await pollRes.json()

          if (pollData.status === 'completed' && pollData.images?.length) {
            const newImages = pollData.images.map((img: { url: string }) => ({
              url: img.url,
              prompt: resolvedPrompt,
              created_at: new Date().toISOString(),
            }))
            setGeneratedImages(prev => [...newImages, ...prev])
            return
          }

          if (pollData.status === 'failed') {
            throw new Error('Generering feilet hos fal.ai')
          }
          // Still polling — continue loop
        }
        throw new Error('Generering tok for lang tid — prøv igjen')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Noe gikk galt'
      setError(`${msg} — prøv igjen!`)
    } finally {
      setGenerating(false)
    }
  }

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!twin) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Twin ikke funnet</p>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => router.push('/dashboard/digital-twin')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Tilbake til Digital Twin
      </button>

      {/* Twin info header */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <User className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{twin.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Trigger: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-xs">{twin.trigger_word}</code>
              </p>
            </div>
          </div>
          <StatusBadge status={twin.status} />
        </div>

        {/* Training status */}
        {twin.status === 'training' && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Modellen trenes...</span>
            </div>
            <p className="text-xs text-blue-500 mt-1">Dette tar vanligvis 5-15 minutter. Siden oppdateres automatisk.</p>
          </div>
        )}

        {twin.status === 'failed' && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">Treningen feilet</span>
            </div>
            <p className="text-xs text-red-500 mt-1">Prøv å opprette en ny twin med andre bilder.</p>
          </div>
        )}

        {/* Sample outputs */}
        {twin.sample_outputs && twin.sample_outputs.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Eksempelbilder fra trening</p>
            <div className="flex gap-2 overflow-x-auto">
              {twin.sample_outputs.map((img, i) => (
                <img key={i} src={img.url} alt="" className="w-24 h-24 rounded-xl object-cover border border-slate-200 flex-shrink-0" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate section — only when ready */}
      {twin.status === 'ready' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Generer bilder</h2>

            {/* Preset prompts */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Hurtigvalg</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_PROMPTS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPrompt(preset.prompt)}
                    disabled={generating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border disabled:opacity-50 ${
                      prompt === preset.prompt
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                        : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger words */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Trigger word(s)</label>
              <input
                value={triggerWords}
                onChange={(e) => setTriggerWords(e.target.value)}
                placeholder={twin.trigger_word}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Legg til flere trigger words (f.eks. to personer) separert med komma</p>
            </div>

            {/* Custom prompt */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Egendefinert prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Beskriv bildet du vil lage med ${twin.trigger_word}...`}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">Bruk <code className="bg-slate-100 px-1 rounded">TRIGGER</code> i prompten — erstattes med trigger word(s) automatisk.</p>
            </div>

            {/* Image size */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Bildeformat</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'square', label: '1:1' },
                  { value: 'landscape_16_9', label: '16:9' },
                  { value: 'portrait_4_3', label: '4:3 portrett' },
                  { value: 'landscape_4_3', label: '4:3 landskap' },
                ].map(size => (
                  <button
                    key={size.value}
                    onClick={() => setImageSize(size.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      imageSize === size.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={generating || !prompt}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generer bilde
                </>
              )}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>
            )}
          </div>

          {/* Generated images gallery */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Genererte bilder</h2>

              {generatedImages.length === 0 && !generating ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-7 h-7 text-indigo-600" />
                  </div>
                  <p className="text-slate-500 text-sm">Velg et hurtigvalg eller skriv en prompt for å generere bilder</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generating && (
                    <div className="aspect-video rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Genererer bilde...</p>
                      </div>
                    </div>
                  )}
                  {generatedImages.map((img, i) => (
                    <div key={i} className="group relative">
                      <img src={img.url} alt="" className="w-full rounded-xl border border-slate-200" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-xl transition-all flex items-end justify-between p-3 opacity-0 group-hover:opacity-100">
                        <p className="text-white text-xs truncate max-w-[70%]">{img.prompt}</p>
                        <button
                          onClick={() => copyUrl(img.url)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/90 text-slate-700 rounded-lg text-xs font-medium hover:bg-white transition-colors"
                        >
                          {copied === img.url ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copied === img.url ? 'Kopiert!' : 'Bruk i post'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    uploading: { label: 'Laster opp', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
    training: { label: 'Trener', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Loader2 },
    ready: { label: 'Klar', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    failed: { label: 'Feilet', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertCircle },
  }
  const info = map[status] || map.uploading
  const Icon = info.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${info.color}`}>
      <Icon className={`w-4 h-4 ${status === 'training' ? 'animate-spin' : ''}`} />
      {info.label}
    </span>
  )
}
