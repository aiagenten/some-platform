'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Undo2, X } from 'lucide-react'
import type { OverlayElement } from '@/lib/custom-overlay-types'

type Props = {
  elements: OverlayElement[]
  canvasSize: { w: number; h: number }
  brandColors?: string[]
  onApply: (newElements: OverlayElement[]) => void
  onUndo: () => void
  canUndo: boolean
}

type Suggestion = {
  label: string
  prompt: string
}

function generateSuggestions(elements: OverlayElement[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  const hasText = elements.some(el => el.type === 'text')
  const hasShape = elements.some(el => el.type === 'shape')
  const hasColorBlock = elements.some(el => el.type === 'color-block')
  const hasLogo = elements.some(el => el.type === 'logo')

  if (hasText && !hasColorBlock) {
    suggestions.push({ label: 'Legg til bakgrunn bak tekst', prompt: 'Legg til en halvtransparent svart boks bak teksten for bedre lesbarhet' })
  }

  if (hasText) {
    const textEls = elements.filter(el => el.type === 'text')
    const smallText = textEls.some(el => (el.fontSize || 48) < 40)
    if (smallText) {
      suggestions.push({ label: 'Gjør teksten større', prompt: 'Gjør all tekst mer prominent — større skriftstørrelse og bold' })
    }
    suggestions.push({ label: 'Bytt til moderne font', prompt: 'Bytt alle fonter til noe moderne og rent som Inter eller DM Sans' })
  }

  if (!hasLogo && elements.length > 0) {
    suggestions.push({ label: 'Legg til logo', prompt: 'Legg til en logo-plass i øvre venstre hjørne' })
  }

  if (hasLogo && hasText) {
    suggestions.push({ label: 'Gjør mer minimalistisk', prompt: 'Gjør designet mer minimalistisk — mer whitespace, enklere layout' })
  }

  if (hasShape) {
    suggestions.push({ label: 'Avrundede hjørner', prompt: 'Legg til avrundede hjørner på alle former' })
  }

  if (elements.length === 0) {
    suggestions.push(
      { label: 'Lag en enkel mal', prompt: 'Lag en enkel SoMe-mal med overskrift sentrert, undertekst under, og en halvtransparent mørk boks bak' },
      { label: 'Lag en moderne mal', prompt: 'Lag en moderne minimalistisk SoMe-mal med stor overskrift øverst, liten undertekst nederst' },
    )
  }

  return suggestions.slice(0, 4)
}

export function AiPromptBar({ elements, canvasSize, brandColors, onApply, onUndo, canUndo }: Props) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAiAction, setLastAiAction] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = generateSuggestions(elements)

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleSubmit = async (text?: string) => {
    const finalPrompt = (text || prompt).trim()
    if (!finalPrompt || loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/overlay/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          elements,
          canvasSize,
          brandColors,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Noe gikk galt')
        return
      }

      if (data.elements && Array.isArray(data.elements)) {
        onApply(data.elements)
        setLastAiAction(finalPrompt)
        setPrompt('')
      }
    } catch {
      setError('Kunne ikke koble til AI-tjenesten')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleUndoAi = () => {
    onUndo()
    setLastAiAction(null)
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[560px] max-w-[calc(100%-2rem)]">
      {/* Undo AI banner */}
      {lastAiAction && canUndo && (
        <div className="mb-2 flex items-center gap-2 bg-indigo-600/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3 h-3 flex-shrink-0" />
          <span className="truncate flex-1">AI: &ldquo;{lastAiAction}&rdquo;</span>
          <button
            onClick={handleUndoAi}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
          >
            <Undo2 className="w-3 h-3" />
            Angre
          </button>
        </div>
      )}

      {/* Suggestion chips */}
      {!loading && suggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 justify-center">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setPrompt(s.prompt)
                inputRef.current?.focus()
              }}
              className="px-2.5 py-1 rounded-full text-[11px] bg-slate-800/90 backdrop-blur-sm text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-2 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Prompt input */}
      <div className="flex items-center gap-2 bg-slate-800/95 backdrop-blur-sm border border-slate-700/80 rounded-xl px-3 py-2 shadow-xl">
        <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Beskriv endringen du vil gjøre..."
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!prompt.trim() || loading}
          className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
