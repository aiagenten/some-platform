'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Upload, Loader2, X, Check, User, Sparkles } from 'lucide-react'

export default function NewDigitalTwinPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [triggerWord, setTriggerWord] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [training, setTraining] = useState(false)
  const [twinId, setTwinId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (profile) setOrgId(profile.org_id)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate trigger word from name
  useEffect(() => {
    if (name && !triggerWord) {
      const tw = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) + 'AI'
      setTriggerWord(tw)
    }
  }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const totalFiles = [...images, ...newFiles].slice(0, 20)
    setImages(totalFiles)

    // Generate previews
    totalFiles.forEach((file, i) => {
      if (i >= imagePreviews.length) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setImagePreviews(prev => {
            const updated = [...prev]
            updated[i] = e.target?.result as string
            return updated
          })
        }
        reader.readAsDataURL(file)
      }
    })
  }, [images, imagePreviews])

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleStep2Submit = async () => {
    if (!orgId || images.length < 5) {
      setError('Last opp minst 5 bilder')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Upload images to Supabase Storage
      const uploadedUrls: string[] = []
      for (const file of images) {
        const ext = file.name.split('.').pop() || 'jpg'
        const fileName = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('training-images')
          .upload(fileName, file, { contentType: file.type, upsert: false })

        if (uploadErr) {
          console.error('Upload error:', uploadErr)
          throw new Error(`Feil ved opplasting av ${file.name}`)
        }

        const { data: urlData } = supabase.storage.from('training-images').getPublicUrl(fileName)
        uploadedUrls.push(urlData.publicUrl)
      }

      // Create digital twin record
      const { data: twin, error: insertErr } = await supabase
        .from('digital_twins')
        .insert({
          tenant_id: orgId,
          name,
          trigger_word: triggerWord,
          status: 'uploading',
          training_images: uploadedUrls,
        })
        .select()
        .single()

      if (insertErr || !twin) throw new Error('Kunne ikke opprette twin')

      setTwinId(twin.id)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
    } finally {
      setUploading(false)
    }
  }

  const handleStartTraining = async () => {
    if (!twinId) return
    setTraining(true)
    setError(null)

    try {
      const res = await fetch('/api/digital-twin/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twin_id: twinId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Trening feilet')
      }

      router.push(`/dashboard/digital-twin/${twinId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt')
      setTraining(false)
    }
  }

  return (
    <div>
      <button onClick={() => router.push('/dashboard/digital-twin')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Tilbake til Digital Twin
      </button>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Opprett ny Digital Twin</h1>
      <p className="text-sm text-slate-500 mb-8">Tren en AI-modell som kan generere bilder av deg i ulike settinger</p>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              s < step ? 'bg-emerald-500 text-white' :
              s === step ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' :
              'bg-slate-100 text-slate-400'
            }`}>
              {s < step ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm font-medium ${s === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {s === 1 ? 'Navn' : s === 2 ? 'Bilder' : 'Trening'}
            </span>
            {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm max-w-2xl">
        {/* Step 1: Name + Trigger Word */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Navn og trigger-ord</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Navn</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="F.eks. Andreas, Henriette"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trigger-ord</label>
                <input
                  type="text"
                  value={triggerWord}
                  onChange={(e) => setTriggerWord(e.target.value.toUpperCase())}
                  placeholder="F.eks. ANDRSB"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">Dette ordet brukes i prompts for å referere til personen. Bruk et unikt ord.</p>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!name || !triggerWord}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Neste
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload Images */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Last opp treningsbilder</h2>
            <p className="text-sm text-slate-500 mb-4">Last opp 10-20 bilder med variert bakgrunn, belysning og vinkel. Kun ansiktet til {name} bør være i bildene.</p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <Upload className={`w-8 h-8 mx-auto mb-3 ${dragOver ? 'text-indigo-500' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-700">Dra og slipp bilder her</p>
              <p className="text-xs text-slate-400 mt-1">eller klikk for å velge filer (JPG, PNG, WebP)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* Image previews */}
            {images.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">{images.length}/20 bilder valgt</p>
                <div className="grid grid-cols-5 gap-2">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative group">
                      <img src={preview} alt="" className="w-full aspect-square rounded-lg object-cover border border-slate-200" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Tilbake
              </button>
              <button
                onClick={handleStep2Submit}
                disabled={images.length < 5 || uploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Laster opp...
                  </>
                ) : (
                  <>
                    Last opp og fortsett
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Start Training */}
        {step === 3 && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Klar for trening!</h2>
            <p className="text-sm text-slate-500 mb-1">{images.length} bilder lastet opp for <strong>{name}</strong></p>
            <p className="text-sm text-slate-500 mb-6">Trigger-ord: <code className="bg-slate-100 px-2 py-0.5 rounded text-indigo-600 font-mono text-xs">{triggerWord}</code></p>
            <p className="text-xs text-slate-400 mb-6">Treningen tar vanligvis 5-15 minutter. Du kan følge med på statusen etterpå.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>
            )}

            <button
              onClick={handleStartTraining}
              disabled={training}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {training ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starter trening...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Start trening
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
