'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { ZoomIn, ZoomOut } from 'lucide-react'
import type { EditorState, TrackItem } from '@/lib/editor-state'
import { formatSeconds } from '@/lib/editor-state'
import { TimelineTrack } from './TimelineTrack'

type Props = {
  editorState: EditorState
  onMoveItem: (trackId: string, itemId: string, newFrom: number) => void
  onResizeItem: (trackId: string, itemId: string, newDuration: number) => void
  onSeek: (frame: number) => void
  onRemoveItem: (trackId: string, itemId: string) => void
  onDoubleClickItem?: (item: TrackItem, trackId: string) => void
}

const MIN_PX_PER_FRAME = 0.05
const MAX_PX_PER_FRAME = 4
const DEFAULT_PX_PER_FRAME = 0.2

export function Timeline({ editorState, onMoveItem, onResizeItem, onSeek, onRemoveItem, onDoubleClickItem }: Props) {
  const [pxPerFrame, setPxPerFrame] = useState(DEFAULT_PX_PER_FRAME)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { tracks, fps, totalDurationInFrames, currentFrame } = editorState

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Delete key handler for selected items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItemId) return
      // Don't trigger if user is typing
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const track = tracks.find(t => t.items.some(i => i.id === selectedItemId))
        if (track) {
          onRemoveItem(track.id, selectedItemId)
          setSelectedItemId(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItemId, tracks, onRemoveItem])

  // Zoom
  const zoomIn = useCallback(() => {
    setPxPerFrame(p => Math.min(p * 1.5, MAX_PX_PER_FRAME))
  }, [])
  const zoomOut = useCallback(() => {
    setPxPerFrame(p => Math.max(p / 1.5, MIN_PX_PER_FRAME))
  }, [])

  // Wheel to zoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) setPxPerFrame(p => Math.min(p * 1.1, MAX_PX_PER_FRAME))
        else setPxPerFrame(p => Math.max(p / 1.1, MIN_PX_PER_FRAME))
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // DnD
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null)
      const { active, over, delta } = event
      if (!over) return

      const data = active.data.current as { trackId: string; itemId: string; from: number }
      const targetTrackId = (over.data.current as { trackId: string })?.trackId

      if (!data || !targetTrackId) return

      const dx = delta.x
      const dFrames = Math.round(dx / pxPerFrame)
      const newFrom = Math.max(0, data.from + dFrames)

      onMoveItem(data.trackId, data.itemId, newFrom)
    },
    [pxPerFrame, onMoveItem],
  )

  // Playhead drag
  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingPlayhead(true)

      const onMouseMove = (ev: MouseEvent) => {
        const scrollEl = scrollRef.current
        if (!scrollEl) return
        const rect = scrollEl.getBoundingClientRect()
        // 56 = track label width
        const x = ev.clientX - rect.left - 56 + scrollEl.scrollLeft
        const frame = Math.max(0, Math.min(Math.round(x / pxPerFrame), totalDurationInFrames - 1))
        onSeek(frame)
      }

      const onMouseUp = () => {
        setIsDraggingPlayhead(false)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [pxPerFrame, totalDurationInFrames, onSeek],
  )

  // Ruler tick interval
  const tickInterval = (() => {
    const secondsPerTick = [0.5, 1, 2, 5, 10, 30, 60].find(s => s * fps * pxPerFrame >= 50) || 60
    return secondsPerTick * fps
  })()

  const ticks: number[] = []
  for (let f = 0; f <= totalDurationInFrames; f += tickInterval) {
    ticks.push(f)
  }

  const playheadLeft = currentFrame * pxPerFrame
  const currentTimeSec = currentFrame / fps

  return (
    <div className="flex flex-col h-full bg-slate-900 border-t border-slate-700 select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700 bg-slate-800/60">
        <span className="text-xs text-slate-400 font-medium mr-2">Timeline</span>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Zoom ut (Ctrl+Scroll)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="text-xs text-slate-500 w-10 text-center">
            {Math.round(pxPerFrame * fps * 10) / 10}px/s
          </div>
          <button
            onClick={zoomIn}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Zoom inn"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1" />
        {selectedItemId && (
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
            Del/Backspace for å slette
          </span>
        )}
        <span className="text-xs text-slate-500">
          {tracks.reduce((n, t) => n + t.items.length, 0)} klipp
        </span>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ minWidth: totalDurationInFrames * pxPerFrame + 200 }}>
          {/* Ruler */}
          <div className="flex h-7 bg-slate-800/80 border-b border-slate-700 sticky top-0 z-20">
            {/* Track label spacer */}
            <div className="w-14 shrink-0 border-r border-slate-700" />
            {/* Ticks */}
            <div className="relative flex-1 overflow-hidden">
              {ticks.map(frame => (
                <div
                  key={frame}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: frame * pxPerFrame }}
                >
                  <div className="w-px h-2 bg-slate-600 mt-1" />
                  <span className="text-[9px] text-slate-500 mt-0.5 whitespace-nowrap">
                    {formatSeconds(frame / fps)}
                  </span>
                </div>
              ))}

              {/* Playhead on ruler — draggable handle */}
              <div
                className="absolute top-0 bottom-0 z-30"
                style={{ left: playheadLeft }}
              >
                {/* Time indicator */}
                <div
                  className="absolute -top-0 text-[9px] text-red-400 bg-slate-900/90 px-1 rounded whitespace-nowrap pointer-events-none"
                  style={{ left: 4, top: 1 }}
                >
                  {formatSeconds(currentTimeSec)}
                </div>
                {/* Draggable triangle handle */}
                <div
                  className={`absolute -top-0.5 -ml-2.5 w-5 h-4 flex items-start justify-center cursor-ew-resize z-40 ${
                    isDraggingPlayhead ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                  }`}
                  onMouseDown={handlePlayheadMouseDown}
                  style={{ top: 0 }}
                >
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                    <polygon points="0,0 10,0 5,10" fill="#ef4444" />
                  </svg>
                </div>
                {/* Vertical line in ruler */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 -ml-px pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Tracks */}
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="relative">
              {/* Full-height playhead line across all tracks */}
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: 56 + playheadLeft }}
              >
                <div className="absolute inset-0 w-0.5 bg-red-500 opacity-80" />
              </div>

              {/* Clickable area for seeking */}
              <div
                className="absolute top-0 h-full cursor-crosshair"
                style={{ left: 56, right: 0 }}
                onClick={(e) => {
                  if (isDraggingPlayhead) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const frame = Math.round(x / pxPerFrame)
                  onSeek(frame)
                }}
              />

              {tracks.map(track => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  pxPerFrame={pxPerFrame}
                  totalFrames={totalDurationInFrames}
                  selectedItemId={selectedItemId}
                  onSelectItem={setSelectedItemId}
                  onResize={onResizeItem}
                  onDoubleClickItem={(item) => onDoubleClickItem?.(item, track.id)}
                  onTrackClick={(_, frame) => onSeek(frame)}
                />
              ))}
            </div>

            <DragOverlay>
              {draggingId ? (
                <div className="h-8 w-32 rounded bg-indigo-500/80 border border-indigo-400 flex items-center px-2 text-xs text-white shadow-xl">
                  Flytter klipp…
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}
