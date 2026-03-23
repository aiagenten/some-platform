'use client'

import { useCallback, useState } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import type { EditorState, TrackItem, DirectorOperation, SelectedRange } from '@/lib/editor-state'
import { VideoPreview } from './VideoPreview'
import { Timeline } from './Timeline'
import { AssetPanel } from './AssetPanel'
import type { Asset } from './AssetPanel'
import { AiChat } from './AiChat'

type Props = {
  editorState: EditorState
  onSeek: (frame: number) => void
  onMoveItem: (trackId: string, itemId: string, newFrom: number) => void
  onResizeItem: (trackId: string, itemId: string, newDuration: number) => void
  onAddTrackItem: (trackId: string, item: Omit<TrackItem, 'id'>) => void
  onRemoveItem: (trackId: string, itemId: string) => void
  onApplyOps: (ops: DirectorOperation[]) => void
  onFrameChange: (frame: number) => void
}

export function EditorLayout({
  editorState,
  onSeek,
  onMoveItem,
  onResizeItem,
  onAddTrackItem,
  onRemoveItem,
  onApplyOps,
  onFrameChange,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedRange, setSelectedRange] = useState<SelectedRange>(null)

  const handleAddAsset = useCallback((asset: Asset) => {
    setAssets(prev => [...prev, asset])
  }, [])

  const handleRemoveAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id))
  }, [])

  // Compute the end frame of items on a given track
  const getTrackEnd = useCallback(
    (trackId: string): number => {
      const track = editorState.tracks.find(t => t.id === trackId)
      if (!track || track.items.length === 0) return 0
      return track.items.reduce((max, i) => Math.max(max, i.from + i.durationInFrames), 0)
    },
    [editorState.tracks],
  )

  const handleDropToTimeline = useCallback(
    (asset: Asset, trackId: string) => {
      const durationInFrames = asset.durationSeconds
        ? Math.round(asset.durationSeconds * editorState.fps)
        : 90
      // Place sequentially after existing items
      const from = getTrackEnd(trackId)
      onAddTrackItem(trackId, {
        type: asset.type === 'image' ? 'image' : asset.type,
        from,
        durationInFrames,
        src: asset.url,
        label: asset.name,
      })
    },
    [editorState.fps, onAddTrackItem, getTrackEnd],
  )

  const handleAddToTimeline = useCallback(
    (trackId: string, item: Omit<TrackItem, 'id'>) => {
      // Auto-place after existing items (unless the caller already set from)
      const from = item.from === 0 ? getTrackEnd(trackId) : item.from
      onAddTrackItem(trackId, { ...item, from })
    },
    [onAddTrackItem, getTrackEnd],
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top 3-panel layout */}
      <div className="flex-1 overflow-hidden min-h-0">
        <Group orientation="horizontal" className="h-full">
          {/* Assets panel */}
          <Panel defaultSize="18%" style={{ minWidth: 160 }}>
            <AssetPanel
              assets={assets}
              onAddAsset={handleAddAsset}
              onRemoveAsset={handleRemoveAsset}
              onDropToTimeline={handleDropToTimeline}
              onAddToTimeline={handleAddToTimeline}
              fps={editorState.fps}
            />
          </Panel>

          <Separator className="w-1 bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize" />

          {/* Video preview */}
          <Panel defaultSize="54%" style={{ minWidth: 300 }}>
            <VideoPreview
              editorState={editorState}
              onFrameChange={onFrameChange}
              selectedRange={selectedRange}
              onSelectRange={setSelectedRange}
            />
          </Panel>

          <Separator className="w-1 bg-slate-700 hover:bg-indigo-500 transition-colors cursor-col-resize" />

          {/* AI Chat */}
          <Panel defaultSize="28%" style={{ minWidth: 220 }}>
            <AiChat
              editorState={editorState}
              selectedRange={selectedRange}
              onApplyOps={onApplyOps}
            />
          </Panel>
        </Group>
      </div>

      {/* Timeline at bottom */}
      <div className="h-52 shrink-0 border-t border-slate-700">
        <Timeline
          editorState={editorState}
          onMoveItem={onMoveItem}
          onResizeItem={onResizeItem}
          onSeek={onSeek}
          onRemoveItem={onRemoveItem}
        />
      </div>
    </div>
  )
}
