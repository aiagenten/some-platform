'use client'

import { useCallback, useReducer } from 'react'
import {
  type EditorState,
  type TrackItem,
  type DirectorOperation,
  createDefaultEditorState,
  applyOperations,
  uid,
} from '@/lib/editor-state'

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CURRENT_FRAME'; frame: number }
  | { type: 'SET_TOTAL_DURATION'; durationInFrames: number }
  | { type: 'ADD_TRACK_ITEM'; trackId: string; item: TrackItem }
  | { type: 'UPDATE_TRACK_ITEM'; trackId: string; itemId: string; changes: Partial<TrackItem> }
  | { type: 'REMOVE_TRACK_ITEM'; trackId: string; itemId: string }
  | { type: 'MOVE_TRACK_ITEM'; trackId: string; itemId: string; from: number }
  | { type: 'RESIZE_TRACK_ITEM'; trackId: string; itemId: string; durationInFrames: number }
  | { type: 'APPLY_OPERATIONS'; ops: DirectorOperation[] }
  | { type: 'RESET' }
  | { type: 'LOAD_STATE'; state: EditorState }
  | { type: 'UPDATE_BRAND'; brand: Partial<EditorState['brand']> }

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_CURRENT_FRAME':
      return { ...state, currentFrame: action.frame }

    case 'SET_TOTAL_DURATION':
      return { ...state, totalDurationInFrames: action.durationInFrames }

    case 'ADD_TRACK_ITEM': {
      const tracks = state.tracks.map(t =>
        t.id === action.trackId
          ? { ...t, items: [...t.items, action.item] }
          : t,
      )
      return { ...state, tracks }
    }

    case 'UPDATE_TRACK_ITEM': {
      const tracks = state.tracks.map(t =>
        t.id === action.trackId
          ? {
              ...t,
              items: t.items.map(i =>
                i.id === action.itemId ? { ...i, ...action.changes } : i,
              ),
            }
          : t,
      )
      return { ...state, tracks }
    }

    case 'REMOVE_TRACK_ITEM': {
      const tracks = state.tracks.map(t =>
        t.id === action.trackId
          ? { ...t, items: t.items.filter(i => i.id !== action.itemId) }
          : t,
      )
      return { ...state, tracks }
    }

    case 'MOVE_TRACK_ITEM': {
      const tracks = state.tracks.map(t =>
        t.id === action.trackId
          ? {
              ...t,
              items: t.items.map(i =>
                i.id === action.itemId ? { ...i, from: Math.max(0, action.from) } : i,
              ),
            }
          : t,
      )
      return { ...state, tracks }
    }

    case 'RESIZE_TRACK_ITEM': {
      const tracks = state.tracks.map(t =>
        t.id === action.trackId
          ? {
              ...t,
              items: t.items.map(i =>
                i.id === action.itemId
                  ? { ...i, durationInFrames: Math.max(action.durationInFrames, state.fps) }
                  : i,
              ),
            }
          : t,
      )
      return { ...state, tracks }
    }

    case 'APPLY_OPERATIONS':
      return applyOperations(state, action.ops)

    case 'RESET':
      return createDefaultEditorState()

    case 'LOAD_STATE':
      return action.state

    case 'UPDATE_BRAND':
      return { ...state, brand: { ...state.brand, ...action.brand } }

    default:
      return state
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEditorState() {
  const [state, dispatch] = useReducer(reducer, undefined, createDefaultEditorState)

  const setCurrentFrame = useCallback((frame: number) => {
    dispatch({ type: 'SET_CURRENT_FRAME', frame })
  }, [])

  const setTotalDuration = useCallback((durationInFrames: number) => {
    dispatch({ type: 'SET_TOTAL_DURATION', durationInFrames })
  }, [])

  const addTrackItem = useCallback((trackId: string, item: Omit<TrackItem, 'id'> & { id?: string }) => {
    const itemWithId: TrackItem = { ...item, id: item.id || uid() } as TrackItem
    dispatch({ type: 'ADD_TRACK_ITEM', trackId, item: itemWithId })
    return itemWithId.id
  }, [])

  const updateTrackItem = useCallback((trackId: string, itemId: string, changes: Partial<TrackItem>) => {
    dispatch({ type: 'UPDATE_TRACK_ITEM', trackId, itemId, changes })
  }, [])

  const removeTrackItem = useCallback((trackId: string, itemId: string) => {
    dispatch({ type: 'REMOVE_TRACK_ITEM', trackId, itemId })
  }, [])

  const moveTrackItem = useCallback((trackId: string, itemId: string, from: number) => {
    dispatch({ type: 'MOVE_TRACK_ITEM', trackId, itemId, from })
  }, [])

  const resizeTrackItem = useCallback((trackId: string, itemId: string, durationInFrames: number) => {
    dispatch({ type: 'RESIZE_TRACK_ITEM', trackId, itemId, durationInFrames })
  }, [])

  const applyOps = useCallback((ops: DirectorOperation[]) => {
    dispatch({ type: 'APPLY_OPERATIONS', ops })
  }, [])

  const loadState = useCallback((s: EditorState) => {
    dispatch({ type: 'LOAD_STATE', state: s })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const updateBrand = useCallback((brand: Partial<EditorState['brand']>) => {
    dispatch({ type: 'UPDATE_BRAND', brand })
  }, [])

  // Compute max track end for display
  const maxTrackEnd = state.tracks.reduce((max, track) => {
    const trackEnd = track.items.reduce((m, item) => Math.max(m, item.from + item.durationInFrames), 0)
    return Math.max(max, trackEnd)
  }, state.totalDurationInFrames)

  return {
    state,
    maxTrackEnd,
    setCurrentFrame,
    setTotalDuration,
    addTrackItem,
    updateTrackItem,
    removeTrackItem,
    moveTrackItem,
    resizeTrackItem,
    applyOps,
    loadState,
    reset,
    updateBrand,
  }
}

export type UseEditorStateReturn = ReturnType<typeof useEditorState>
