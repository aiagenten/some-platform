'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Maximize2, Clock } from 'lucide-react'
import type { EditorState, SelectedRange } from '@/lib/editor-state'
import { formatSeconds } from '@/lib/editor-state'
import { Player, type PlayerRef } from '@remotion/player'
import { EditorComposition } from '@/remotion/EditorComposition'

type Props = {
  editorState: EditorState
  onFrameChange: (frame: number) => void
  selectedRange: SelectedRange
  onSelectRange: (range: SelectedRange) => void
}

export function VideoPreview({ editorState, onFrameChange, selectedRange, onSelectRange }: Props) {
  const playerRef = useRef<PlayerRef>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSelectingRange, setIsSelectingRange] = useState(false)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const { fps, totalDurationInFrames, currentFrame, tracks } = editorState

  // Compute a stable key for the player based on track item count and total duration
  // This forces re-mount when items are added/removed
  const playerKey = tracks.reduce((acc, t) => acc + t.items.length, 0) + '-' + totalDurationInFrames

  // Subscribe to frame updates from the player
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const onFrameUpdate = (data: { detail: { frame: number } }) => {
      onFrameChange(data.detail.frame)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    player.addEventListener('frameupdate', onFrameUpdate)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onEnded)

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate)
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onEnded)
    }
  }, [onFrameChange])

  const totalSeconds = totalDurationInFrames / fps
  const currentSeconds = currentFrame / fps

  const handlePlay = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.play()
      setIsPlaying(true)
    }
  }, [])

  const handlePause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleSkipBack = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.seekTo(0)
      onFrameChange(0)
    }
  }, [onFrameChange])

  const handleSkipForward = useCallback(() => {
    if (playerRef.current) {
      const last = totalDurationInFrames - 1
      playerRef.current.seekTo(last)
      onFrameChange(last)
    }
  }, [totalDurationInFrames, onFrameChange])

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      const frame = Math.round(ratio * totalDurationInFrames)

      if (isSelectingRange) {
        if (rangeStart === null) {
          setRangeStart(frame)
        } else {
          const start = Math.min(rangeStart, frame)
          const end = Math.max(rangeStart, frame)
          onSelectRange({ startFrame: start, endFrame: end })
          setRangeStart(null)
          setIsSelectingRange(false)
        }
      } else {
        if (playerRef.current) {
          playerRef.current.seekTo(frame)
          onFrameChange(frame)
        }
      }
    },
    [totalDurationInFrames, isSelectingRange, rangeStart, onSelectRange, onFrameChange],
  )

  const toggleRangeSelect = useCallback(() => {
    setIsSelectingRange(s => !s)
    setRangeStart(null)
    if (isSelectingRange) onSelectRange(null)
  }, [isSelectingRange, onSelectRange])

  const clearRange = useCallback(() => {
    onSelectRange(null)
    setRangeStart(null)
    setIsSelectingRange(false)
  }, [onSelectRange])

  // Progress percentage
  const progress = totalDurationInFrames > 0 ? (currentFrame / totalDurationInFrames) * 100 : 0

  // Range overlay
  const rangeStartPct = selectedRange
    ? (selectedRange.startFrame / totalDurationInFrames) * 100
    : null
  const rangeWidthPct = selectedRange
    ? ((selectedRange.endFrame - selectedRange.startFrame) / totalDurationInFrames) * 100
    : null

  return (
    <div className="flex flex-col h-full bg-slate-900 select-none">
      {/* Player area */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
        <div
          className="w-full h-full"
          style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%', margin: 'auto' }}
        >
          <Player
            key={playerKey}
            ref={playerRef}
            component={EditorComposition}
            inputProps={{ editorState }}
            durationInFrames={Math.max(totalDurationInFrames, 1)}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={fps}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            loop={false}
          />
        </div>

        {/* Range select overlay hint */}
        {isSelectingRange && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-indigo-600/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur">
            {rangeStart === null ? 'Click to set range START' : 'Click to set range END'}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-2 border-t border-slate-700/60">
        {/* Progress bar */}
        <div
          className={`relative h-2 bg-slate-700 rounded-full cursor-pointer group ${isSelectingRange ? 'cursor-crosshair' : ''}`}
          onClick={handleTimelineClick}
        >
          {/* Playhead */}
          <div
            className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
          {/* Range highlight */}
          {rangeStartPct !== null && rangeWidthPct !== null && (
            <div
              className="absolute inset-y-0 bg-amber-400/40 border-l-2 border-r-2 border-amber-400 rounded"
              style={{ left: `${rangeStartPct}%`, width: `${rangeWidthPct}%` }}
            />
          )}
          {/* Hover dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          {/* Transport */}
          <button
            onClick={handleSkipBack}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Jump to start"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSkipForward}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Jump to end"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Timecode */}
          <span className="text-xs text-slate-400 ml-1 font-mono tabular-nums">
            {formatSeconds(currentSeconds)} / {formatSeconds(totalSeconds)}
          </span>

          <div className="flex-1" />

          {/* Range selector */}
          <button
            onClick={toggleRangeSelect}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              isSelectingRange
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
            title="Select time range for AI prompt"
          >
            <Clock className="w-3.5 h-3.5" />
            {selectedRange
              ? `${formatSeconds(selectedRange.startFrame / fps)} – ${formatSeconds(selectedRange.endFrame / fps)}`
              : 'Select range'}
          </button>

          {selectedRange && (
            <button
              onClick={clearRange}
              className="text-xs text-slate-500 hover:text-slate-300 px-1"
              title="Clear range"
            >
              ✕
            </button>
          )}

          <button
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
