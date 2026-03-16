'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
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

  // Reset format when platform changes
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
    <div>
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Generer innhold</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Config panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Innstillinger</h2>

            {/* Platform */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Plattform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition border ${
                      platform === p.value
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg block mb-1">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS[platform]?.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      format === f.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tema <span className="text-gray-400 font-normal">(valgfritt)</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="F.eks. lansering av nytt produkt, kundehistorie, bransjetips..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={() => handleGenerate()}
              disabled={loading || !orgId}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Genererer...
                </span>
              ) : (
                '✨ Generer innhold'
              )}
            </button>

            {error && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="space-y-6">
          {!generated && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">✨</div>
              <p className="text-gray-500">Velg plattform og format, så genererer vi innhold for deg</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3 animate-pulse">🤖</div>
              <p className="text-gray-500">Genererer tekst og bilde...</p>
              <p className="text-xs text-gray-400 mt-1">Dette kan ta 10-30 sekunder</p>
            </div>
          )}

          {generated && (
            <>
              {/* Text result */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Tekst</h3>
                  <button
                    onClick={() => handleGenerate(true, false)}
                    disabled={loadingText}
                    className="text-sm px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition disabled:opacity-50"
                  >
                    {loadingText ? '⏳ Regenererer...' : '🔄 Regenerer tekst'}
                  </button>
                </div>
                {generated.text ? (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans bg-gray-50 p-4 rounded-lg">
                      {generated.text}
                    </pre>
                    {generated.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {generated.hashtags.map((tag, i) => (
                          <span key={i} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Ingen tekst generert</p>
                )}
              </div>

              {/* Image result */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Bilde</h3>
                  <button
                    onClick={() => handleGenerate(false, true)}
                    disabled={loadingImage}
                    className="text-sm px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition disabled:opacity-50"
                  >
                    {loadingImage ? '⏳ Regenererer...' : '🔄 Regenerer bilde'}
                  </button>
                </div>
                {loadingImage ? (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl animate-pulse">🎨</div>
                      <p className="text-sm text-gray-400 mt-2">Genererer nytt bilde...</p>
                    </div>
                  </div>
                ) : generated.image_url ? (
                  <img
                    src={generated.image_url}
                    alt="Generert bilde"
                    className="w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-gray-400">Ingen bilde generert</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {postId && (
                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/posts/${postId}`}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition text-center"
                  >
                    Se innlegg →
                  </Link>
                  <Link
                    href="/dashboard/posts"
                    className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition text-center"
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
