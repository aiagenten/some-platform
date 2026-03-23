'use client'

import { useState } from 'react'
import { Scissors, Type, Image as ImageIcon, Music, Loader2, Zap } from 'lucide-react'
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
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'remove-dead-air',
    label: 'Remove dead air',
    icon: <Scissors className="w-3.5 h-3.5" />,
    prompt: 'Find and remove all silent/dead air sections from the video. Use the transcript to identify pauses longer than 0.5 seconds and remove them.',
    agent: 'director',
    color: 'text-orange-400 bg-orange-950/40 border-orange-800/60 hover:bg-orange-900/40',
  },
  {
    id: 'add-captions',
    label: 'Add captions',
    icon: <Type className="w-3.5 h-3.5" />,
    prompt: 'Transcribe the video and add word-level captions to the T1 caption track using the "sentences" style.',
    agent: 'director',
    color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60 hover:bg-cyan-900/40',
  },
  {
    id: 'add-logo',
    label: 'Add logo',
    icon: <ImageIcon className="w-3.5 h-3.5" />,
    prompt: 'Add a logo watermark overlay to the V2 track for the entire duration of the video.',
    agent: 'picasso',
    color: 'text-purple-400 bg-purple-950/40 border-purple-800/60 hover:bg-purple-900/40',
  },
  {
    id: 'add-music',
    label: 'Add music',
    icon: <Music className="w-3.5 h-3.5" />,
    prompt: 'Generate background music that matches the mood of this video and add it to the A2 audio track.',
    agent: 'director',
    color: 'text-green-400 bg-green-950/40 border-green-800/60 hover:bg-green-900/40',
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
        onMessage?.(`Error: ${err}`, action.agent)
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
      onMessage?.(`Failed: ${String(err)}`, action.agent)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-3 border-t border-slate-700/60">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          Quick Actions
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={loading !== null}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md border text-xs font-medium transition-all ${action.color} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {loading === action.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
