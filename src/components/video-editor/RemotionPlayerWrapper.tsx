'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { EditorComposition } from '@/remotion/EditorComposition'
import type { EditorState } from '@/lib/editor-state'

type Props = {
  editorState: EditorState
  onFrameChange: (frame: number) => void
  onPlayingChange: (playing: boolean) => void
}

export function RemotionPlayerWrapper({ editorState, onFrameChange, onPlayingChange }: Props) {
  const playerRef = useRef<PlayerRef>(null)
  const [mounted, setMounted] = useState(false)
  const { fps, totalDurationInFrames, tracks } = editorState

  // Compute a stable key for the player based on track item count
  const playerKey = tracks.reduce((acc, t) => acc + t.items.length, 0) + '-' + totalDurationInFrames

  // Only render after mount (client-side)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to frame updates from the player
  useEffect(() => {
    if (!mounted) return
    const player = playerRef.current
    if (!player) return

    const onFrameUpdate = () => {
      // Use getCurrentFrame() instead of event detail for more reliable frame tracking
      const frame = player.getCurrentFrame()
      onFrameChange(frame)
    }
    const onPlay = () => onPlayingChange(true)
    const onPause = () => onPlayingChange(false)
    const onEnded = () => onPlayingChange(false)

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
  }, [mounted, onFrameChange, onPlayingChange])

  const play = useCallback(() => {
    playerRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pause()
  }, [])

  const seekTo = useCallback((frame: number) => {
    playerRef.current?.seekTo(frame)
  }, [])

  // Expose methods via data attributes for parent to access
  useEffect(() => {
    const container = document.getElementById('remotion-player-container')
    if (container) {
      (container as HTMLDivElement & { play: () => void; pause: () => void; seekTo: (f: number) => void }).play = play;
      (container as HTMLDivElement & { play: () => void; pause: () => void; seekTo: (f: number) => void }).pause = pause;
      (container as HTMLDivElement & { play: () => void; pause: () => void; seekTo: (f: number) => void }).seekTo = seekTo
    }
  }, [play, pause, seekTo])

  if (!mounted) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-slate-400 text-sm">Laster spiller…</div>
      </div>
    )
  }

  return (
    <div id="remotion-player-container" className="w-full h-full">
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
  )
}
