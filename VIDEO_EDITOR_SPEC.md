# Video Editor Spec — SoMe Platform

## Goal
Build a unified video editor at `/dashboard/video-editor` that lets customers:
1. Upload a video
2. Auto-transcribe with Whisper (via `/api/video/transcribe`)
3. See live Remotion Player preview with subtitles on video
4. Edit subtitles, choose styles, trim video
5. Add overlays (logo watermark, lower-third, full branded) + outro
6. Add music (upload or AI-generate via existing `/api/video/generate-music`)
7. Export final video

## Tech Stack (already in project)
- Next.js 14 (App Router) + TypeScript + Tailwind
- `@remotion/player` v4 for in-browser preview
- `remotion` for compositions
- Supabase for storage + auth
- Existing components: `RemotionPreview`, `VideoComposition`, overlays (`LowerThird`, `LogoWatermark`, `FullBranded`), `Outro`
- Music generation: existing API at `/api/video/generate-music`
- Transcription: `/api/video/transcribe` (proxies to Railway Whisper)
- Burn/export: `/api/video/burn-subtitles` (proxies to Railway ffmpeg)

## Architecture

### New Remotion Composition: `SubtitleVideoComposition`
Located at `src/remotion/SubtitleVideoComposition.tsx`

Props:
```ts
type SubtitleVideoCompositionProps = {
  videoUrl: string
  musicUrl?: string | null
  musicVolume: number // 0-1
  segments: Array<{ start: number; end: number; text: string }>
  subtitleStyle: 'sentences' | 'karaoke' | 'big-word' | 'none'
  subtitlePosition: 'bottom' | 'center' | 'top'
  subtitleColor: string
  subtitleBgColor: string // background behind text
  overlayType: 'logo-watermark' | 'lower-third' | 'full-branded' | null
  showOutro: boolean
  brand: VideoOverlayConfig
  trimStart: number // seconds
  trimEnd: number // seconds
  durationInFrames: number
  outroDurationInFrames: number
  fps: number
}
```

### Subtitle Styles
1. **sentences** — Full sentence appears at bottom, fades in/out per segment
2. **karaoke** — Word-by-word highlight (words appear one at a time, highlighted word is accent color)
3. **big-word** — Single word at a time in large centered font, rapid succession (TikTok-style)
4. **none** — No subtitles shown

### New Page: `/dashboard/video-editor`
Multi-step wizard with live Remotion Player preview:

**Step 1: Upload**
- Drag & drop video (MP4, MOV, WebM)
- Upload to Supabase Storage
- Show video preview

**Step 2: Transcribe & Edit**
- Button to transcribe via Whisper
- Editable segment list (start, end, text)
- Add/remove segments
- Live Remotion Player preview showing subtitles on video

**Step 3: Style & Effects**
- Subtitle style selector (sentences/karaoke/big-word/none)
- Subtitle position (top/center/bottom)
- Color pickers for text and background
- Overlay selector (reuse existing: none/logo-watermark/lower-third/full-branded)
- Outro toggle
- Trim controls (start/end sliders or input)

**Step 4: Music**
- Upload audio file, OR
- Generate with AI (mood + genre selector, reuse existing `/api/video/generate-music` API)
- Music volume slider
- Preview with music in Remotion Player

**Step 5: Export**
- Download SRT (UTF-8 BOM)
- Burn subtitles into video (via Railway)
- Save as draft post (to `social_posts` table)
- Full Remotion render (if possible via serverless, otherwise ffmpeg on Railway)

### Key Implementation Details

**Remotion Player in editor (Step 2-4):**
```tsx
<Player
  component={SubtitleVideoComposition}
  inputProps={...}
  durationInFrames={calculatedFrames}
  compositionWidth={1080}
  compositionHeight={1920}
  fps={30}
  controls
  style={{ width: playerWidth, height: playerHeight }}
/>
```

**Karaoke word timing:**
Whisper returns word-level timestamps when using `word_timestamps=True`. 
The Railway whisper server should return `words` array with `{word, start, end}` per word.
Use these for karaoke and big-word styles.

**Export via Railway:**
POST to `/api/video/burn-subtitles` which proxies to Railway.
Railway uploads result directly to Supabase and returns the URL.

### Files to Create/Modify
1. `src/remotion/SubtitleVideoComposition.tsx` — NEW: Remotion composition with subtitle rendering
2. `src/remotion/subtitles/SentenceSubtitle.tsx` — NEW: Sentence-style subtitle component
3. `src/remotion/subtitles/KaraokeSubtitle.tsx` — NEW: Word-by-word karaoke component
4. `src/remotion/subtitles/BigWordSubtitle.tsx` — NEW: Big centered word component
5. `src/remotion/SubtitlePreview.tsx` — NEW: Player wrapper for editor
6. `src/app/dashboard/video-editor/page.tsx` — NEW: Main editor page
7. `src/remotion/index.tsx` — MODIFY: Register new composition

### Existing Code to Reuse
- `src/remotion/overlays/` — All overlay components (LogoWatermark, LowerThird, FullBranded)
- `src/remotion/Outro.tsx` — Outro component
- `src/lib/video-overlay-templates.ts` — Brand config types
- `src/lib/supabase/client.ts` — Supabase browser client
- `src/app/api/video/generate-music/` — Music generation API
- `src/app/dashboard/video/page.tsx` — Reference for music UI, overlay selection patterns

### Dashboard Link
Add "Video Editor" to the dashboard sidebar/navigation.

### Design
Follow existing design patterns in the project:
- Gradient backgrounds (slate-50 → indigo-50)
- Rounded-2xl cards with border-slate-200/60
- Indigo-600 to purple-600 gradient buttons
- Lucide icons
- animate-fade-in-up transitions
