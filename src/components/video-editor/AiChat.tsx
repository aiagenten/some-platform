'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Send, Bot, Loader2, User, Clapperboard, Paintbrush, Drama } from 'lucide-react'
import type { EditorState, DirectorOperation, SelectedRange } from '@/lib/editor-state'
import { formatSeconds } from '@/lib/editor-state'
import { QuickActions } from './QuickActions'
import type { AgentType } from './QuickActions'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  agent?: AgentType
  timestamp: number
}

type Props = {
  editorState: EditorState
  selectedRange: SelectedRange
  onApplyOps: (ops: DirectorOperation[]) => void
}

const AGENT_CONFIG: Record<AgentType, { label: string; subtitle: string; icon: React.ReactNode; color: string; desc: string }> = {
  director: {
    label: 'Regissør',
    subtitle: 'Redigering & timing',
    icon: <Clapperboard className="w-4 h-4" />,
    color: 'text-indigo-400 border-indigo-500',
    desc: 'Redigering, teksting, timing',
  },
  picasso: {
    label: 'Picasso',
    subtitle: 'Visuelt & stil',
    icon: <Paintbrush className="w-4 h-4" />,
    color: 'text-purple-400 border-purple-500',
    desc: 'Visuelt, overlays, stil',
  },
  dicaprio: {
    label: 'DiCaprio',
    subtitle: 'Videogenererering',
    icon: <Drama className="w-4 h-4" />,
    color: 'text-amber-400 border-amber-500',
    desc: 'Videogenerering, overganger',
  },
}

function AgentIcon({ agent }: { agent: AgentType }) {
  const cfg = AGENT_CONFIG[agent]
  return (
    <div className={`p-1 rounded ${agent === 'director' ? 'bg-indigo-900/60' : agent === 'picasso' ? 'bg-purple-900/60' : 'bg-amber-900/60'}`}>
      <span className={cfg.color}>{cfg.icon}</span>
    </div>
  )
}

export function AiChat({ editorState, selectedRange, onApplyOps }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState<AgentType>('director')
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [
      ...prev,
      { ...msg, id: Math.random().toString(36).slice(2), timestamp: Date.now() },
    ])
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')

    // Build prompt with range context if selected
    let fullPrompt = text
    if (selectedRange) {
      const startSec = formatSeconds(selectedRange.startFrame / editorState.fps)
      const endSec = formatSeconds(selectedRange.endFrame / editorState.fps)
      fullPrompt = `[Tidsrom: ${startSec} – ${endSec}] ${text}`
    }

    addMessage({ role: 'user', content: fullPrompt })
    setLoading(true)

    try {
      const resp = await fetch('/api/video/ai-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          editorState,
          agentType: activeAgent,
          selectedTimeRange: selectedRange,
        }),
      })

      if (!resp.ok) {
        const errText = await resp.text()
        addMessage({
          role: 'assistant',
          content: `Feil: ${errText}`,
          agent: activeAgent,
        })
        return
      }

      const data = await resp.json()

      if (data.operations?.length) {
        onApplyOps(data.operations)
      }

      addMessage({
        role: 'assistant',
        content: data.message || `Utførte ${data.operations?.length ?? 0} operasjon(er).`,
        agent: activeAgent,
      })
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `Tilkobling feilet: ${String(err)}`,
        agent: activeAgent,
      })
    } finally {
      setLoading(false)
    }
  }, [input, loading, selectedRange, editorState, activeAgent, addMessage, onApplyOps])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const handleQuickMessage = useCallback(
    (msg: string, agent: AgentType) => {
      addMessage({ role: 'assistant', content: msg, agent })
    },
    [addMessage],
  )

  const agentCfg = AGENT_CONFIG[activeAgent]

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 text-sm">
      {/* Agent tabs */}
      <div className="flex gap-1 px-3 pt-3 pb-2 border-b border-slate-700/60 bg-slate-800/40">
        {(Object.entries(AGENT_CONFIG) as [AgentType, typeof AGENT_CONFIG[AgentType]][]).map(
          ([key, cfg]) => (
            <button
              key={key}
              onClick={() => setActiveAgent(key)}
              className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                activeAgent === key
                  ? `${cfg.color} bg-slate-700/60`
                  : 'text-slate-500 border-slate-700 hover:text-slate-300 hover:border-slate-600'
              }`}
              title={cfg.desc}
            >
              <div className="flex items-center gap-1.5">
                <span className={activeAgent === key ? cfg.color.split(' ')[0] : 'text-slate-500'}>
                  {cfg.icon}
                </span>
                <span>{cfg.label}</span>
              </div>
              <span className="text-[9px] text-slate-500 mt-0.5 font-normal">{cfg.subtitle}</span>
            </button>
          ),
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-600 text-xs mt-6 space-y-2">
            <Bot className="w-8 h-8 mx-auto text-slate-700" />
            <div>Spør {agentCfg.label} om å redigere videoen din</div>
            {selectedRange && (
              <div className="bg-amber-950/40 border border-amber-800/40 text-amber-400 px-2 py-1 rounded text-[10px]">
                Tidsrom valgt: {formatSeconds(selectedRange.startFrame / editorState.fps)} –{' '}
                {formatSeconds(selectedRange.endFrame / editorState.fps)}
              </div>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            {msg.role === 'user' ? (
              <div className="p-1 rounded bg-slate-700 shrink-0">
                <User className="w-3.5 h-3.5 text-slate-300" />
              </div>
            ) : (
              <div className="shrink-0">
                {msg.agent ? <AgentIcon agent={msg.agent} /> : <Bot className="w-5 h-5 text-indigo-400" />}
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600/60 text-white rounded-br-sm'
                  : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/60'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 items-center">
            <AgentIcon agent={activeAgent} />
            <div className="bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              <span className="text-xs text-slate-400">{agentCfg.label} tenker…</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Quick actions */}
      <QuickActions
        editorState={editorState}
        onApplyOps={onApplyOps}
        onMessage={handleQuickMessage}
      />

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-700/60">
        {selectedRange && (
          <div className="text-[10px] text-amber-400 mb-1">
            📍 Tidsrom: {formatSeconds(selectedRange.startFrame / editorState.fps)} – {formatSeconds(selectedRange.endFrame / editorState.fps)}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Si til ${agentCfg.label} hva som skal gjøres…`}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-white transition-colors self-end"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="text-[10px] text-slate-600 mt-1">
          Enter for å sende · Shift+Enter for ny linje
        </div>
      </div>
    </div>
  )
}
