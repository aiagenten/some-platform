'use client'

import { useState } from 'react'
import { Scissors, Type, Music, Sparkles, Loader2, Zap } from 'lucide-react'
import type { EditorState } from '@/lib/editor-state'
import type { DirectorOperation } from '@/lib/editor-state'

type Props = {
  editorState: EditorState
  onApplyOps: (ops: DirectorOperation[]) => void
  onMessage?: (msg: string, agent: AgentType) => void
}

export type AgentType = 'director' | 'picasso' | 'dicaprio'

type QuickAction = {
  id: string
  label: string
  icon: React.ReactNode
  prompt: string
  agent: AgentType
  color: string
  bgColor: string
  borderColor: string
  hoverBg: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'remove-dead-air',
    label: 'Fjern pauser',
    icon: <Scissors className="w-4 h-4 shrink-0" />,
    prompt: 'Finn og fjern alle stille/tomme seksjoner fra videoen. Bruk transkripsjonen til å identifisere pauser lengre enn 0,5 sekunder og fjern dem.',
    agent: 'director',
    color: 'text-orange-200',
    bgColor: 'bg-orange-900/60',
    borderColor: 'border-orange-700',
    hoverBg: 'hover:bg-orange-800/60',
  },
  {
    id: 'add-captions',
    label: 'Auto-teksting',
    icon: <Type className="w-4 h-4 shrink-0" />,
    prompt: 'Transkriber videoen og legg til bildetekster på T1-sporet med "sentences"-stil.',
    agent: 'director',
    color: 'text-cyan-200',
    bgColor: 'bg-cyan-900/60',
    borderColor: 'border-cyan-700',
    hoverBg: 'hover:bg-cyan-800/60',
  },
  {
    id: 'add-music',
    label: 'Legg til musikk',
    icon: <Music className="w-4 h-4 shrink-0" />,
    prompt: 'Legg til bakgrunnsmusikk som passer stemningen i videoen på A2-lydsporet.',
    agent: 'director',
    color: 'text-green-200',
    bgColor: 'bg-green-900/60',
    borderColor: 'border-green-700',
    hoverBg: 'hover:bg-green-800/60',
  },
  {
    id: 'optimize',
    label: 'Optimaliser',
    icon: <Sparkles className="w-4 h-4 shrink-0" />,
    prompt: 'Analyser videoen og optimaliser pacing, timing og klipperekkefølge for best mulig engasjement. Gi konkrete forslag til forbedringer.',
    agent: 'director',
    color: 'text-violet-200',
    bgColor: 'bg-violet-900/60',
    borderColor: 'border-violet-700',
    hoverBg: 'hover:bg-violet-800/60',
  },
]

export function QuickActions({ editorState, onApplyOps, onMessage }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleAction = async (action: QuickAction) => {
    if (loading) return
    setLoading(action.id)

    try {
      const resp = await fetch('/api/video/ai-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: action.prompt,
          editorState,
          agentType: action.agent,
          isQuickAction: true,
          quickActionId: action.id,
        }),
      })

      if (!resp.ok) {
        const err = await resp.text()
        onMessage?.(`Feil: ${err}`, action.agent)
        return
      }

      const data = await resp.json()

      if (data.operations?.length) {
        onApplyOps(data.operations)
      }

      if (data.message) {
        onMessage?.(data.message, action.agent)
      }
    } catch (err) {
      onMessage?.(`Tilkobling feilet: ${String(err)}`, action.agent)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-3 border-t border-slate-700/60">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
          Hurtighandlinger
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={loading !== null}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold
              transition-all disabled:opacity-40 disabled:cursor-not-allowed
              ${action.color} ${action.bgColor} ${action.borderColor} ${action.hoverBg}
            `}
            title={action.label}
          >
            {loading === action.id ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              action.icon
            )}
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
