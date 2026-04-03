'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Sparkles, Loader2, Lightbulb, RefreshCw,
  AlignLeft, AlignJustify, BookOpen
} from 'lucide-react'

type Suggestion = {
  title: string
  description: string
  keyword: string
}

type Props = {
  open: boolean
  onClose: () => void
  /** If provided, the generated article replaces this article's content instead of creating new */
  existingArticleId?: string
}

const LENGTH_OPTIONS = [
  { value: 'short' as const, label: 'Kort', description: '500–800 ord', icon: AlignLeft },
  { value: 'medium' as const, label: 'Medium', description: '800–1500 ord', icon: AlignJustify },
  { value: 'long' as const, label: 'Lang', description: '1500–2500 ord', icon: BookOpen },
]

export default function ArticleGenerateModal({ open, onClose, existingArticleId }: Props) {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('')
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  useEffect(() => {
    if (open) {
      loadSuggestions()
    }
  }, [open])

  async function loadSuggestions() {
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/articles/suggestions')
      if (res.ok) {
        const data = await res.json()
        setSuggestions(Array.isArray(data) ? data : [])
      }
    } catch {
      // Ignore — suggestions are optional
    }
    setLoadingSuggestions(false)
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || undefined,
          tone: tone || undefined,
          length,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Noe gikk galt')
        setGenerating(false)
        return
      }

      // Navigate to the new article
      if (data.id) {
        onClose()
        router.push(`/dashboard/articles/${data.id}`)
      }
    } catch {
      setError('Nettverksfeil — prøv igjen')
    }

    setGenerating(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Generer artikkel med AI</h2>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Topic input */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Tema / søkeord (valgfritt)
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="F.eks. «Hvordan øke salget med sosiale medier»"
              disabled={generating}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 disabled:opacity-50"
            />
            <p className="text-xs text-slate-400 mt-1">
              La feltet stå tomt for å la AI foreslå et tema basert på merkevaren din
            </p>
          </div>

          {/* Topic suggestions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Forslag
              </label>
              <button
                onClick={loadSuggestions}
                disabled={loadingSuggestions || generating}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                Nye forslag
              </button>
            </div>
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="ml-2 text-sm text-slate-400">Henter forslag...</span>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setTopic(s.title)}
                    disabled={generating}
                    className={`text-left p-3 rounded-xl border transition-all text-sm ${
                      topic === s.title
                        ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200'
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    <p className="font-medium text-slate-800 line-clamp-1">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>
                    {s.keyword && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">
                        {s.keyword}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                Klikk «Nye forslag» for å hente temaforslag basert på merkevaren din
              </p>
            )}
          </div>

          {/* Tone override */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Tone (valgfritt — hentes automatisk fra merkevare)
            </label>
            <input
              type="text"
              value={tone}
              onChange={e => setTone(e.target.value)}
              placeholder="F.eks. «uformell og humoristisk» eller «faglig og autoritativ»"
              disabled={generating}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 disabled:opacity-50"
            />
          </div>

          {/* Length selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Lengde</label>
            <div className="grid grid-cols-3 gap-2">
              {LENGTH_OPTIONS.map(opt => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    onClick={() => setLength(opt.value)}
                    disabled={generating}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      length === opt.value
                        ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200'
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    } disabled:opacity-50`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${
                      length === opt.value ? 'text-indigo-600' : 'text-slate-400'
                    }`} />
                    <p className={`text-sm font-medium ${
                      length === opt.value ? 'text-indigo-700' : 'text-slate-700'
                    }`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-slate-500">{opt.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm disabled:opacity-70"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Genererer artikkel...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
