'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Sparkles, Bot, RefreshCw, Paintbrush, Loader2 } from 'lucide-react'

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
]

const FORMATS: Record<string, { value: string; label: string }[]> = {
  instagram: [
    { value: 'feed', label: 'Feed-post' },
    { value: 'carousel', label: 'Karusell' },
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
  ],
  facebook: [
    { value: 'feed', label: 'Innlegg' },
    { value: 'story', label: 'Story' },
    { value: 'video', label: 'Video' },
  ],
  linkedin: [
    { value: 'feed', label: 'Innlegg' },
    { value: 'article', label: 'Artikkel' },
  ],
}

type GeneratedContent = {
  text: string | null
  caption: string | null
  hashtags: string[]
  image_url: string | null
}

export default function GeneratePage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [platform, setPlatform] = useState('instagram')
  const [format, setFormat] = useState('feed')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [generated, setGenerated] = useState<GeneratedContent | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadOrg() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (profile) setOrgId(profile.org_id)
    }
    loadOrg()
  }, [])

  useEffect(() => {
    const first = FORMATS[platform]?.[0]?.value
    if (first) setFormat(first)
  }, [platform])

  const handleGenerate = async (regenerateText = false, regenerateImage = false) => {
    if (!orgId) return
    setError(null)
    const isRegenerate = regenerateText || regenerateImage
    if (regenerateText) setLoadingText(true)
    else if (regenerateImage) setLoadingImage(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          platform,
          format,
          topic: topic || undefined,
          regenerate_text: regenerateText,
          regenerate_image: regenerateImage,
          post_id: isRegenerate ? postId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Noe gikk galt')
        return
      }
      setPostId(data.post.id)
      if (isRegenerate) {
        setGenerated(prev => ({
          text: regenerateText ? data.generated.text : (prev?.text || null),
          caption: regenerateText ? data.generated.caption : (prev?.caption || null),
          hashtags: regenerateText ? data.generated.hashtags : (prev?.hashtags || []),
          image_url: regenerateImage ? data.generated.image_url : (prev?.image_url || null),
        }))
      } else {
        setGenerated(data.generated)
      }
    } catch {
      setError('Nettverksfeil. Prøv igjen.')
    } finally {
      setLoading(false)
      setLoadingText(false)
      setLoadingImage(false)
    }
  }

  return (
    <div className="animate-fade-in-up">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors">
        <span>←</span> Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Generer innhold</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Config panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-5">Innstillinger</h2>

            {/* Platform */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Plattform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={`px-3 py-4 rounded-xl text-sm font-medium transition-all duration-200 border flex flex-col items-center gap-2 ${
                        platform === p.value
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${platform === p.value ? 'text-indigo-600' : 'text-slate-400'}`} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Format */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS[platform]?.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      format === f.value
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tema <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="F.eks. lansering av nytt produkt, kundehistorie, bransjetips..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all duration-200 hover:border-slate-300"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !orgId}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generer innhold
                </>
              )}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="space-y-6">
          {!generated && !loading && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-slate-500">Velg plattform og format, så genererer vi innhold for deg</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Bot className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-slate-500">Genererer tekst og bilde...</p>
              <p className="text-xs text-slate-400 mt-1">Dette kan ta 10-30 sekunder</p>
            </div>
          )}

          {generated && (
            <>
              {/* Text result */}
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Tekst</h3>
                  <button
                    onClick={() => handleGenerate(true, false)}
                    disabled={loadingText}
                    className="text-sm px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 border border-purple-100"
                  >
                    {loadingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {loadingText ? 'Regenererer...' : 'Regenerer tekst'}
                  </button>
                </div>
                {generated.text ? (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {generated.text}
                    </pre>
                    {generated.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {generated.hashtags.map((tag, i) => (
                          <span key={i} className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Ingen tekst generert</p>
                )}
              </div>

              {/* Image result */}
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Bilde</h3>
                  <button
                    onClick={() => handleGenerate(false, true)}
                    disabled={loadingImage}
                    className="text-sm px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 border border-purple-100"
                  >
                    {loadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {loadingImage ? 'Regenererer...' : 'Regenerer bilde'}
                  </button>
                </div>
                {loadingImage ? (
                  <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                    <div className="text-center">
                      <Paintbrush className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                      <p className="text-sm text-slate-400 mt-3">Genererer nytt bilde...</p>
                    </div>
                  </div>
                ) : generated.image_url ? (
                  <img
                    src={generated.image_url}
                    alt="Generert bilde"
                    className="w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                    <p className="text-sm text-slate-400">Ingen bilde generert</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {postId && (
                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/posts/${postId}`}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 text-center shadow-sm"
                  >
                    Se innlegg →
                  </Link>
                  <Link
                    href="/dashboard/posts"
                    className="flex-1 bg-white text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-all duration-200 text-center border border-slate-200"
                  >
                    Alle innlegg
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
