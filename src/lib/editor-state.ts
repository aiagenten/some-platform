// ── Video Editor V2 — Data Model & State Types ────────────────────────────────

import type { VideoOverlayConfig } from './video-overlay-templates'

export type TrackType = 'video' | 'overlay' | 'caption' | 'audio'

export type TrackItemType =
  | 'video'
  | 'animation'
  | 'caption'
  | 'audio'
  | 'image'
  | 'overlay'

export type CaptionStyle = 'sentences' | 'karaoke' | 'big-word'

export type WordEntry = {
  word: string
  start: number // seconds
  end: number
}

export type TrackItem = {
  id: string
  type: TrackItemType
  from: number // frame start
  durationInFrames: number
  // Media
  src?: string // URL to video/audio/image
  // Caption specific
  text?: string
  words?: WordEntry[]
  captionStyle?: CaptionStyle
  captionPosition?: 'bottom' | 'center' | 'top'
  captionColor?: string
  captionBgColor?: string
  // Animation / overlay specific
  overlayType?: 'logo-watermark' | 'lower-third' | 'full-branded'
  remotionConfig?: Record<string, unknown>
  // Audio specific
  volume?: number
  // Label for timeline display
  label?: string
  // trim for video items (seconds into the source)
  trimStart?: number
}

export type Track = {
  id: string
  name: string // V1, V2, T1, A1, A2
  type: TrackType
  items: TrackItem[]
  color?: string
}

export type EditorState = {
  tracks: Track[]
  fps: number
  totalDurationInFrames: number
  brand: VideoOverlayConfig
  currentFrame: number
}

export type SelectedRange = {
  startFrame: number
  endFrame: number
} | null

// ── Default state ──────────────────────────────────────────────────────────────

export const DEFAULT_FPS = 30

export const DEFAULT_BRAND: VideoOverlayConfig = {
  logoUrl: null,
  brandName: 'My Brand',
  tagline: '',
  primaryColor: '#6366f1',
  accentColor: '#8b5cf6',
  headingFont: 'Inter',
  bodyFont: 'Inter',
}

export function createDefaultEditorState(): EditorState {
  return {
    fps: DEFAULT_FPS,
    totalDurationInFrames: 900, // 30 sec default
    currentFrame: 0,
    brand: { ...DEFAULT_BRAND },
    tracks: [
      { id: 'v1', name: 'V1', type: 'video', items: [], color: '#6366f1' },
      { id: 'v2', name: 'V2', type: 'overlay', items: [], color: '#8b5cf6' },
      { id: 't1', name: 'T1', type: 'caption', items: [], color: '#06b6d4' },
      { id: 'a1', name: 'A1', type: 'audio', items: [], color: '#10b981' },
      { id: 'a2', name: 'A2', type: 'audio', items: [], color: '#f59e0b' },
    ],
  }
}

// ── Operations from AI Director ────────────────────────────────────────────────

export type DirectorOperation =
  | { type: 'add-track-item'; track: string; item: TrackItem }
  | { type: 'remove-track-item'; trackId: string; itemId: string }
  | { type: 'update-item'; trackId: string; itemId: string; changes: Partial<TrackItem> }
  | { type: 'add-captions'; trackId: string; items: TrackItem[] }
  | { type: 'remove-segments'; segments: { startFrame: number; endFrame: number }[] }
  | { type: 'set-total-duration'; durationInFrames: number }
  | { type: 'clear-track'; trackId: string }

// ── State helpers ─────────────────────────────────────────────────────────────

export function applyOperations(
  state: EditorState,
  ops: DirectorOperation[],
): EditorState {
  let next = { ...state, tracks: state.tracks.map(t => ({ ...t, items: [...t.items] })) }

  for (const op of ops) {
    switch (op.type) {
      case 'add-track-item': {
        const track = next.tracks.find(t => t.id === op.track || t.name === op.track)
        if (track) track.items = [...track.items, op.item]
        break
      }
      case 'remove-track-item': {
        const track = next.tracks.find(t => t.id === op.trackId)
        if (track) track.items = track.items.filter(i => i.id !== op.itemId)
        break
      }
      case 'update-item': {
        const track = next.tracks.find(t => t.id === op.trackId)
        if (track) {
          track.items = track.items.map(i =>
            i.id === op.itemId ? { ...i, ...op.changes } : i,
          )
        }
        break
      }
      case 'add-captions': {
        const track = next.tracks.find(t => t.id === op.trackId || t.name === op.trackId)
        if (track) track.items = [...track.items, ...op.items]
        break
      }
      case 'clear-track': {
        const track = next.tracks.find(t => t.id === op.trackId || t.name === op.trackId)
        if (track) track.items = []
        break
      }
      case 'set-total-duration': {
        next = { ...next, totalDurationInFrames: op.durationInFrames }
        break
      }
    }
  }

  return next
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps)
}

export function formatTimecode(frames: number, fps: number): string {
  const totalSeconds = frames / fps
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const f = frames % fps
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
}

export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
