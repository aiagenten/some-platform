'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Film, Save, RotateCcw, Download, MoreVertical, Keyboard, Settings, FolderOpen, CheckCircle2 } from 'lucide-react'
import { useEditorState } from '@/hooks/useEditorState'
import { EditorLayout } from '@/components/video-editor/EditorLayout'
import type { TrackItem } from '@/lib/editor-state'

const STORAGE_KEY = 'ai-agenten-videostudio-project'

type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export default function VideoEditorV2Page() {
  const {
    state,
    setCurrentFrame,
    addTrackItem,
    moveTrackItem,
    resizeTrackItem,
    removeTrackItem,
    applyOps,
    loadState,
    reset,
  } = useEditorState()

  const [toasts, setToasts] = useState<Toast[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string; savedAt: string }[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Load saved projects list
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-list`)
      if (saved) setProjects(JSON.parse(saved))
    } catch {}
  }, [])

  const handleSave = useCallback(() => {
    try {
      const id = `project-${Date.now()}`
      const savedAt = new Date().toLocaleString('nb-NO')
      const projectName = `Video ${savedAt}`

      // Save project state
      localStorage.setItem(`${STORAGE_KEY}-${id}`, JSON.stringify(state))

      // Update project list
      const newProjects = [
        { id, name: projectName, savedAt },
        ...projects.slice(0, 9), // Keep last 10
      ]
      setProjects(newProjects)
      localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(newProjects))

      showToast('Prosjekt lagret ✓', 'success')
    } catch (err) {
      showToast('Lagring feilet: ' + String(err), 'error')
    }
  }, [state, projects, showToast])

  const handleLoadProject = useCallback((id: string) => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}-${id}`)
      if (!raw) {
        showToast('Prosjekt ikke funnet', 'error')
        return
      }
      const savedState = JSON.parse(raw)
      loadState(savedState)
      setShowProjects(false)
      showToast('Prosjekt lastet ✓', 'success')
    } catch (err) {
      showToast('Lasting feilet: ' + String(err), 'error')
    }
  }, [loadState, showToast])

  const handleReset = useCallback(() => {
    if (confirm('Nullstill prosjektet? Alle endringer vil gå tapt.')) {
      reset()
      showToast('Prosjekt nullstilt', 'info')
    }
  }, [reset, showToast])

  const handleExport = useCallback(() => {
    // Download project as JSON (MVP export)
    try {
      const json = JSON.stringify(state, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `videostudio-export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Prosjekt eksportert som JSON ✓', 'success')
    } catch (err) {
      showToast('Eksport feilet: ' + String(err), 'error')
    }
  }, [state, showToast])

  const handleAddTrackItem = useCallback(
    (trackId: string, item: Omit<TrackItem, 'id'>) => {
      addTrackItem(trackId, item)
    },
    [addTrackItem],
  )

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900 z-50">
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium text-white animate-in slide-in-from-right ${
              toast.type === 'success'
                ? 'bg-green-700'
                : toast.type === 'error'
                  ? 'bg-red-700'
                  : 'bg-slate-700'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Projects panel */}
      {showProjects && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowProjects(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-96 max-h-[70vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Mine prosjekter</h2>
              <button onClick={() => setShowProjects(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {projects.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-8">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  Ingen lagrede prosjekter ennå
                </div>
              ) : (
                projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleLoadProject(p.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <div className="text-xs font-medium text-white">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.savedAt}</div>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-700">
              <button
                onClick={handleSave}
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors font-medium"
              >
                + Lagre gjeldende prosjekt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="h-12 flex items-center gap-3 px-4 bg-slate-950 border-b border-slate-800 shrink-0">
        {/* Back */}
        <button
          onClick={() => setShowProjects(true)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors"
          title="Mine prosjekter"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tilbake
        </button>

        <div className="w-px h-4 bg-slate-700" />

        {/* Title */}
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">AI Agenten VideoStudio</span>
          <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">BETA</span>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
            title="Nullstill prosjekt"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Nullstill
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
            title="Eksporter prosjekt"
          >
            <Download className="w-3.5 h-3.5" />
            Eksporter
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            Lagre
          </button>

          {/* ⋮ menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Flere valg"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={() => { setShowProjects(true); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                  Mine prosjekter
                </button>
                <button
                  onClick={() => { handleExport(); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  Eksporter som JSON
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => {
                    showToast('Hurtigtaster: Del/Backspace = slett klipp, Ctrl+Scroll = zoom', 'info')
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                  Tastaturhurtigtaster
                </button>
                <button
                  onClick={() => {
                    showToast('Innstillinger kommer snart', 'info')
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  Innstillinger
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => { handleReset(); setMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Nullstill prosjekt
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <EditorLayout
          editorState={state}
          onSeek={setCurrentFrame}
          onMoveItem={moveTrackItem}
          onResizeItem={resizeTrackItem}
          onAddTrackItem={handleAddTrackItem}
          onRemoveItem={removeTrackItem}
          onApplyOps={applyOps}
          onFrameChange={setCurrentFrame}
        />
      </main>
    </div>
  )
}
