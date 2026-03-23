'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Track, TrackItem } from '@/lib/editor-state'
import { TimelineItemComp } from './TimelineItem'

type Props = {
  track: Track
  pxPerFrame: number
  totalFrames: number
  selectedItemId: string | null
  onSelectItem: (id: string) => void
  onResize: (trackId: string, itemId: string, frames: number) => void
  onDoubleClickItem?: (item: TrackItem) => void
  onTrackClick?: (trackId: string, frame: number) => void
}

const TRACK_COLORS: Record<string, string> = {
  v1: '#6366f1',
  v2: '#8b5cf6',
  t1: '#06b6d4',
  a1: '#10b981',
  a2: '#f59e0b',
}

const TRACK_TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  overlay: 'Overlay',
  caption: 'Caption',
  audio: 'Audio',
}

export function TimelineTrack({
  track,
  pxPerFrame,
  totalFrames,
  selectedItemId,
  onSelectItem,
  onResize,
  onDoubleClickItem,
  onTrackClick,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `track-drop-${track.id}`,
    data: { trackId: track.id },
  })

  const color = TRACK_COLORS[track.id] || track.color || '#6366f1'
  const typeLabel = TRACK_TYPE_LABELS[track.type] || track.type

  const trackWidth = totalFrames * pxPerFrame

  return (
    <div className="flex h-9 shrink-0">
      {/* Track label */}
      <div
        className="w-14 shrink-0 flex flex-col items-center justify-center border-r border-slate-700 bg-slate-800/80"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <span className="text-[11px] font-bold text-slate-200">{track.name}</span>
        <span className="text-[9px] text-slate-500 uppercase tracking-wide">{typeLabel}</span>
      </div>

      {/* Items area */}
      <div
        ref={setNodeRef}
        className={`relative flex-1 h-full border-b border-slate-700/50 transition-colors ${
          isOver ? 'bg-indigo-950/40' : 'bg-slate-800/30'
        }`}
        style={{ width: trackWidth, minWidth: '100%' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const frame = Math.round(x / pxPerFrame)
          onTrackClick?.(track.id, frame)
        }}
      >
        {track.items.map(item => (
          <TimelineItemComp
            key={item.id}
            item={item}
            trackId={track.id}
            pxPerFrame={pxPerFrame}
            trackColor={color}
            isSelected={selectedItemId === item.id}
            onSelect={onSelectItem}
            onResize={onResize}
            onDoubleClick={onDoubleClickItem}
          />
        ))}
      </div>
    </div>
  )
}
