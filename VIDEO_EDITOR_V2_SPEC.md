# Video Editor V2 — HyperEdit-inspired for SoMe Platform

## Arkitektur (basert på transkript-analyse)

### Kjernekomponenter
1. **Remotion** — Video-animasjoner via React-kode (allerede installert ✅)
2. **FFmpeg** — Video-prosessering: trim, cut, transcode, speed, watermark (Railway ✅)  
3. **Whisper** — Transkribering med word-level timestamps (Railway ✅)
4. **AI Generering** — Bilde→video, musikk-generering (fal.ai ✅)

### 3 AI Agenter (som i HyperEdit)
1. **Director** — Redigerings-logikk: fjern dead air, legg til captions, lag animasjoner basert på transkripsjon, trim, klippe
2. **Picasso** — Statiske visuals: generer bilder, bakgrunner, thumbnails (bruker fal.ai / nano-banana)
3. **DiCaprio** — Video-generering: bilde→video, video→video, bakgrunnsfjerner (bruker fal.ai endpoints)

### UI Layout (som screenshot)
```
┌──────────────────────────────────────────────────────────────┐
│  [Assets Panel]  │  [Video Preview - Remotion Player]  │ [AI Chat] │
│                  │                                      │ Director  │
│  📁 Videos       │   ┌────────────────────────┐        │ Picasso   │
│  📁 Images       │   │                        │        │ DiCaprio  │
│  📁 Audio        │   │    Live Preview         │        │           │
│  📁 Animations   │   │    (Remotion Player)    │        │ [Prompt]  │
│                  │   │                        │        │ [Send]    │
│  [+ Add media]   │   └────────────────────────┘        │           │
│                  │                                      │ Quick:    │
│                  │                                      │ [Remove   │
│                  │                                      │  dead air]│
│                  │                                      │ [Add      │
│                  │                                      │  captions]│
├──────────────────┴──────────────────────────────────────┴───────────┤
│  Timeline                                                          │
│  V1: [═══video-clip═══════════════════════════════]                │
│  V2: [          ═══animation═══    ═══outro═══    ]                │
│  T1: [  ═cap═ ═cap═ ═cap═ ═cap═ ═cap═ ═cap═     ]                │
│  A1: [═══original-audio════════════════════════════]                │
│  A2: [═══background-music══════════════════════════]                │
│  [▶ Play] [⏸ Pause] ──────●────────── [00:00 / 01:50]            │
└────────────────────────────────────────────────────────────────────┘
```

### Data Model (state)
```ts
type EditorState = {
  // Tracks
  tracks: Track[]
  // Global
  fps: number // 30
  totalDurationInFrames: number
  // Brand
  brand: VideoOverlayConfig
  // Current playback
  currentFrame: number
}

type Track = {
  id: string
  name: string // V1, V2, T1, A1, A2
  type: 'video' | 'overlay' | 'caption' | 'audio'
  items: TrackItem[]
}

type TrackItem = {
  id: string
  type: 'video' | 'animation' | 'caption' | 'audio' | 'image' | 'overlay'
  from: number // frame start
  durationInFrames: number
  // Media
  src?: string // URL to video/audio/image
  // Caption specific
  text?: string
  words?: { word: string; start: number; end: number }[]
  captionStyle?: 'sentences' | 'karaoke' | 'big-word'
  // Animation specific (Remotion-generated)
  remotionConfig?: Record<string, unknown>
  // Audio specific
  volume?: number
}
```

### AI Director Flow
1. User sends prompt (e.g. "Remove dead air and silence")
2. API route sends prompt + current EditorState to Claude
3. Claude analyzes and returns updated EditorState (or specific operations)
4. Frontend applies changes → Remotion Player updates live

### Director Quick Actions (pre-built prompts)
- **Remove dead air** — Uses Whisper timestamps to find silence, removes via ffmpeg, updates timeline
- **Add captions** — Runs Whisper, creates T1 track items with word timestamps
- **Create animation** — Generates Remotion animation based on transcript context
- **Add B-roll** — Suggests relevant animations/images for selected time range
- **Add music** — Generates background music matching mood
- **Add logo watermark** — Adds brand logo overlay

### Time Selector
A tool in the preview that lets user select a time range (start-end) to use in prompts:
"Watch this part [0:05-0:15] and make an animation for it"

### Multi-Edit (Sub-timelines)
User can open a new timeline to edit a specific animation clip in isolation, then add it back to main timeline.

## API Routes Needed

### `/api/video/ai-director` (NEW)
POST: { prompt, editorState, selectedTimeRange?, agentType: 'director' | 'picasso' | 'dicaprio' }
Returns: { operations: Operation[], message: string }

Operations can be:
- `{ type: 'add-track-item', track: 'V2', item: TrackItem }`
- `{ type: 'remove-segments', segments: { start, end }[] }`
- `{ type: 'add-captions', segments: CaptionSegment[] }`
- `{ type: 'generate-animation', config: RemotionConfig }`
- `{ type: 'update-item', itemId, changes }`

### `/api/video/remove-silence` (NEW)
POST: { video_url }
Returns: { segments: { start, end, type: 'speech' | 'silence' }[], edited_url }
Uses Whisper + ffmpeg on Railway

## Files to Create

### Core Components
1. `src/app/dashboard/video-editor-v2/page.tsx` — Main editor page (replaces wizard)
2. `src/components/video-editor/EditorLayout.tsx` — 3-panel layout
3. `src/components/video-editor/Timeline.tsx` — Multi-track timeline
4. `src/components/video-editor/TimelineTrack.tsx` — Single track with draggable items
5. `src/components/video-editor/TimelineItem.tsx` — Draggable/resizable clip
6. `src/components/video-editor/AssetPanel.tsx` — Media library panel
7. `src/components/video-editor/AiChat.tsx` — AI Director/Picasso/DiCaprio chat
8. `src/components/video-editor/VideoPreview.tsx` — Remotion Player with time selector
9. `src/components/video-editor/QuickActions.tsx` — Pre-built action buttons

### Remotion Compositions
10. `src/remotion/EditorComposition.tsx` — Main composition that renders all tracks
11. `src/remotion/CaptionTrack.tsx` — Renders caption items on timeline

### API Routes
12. `src/app/api/video/ai-director/route.ts` — AI agent endpoint
13. `src/app/api/video/remove-silence/route.ts` — Silence removal

### State Management
14. `src/lib/editor-state.ts` — Types + state helpers
15. `src/hooks/useEditorState.ts` — React state hook for editor

## Existing Code to Reuse
- `src/remotion/overlays/*` — All overlay components
- `src/remotion/Outro.tsx` — Outro
- `src/remotion/subtitles/*` — All subtitle styles (just built!)
- `src/remotion/SubtitleVideoComposition.tsx` — Reference for composition
- `src/app/api/video/generate-music/` — Music generation
- `src/app/api/video/transcribe/` — Whisper proxy
- Railway whisper-api — ffmpeg + Whisper backend

## Design
Follow existing SoMe platform design system:
- Dark mode for editor (bg-slate-900, borders slate-700/800)
- Indigo/purple accent colors
- Lucide icons
- Resizable panels (already have @radix-ui/react-resizable? check package.json)
