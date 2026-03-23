'use client'

import { useRef, useState, useCallback } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TrackItem } from '@/lib/editor-state'

type Props = {
  item: TrackItem
  trackId: string
  pxPerFrame: number
  trackColor: string
  isSelected: boolean
  onSelect: (itemId: string) => void
  onResize: (trackId: string, itemId: string, newDuration: number) => void
  onDoubleClick?: (item: TrackItem) => void
}

export function TimelineItemComp({
  item,
  trackId,
  pxPerFrame,
  trackColor,
  isSelected,
  onSelect,
  onResize,
  onDoubleClick,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${trackId}::${item.id}`,
    data: { trackId, itemId: item.id, from: item.from, duration: item.durationInFrames },
  })

  const isResizing = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartDuration = useRef(0)
  const [resizing, setResizing] = useState(false)

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      isResizing.current = true
      resizeStartX.current = e.clientX
      resizeStartDuration.current = item.durationInFrames
      setResizing(true)

      const onMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current) return
        const dx = ev.clientX - resizeStartX.current
        const dFrames = Math.round(dx / pxPerFrame)
        const newDuration = Math.max(30, resizeStartDuration.current + dFrames)
        onResize(trackId, item.id, newDuration)
      }

      const onMouseUp = () => {
        isResizing.current = false
        setResizing(false)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [item.durationInFrames, item.id, pxPerFrame, trackId, onResize],
  )

  const left = item.from * pxPerFrame
  const width = Math.max(item.durationInFrames * pxPerFrame, 24)

  const style: React.CSSProperties = {
    position: 'absolute',
    left,
    width,
    transform: isDragging ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : isSelected ? 10 : 1,
    transition: resizing ? 'none' : 'box-shadow 0.1s',
  }

  const label = item.label || item.text || item.type

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute top-0.5 bottom-0.5 rounded cursor-grab select-none flex items-center group ${
        isSelected ? 'ring-2 ring-white/80' : ''
      }`}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item.id)
      }}
      onDoubleClick={() => onDoubleClick?.(item)}
    >
      {/* Fill */}
      <div
        className="absolute inset-0 rounded"
        style={{
          background: `${trackColor}cc`,
          border: `1px solid ${trackColor}`,
        }}
      />

      {/* Label */}
      <span
        className="relative z-10 px-2 text-[10px] font-medium text-white/90 truncate pointer-events-none"
        style={{ maxWidth: width - 16 }}
      >
        {label}
      </span>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-r flex items-center justify-center"
        style={{ background: `${trackColor}` }}
        onMouseDown={handleResizeMouseDown}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-0.5 h-3 bg-white/60 rounded-full" />
      </div>
    </div>
  )
}
