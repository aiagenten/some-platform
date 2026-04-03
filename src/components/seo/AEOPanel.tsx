'use client'

import { useState } from 'react'
import {
  Bot, Loader2, Sparkles, Code2, MessageSquareQuote, ChevronDown, ChevronUp, Plus,
} from 'lucide-react'

type FAQ = { question: string; answer: string }

type AEOData = {
  faqs?: FAQ[]
  featured_snippet?: string
  schema_json_ld?: Record<string, unknown>
  generated_at?: string
}

type Props = {
  articleId: string
  aeoData: AEOData | null
  onAEOGenerated: (data: AEOData) => void
  onInsertFAQ: (faqs: FAQ[]) => void
}

export default function AEOPanel({ articleId, aeoData, onAEOGenerated, onInsertFAQ }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showSchema, setShowSchema] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/articles/${articleId}/aeo`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        onAEOGenerated(data.aeo)
      } else {
        setError(data.error || 'Noe gikk galt')
      }
    } catch {
      setError('Kunne ikke kontakte serveren')
    } finally {
      setGenerating(false)
    }
  }

  const faqs = aeoData?.faqs || []
  const snippet = aeoData?.featured_snippet || ''
  const schema = aeoData?.schema_json_ld

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Bot className="w-4 h-4 text-slate-400" />
        AI-synlighet (AEO)
      </h3>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50"
      >
        {generating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {generating ? 'Genererer...' : aeoData ? 'Generer på nytt' : 'Generer AEO-data'}
      </button>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Featured snippet */}
      {snippet && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <MessageSquareQuote className="w-3 h-3" />
            Featured snippet
          </h4>
          <div className="text-xs text-slate-700 bg-violet-50 border border-violet-100 rounded-lg p-3 leading-relaxed">
            {snippet}
          </div>
        </div>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-slate-500">FAQ ({faqs.length} spørsmål)</h4>
            <button
              onClick={() => onInsertFAQ(faqs)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus className="w-3 h-3" />
              Sett inn i artikkel
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex items-start gap-2 cursor-pointer text-xs font-medium text-slate-700 hover:text-indigo-600 transition-colors list-none">
                  <ChevronDown className="w-3 h-3 mt-0.5 flex-shrink-0 group-open:hidden" />
                  <ChevronUp className="w-3 h-3 mt-0.5 flex-shrink-0 hidden group-open:block" />
                  {faq.question}
                </summary>
                <p className="text-xs text-slate-600 ml-5 mt-1 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Schema preview */}
      {schema && (
        <div className="space-y-1.5">
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <Code2 className="w-3 h-3" />
            Schema.org JSON-LD
            {showSchema ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showSchema && (
            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-600 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
              {JSON.stringify(schema, null, 2)}
            </pre>
          )}
        </div>
      )}

      {aeoData?.generated_at && (
        <p className="text-[10px] text-slate-400">
          Sist generert: {new Date(aeoData.generated_at).toLocaleString('nb-NO')}
        </p>
      )}
    </div>
  )
}
