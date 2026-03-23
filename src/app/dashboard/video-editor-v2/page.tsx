'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Film, Save, Settings2, RotateCcw, Download } from 'lucide-react'
import { useEditorState } from '@/hooks/useEditorState'
import { EditorLayout } from '@/components/video-editor/EditorLayout'
import type { TrackItem } from '@/lib/editor-state'

export default function VideoEditorV2Page() {
  const {
    state,
    setCurrentFrame,
    addTrackItem,
    moveTrackItem,
    resizeTrackItem,
    applyOps,
  } = useEditorState()

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    // TODO: save to supabase
    await new Promise(r => setTimeout(r, 600))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  const handleAddTrackItem = useCallback(
    (trackId: string, item: Omit<TrackItem, 'id'>) => {
      addTrackItem(trackId, item)
    },
    [addTrackItem],
  )

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900 z-50">
      {/* Top bar */}
      <header className="h-12 flex items-center gap-3 px-4 bg-slate-950 border-b border-slate-800 shrink-0">
        {/* Back */}
        <Link
          href="/dashboard/video"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>

        <div className="w-px h-4 bg-slate-700" />

        {/* Title */}
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Video Studio</span>
          <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">BETA</span>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              saveStatus === 'saved'
                ? 'bg-green-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
          </button>

          <button
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
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
          onApplyOps={applyOps}
          onFrameChange={setCurrentFrame}
        />
      </main>
    </div>
  )
}
