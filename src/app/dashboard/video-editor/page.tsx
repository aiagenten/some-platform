'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { VIDEO_OVERLAY_TEMPLATES, type VideoOverlayConfig } from '@/lib/video-overlay-templates'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Loader2,
  Music,
  Pause,
  Play,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  Type,
  Upload,
  Video,
  Volume2,
  X,
  Plus,
  Trash2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type WordEntry = { word: string; start: number; end: number }
type Segment = {
  id: string
  start: number
  end: number
  text: string
  words?: WordEntry[]
}

type SubtitleStyle = 'sentences' | 'karaoke' | 'big-word' | 'none'
type SubtitlePosition = 'bottom' | 'center' | 'top'
type OverlayType = 'logo-watermark' | 'lower-third' | 'full-branded' | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function buildSRT(segments: Segment[]): string {
  return segments
    .map((seg, i) => `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n`)
    .join('\n')
}

function downloadSRT(segments: Segment[], filename = 'subtitles.srt') {
  const content = buildSRT(segments)
  // UTF-8 BOM
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Dynamic Remotion import (SSR disabled) ───────────────────────────────────

const SubtitlePreview = dynamic(
  () => import('@/remotion/SubtitlePreview').then(m => ({ default: m.SubtitlePreview })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laster preview...
      </div>
    ),
  },
)

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Last opp', icon: Upload },
  { label: 'Teksting', icon: Type },
  { label: 'Stil & Effekter', icon: Sparkles },
  { label: 'Musikk', icon: Music },
  { label: 'Eksporter', icon: Download },
]

const MOOD_OPTIONS = ['Energisk', 'Rolig', 'Dramatisk', 'Lekent', 'Profesjonell', 'Inspirerende']
const GENRE_OPTIONS = ['Pop', 'Elektronisk', 'Akustisk', 'Filmmusikk', 'Lo-fi', 'Corporate']

const SUBTITLE_STYLES: { id: SubtitleStyle; label: string; desc: string }[] = [
  { id: 'sentences', label: 'Setninger', desc: 'Hel setning vises av gangen, fader inn/ut' },
  { id: 'karaoke', label: 'Karaoke', desc: 'Ord-for-ord fremhevet mens de sies' },
  { id: 'big-word', label: 'Stort ord (TikTok)', desc: 'Ett stort ord midt på skjermen om gangen' },
  { id: 'none', label: 'Ingen', desc: 'Ingen teksting' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VideoEditorPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Step 1 – Upload
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(30)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 – Transcribe & edit
  const [transcribing, setTranscribing] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0) // 0 = use full duration

  // Step 3 – Style
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>('sentences')
  const [subtitlePosition, setSubtitlePosition] = useState<SubtitlePosition>('bottom')
  const [subtitleColor, setSubtitleColor] = useState('#ffffff')
  const [subtitleBgColor, setSubtitleBgColor] = useState('rgba(0,0,0,0.6)')
  const [overlayType, setOverlayType] = useState<OverlayType>(null)
  const [showOutro, setShowOutro] = useState(false)
  const [brandConfig, setBrandConfig] = useState<VideoOverlayConfig>({
    logoUrl: null,
    brandName: '',
    tagline: '',
    primaryColor: '#4F46E5',
    accentColor: '#9333EA',
    headingFont: 'sans-serif',
    bodyFont: 'sans-serif',
  })

  // Step 4 – Music
  const [musicTab, setMusicTab] = useState<'upload' | 'generate'>('generate')
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [musicVolume, setMusicVolume] = useState(0.6)
  const [selectedMood, setSelectedMood] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [generatingMusic, setGeneratingMusic] = useState(false)
  const [uploadingMusic, setUploadingMusic] = useState(false)
  const [isPlayingMusic, setIsPlayingMusic] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Step 5 – Export
  const [burningSubtitles, setBurningSubtitles] = useState(false)
  const [burnedVideoUrl, setBurnedVideoUrl] = useState<string | null>(null)
  const [savingPost, setSavingPost] = useState(false)
  const [savedPost, setSavedPost] = useState(false)

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (!profile) return
      setOrgId(profile.org_id)

      const [{ data: brandProfile }, { data: orgData }] = await Promise.all([
        supabase.from('brand_profiles').select('logo_url, tagline, colors, fonts').eq('org_id', profile.org_id).single(),
        supabase.from('organizations').select('name, logo_url').eq('id', profile.org_id).single(),
      ])

      if (brandProfile || orgData) {
        const colors = (brandProfile?.colors as Array<{ hex: string; role: string }>) || []
        const primary = colors.find(c => c.role === 'primary')?.hex || '#4F46E5'
        const accent = colors.find(c => c.role === 'accent')?.hex || '#9333EA'
        setBrandConfig({
          logoUrl: brandProfile?.logo_url || orgData?.logo_url || null,
          brandName: orgData?.name || '',
          tagline: brandProfile?.tagline || '',
          primaryColor: primary,
          accentColor: accent,
          headingFont: 'sans-serif',
          bodyFont: 'sans-serif',
        })
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Upload ───────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    const valid = ['video/mp4', 'video/quicktime', 'video/webm']
    if (!valid.includes(file.type)) {
      setError('Ugyldig filtype. Velg MP4, MOV eller WebM.')
      return
    }
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setLocalPreviewUrl(url)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleVideoLoaded = () => {
    const v = videoRef.current
    if (v && v.duration && isFinite(v.duration)) {
      setVideoDuration(v.duration)
      setTrimEnd(v.duration)
    }
  }

  const handleUpload = async () => {
    if (!videoFile || !orgId) return
    setUploading(true)
    setError(null)
    try {
      const ext = videoFile.name.split('.').pop() || 'mp4'
      const fileName = `${orgId}/editor/${Date.now()}-${uid()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile, { contentType: videoFile.type, upsert: false })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      setVideoUrl(urlData.publicUrl)
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opplasting feilet')
    } finally {
      setUploading(false)
    }
  }

  // ─── Transcribe ───────────────────────────────────────────────────────────

  const handleTranscribe = async () => {
    if (!videoUrl) return
    setTranscribing(true)
    setError(null)
    try {
      // Call Railway Whisper directly (Netlify has 26s timeout, Whisper can take 2min+)
      const whisperUrl = process.env.NEXT_PUBLIC_WHISPER_URL || ''
      const transcribeUrl = whisperUrl
        ? `${whisperUrl}/transcribe`
        : '/api/video/transcribe'
      const res = await fetch(transcribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, language: 'no' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Whisper returns segments[].words (word-level timestamps)
      const segs: Segment[] = (data.segments || []).map((s: {
        start: number; end: number; text: string;
        words?: { word: string; start: number; end: number }[]
      }) => ({
        id: uid(),
        start: s.start,
        end: s.end,
        text: s.text.trim(),
        words: s.words?.map((w) => ({ word: w.word.trim(), start: w.start, end: w.end })),
      }))
      setSegments(segs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transkribering feilet')
    } finally {
      setTranscribing(false)
    }
  }

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const deleteSegment = (id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id))
  }

  const addSegment = () => {
    const last = segments[segments.length - 1]
    const start = last ? last.end + 0.1 : 0
    setSegments(prev => [...prev, { id: uid(), start, end: start + 2, text: '' }])
  }

  // ─── Music upload ─────────────────────────────────────────────────────────

  const handleMusicUpload = async (file: File) => {
    if (!orgId) return
    setUploadingMusic(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() || 'mp3'
      const fileName = `${orgId}/music/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('videos')
        .upload(fileName, file, { contentType: file.type, upsert: false })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      setMusicUrl(urlData.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Musikk-opplasting feilet')
    } finally {
      setUploadingMusic(false)
    }
  }

  // ─── Music generate ───────────────────────────────────────────────────────

  const generateMusic = async () => {
    if (!orgId || !selectedMood || !selectedGenre) return
    setGeneratingMusic(true)
    setError(null)
    try {
      const res = await fetch('/api/video/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          music_prompt: `${selectedMood}, ${selectedGenre.toLowerCase()}, modern, no vocals`,
          duration: Math.ceil(videoDuration),
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (!data.request_id) throw new Error(data.error || 'Musikkgenerering feilet')

      const requestId = data.request_id
      let attempts = 0
      const poll = async (): Promise<void> => {
        attempts++
        const statusRes = await fetch(
          `/api/video/music-status?request_id=${requestId}&org_id=${orgId}`,
        )
        const statusData = await statusRes.json()
        if (statusData.status === 'COMPLETED' && statusData.music_url) {
          setMusicUrl(statusData.music_url)
          setGeneratingMusic(false)
          return
        }
        if (statusData.status === 'FAILED') throw new Error('Musikkgenerering feilet')
        if (attempts < 60) {
          await new Promise(r => setTimeout(r, 3000))
          return poll()
        }
        throw new Error('Musikkgenerering tok for lang tid')
      }
      await poll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Musikkfeil')
      setGeneratingMusic(false)
    }
  }

  const toggleMusicPreview = () => {
    if (!musicUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(musicUrl)
      audioRef.current.volume = musicVolume
      audioRef.current.onended = () => setIsPlayingMusic(false)
    }
    if (isPlayingMusic) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlayingMusic(!isPlayingMusic)
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  const handleBurnSubtitles = async () => {
    if (!videoUrl) return
    setBurningSubtitles(true)
    setError(null)
    try {
      const res = await fetch('/api/video/burn-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          srt_content: buildSRT(segments),
          org_id: orgId,
          trim_start: trimStart,
          trim_end: trimEnd > 0 ? trimEnd : videoDuration,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.video_url) throw new Error(data.error || 'Eksport feilet')
      setBurnedVideoUrl(data.video_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eksport feilet')
    } finally {
      setBurningSubtitles(false)
    }
  }

  const handleSavePost = async () => {
    if (!orgId) return
    setSavingPost(true)
    try {
      await supabase.from('social_posts').insert({
        org_id: orgId,
        platform: 'instagram',
        format: 'video',
        caption: '',
        content_text: '',
        content_image_url: burnedVideoUrl || videoUrl,
        status: 'draft',
      })
      setSavedPost(true)
    } catch {
      setError('Kunne ikke lagre innlegg')
    } finally {
      setSavingPost(false)
    }
  }

  // ─── Computed values for preview ──────────────────────────────────────────

  const effectiveTrimEnd = trimEnd > 0 ? trimEnd : videoDuration
  const effectiveDuration = effectiveTrimEnd - trimStart
  const currentVideoUrl = burnedVideoUrl || videoUrl || ''

  const previewProps = {
    videoUrl: currentVideoUrl,
    musicUrl: musicUrl,
    musicVolume,
    segments,
    subtitleStyle,
    subtitlePosition,
    subtitleColor,
    subtitleBgColor,
    overlayType,
    showOutro,
    brand: brandConfig,
    trimStart,
    trimEnd: effectiveTrimEnd,
    durationSec: Math.max(1, effectiveDuration),
    aspectRatio: '9:16',
  }

  const canProceed = () => {
    switch (step) {
      case 0: return !!videoFile
      case 1: return !!videoUrl
      case 2: return true
      case 3: return true
      case 4: return true
      default: return false
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Scissors className="w-6 h-6 text-indigo-600" />
          Video Editor
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Last opp video, transkriber, legg til teksting og eksporter
        </p>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-1">
          {STEPS.map((s, i) => {
            const isActive = i === step
            const isDone = i < step
            const Icon = s.icon
            return (
              <button
                key={i}
                onClick={() => isDone && setStep(i)}
                className={`flex items-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : isDone
                      ? 'text-emerald-600 cursor-pointer hover:bg-emerald-50'
                      : 'text-slate-400 cursor-default'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Two-column layout for steps 1–4 (edit + preview) */}
      <div className={`${step >= 1 && step <= 4 ? 'grid grid-cols-1 xl:grid-cols-5 gap-6' : ''}`}>
        {/* ── Main panel ── */}
        <div className={`${step >= 1 && step <= 4 ? 'xl:col-span-3' : ''} bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm min-h-[420px]`}>

          {/* ────────────────────────────────────────────────────
              STEP 0 — Upload
          ──────────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Last opp video</h2>

              {/* Drop zone */}
              {!videoFile ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  <Video className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="font-medium text-slate-700">Dra og slipp video her</p>
                  <p className="text-sm text-slate-400 mt-1">MP4, MOV eller WebM</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video preview */}
                  {localPreviewUrl && (
                    <video
                      ref={videoRef}
                      src={localPreviewUrl}
                      controls
                      onLoadedMetadata={handleVideoLoaded}
                      className="w-full max-h-72 rounded-xl border border-slate-200 bg-black"
                    />
                  )}
                  <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-indigo-500" />
                      <span className="font-medium">{videoFile.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => { setVideoFile(null); setLocalPreviewUrl(null) }} className="hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Laster opp...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Last opp og fortsett</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 1 — Transcribe & edit segments
          ──────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Teksting</h2>
                {segments.length === 0 ? (
                  <button
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                  >
                    {transcribing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Transkriberer...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Auto-transkriber (Whisper)</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Transkriber på nytt
                  </button>
                )}
              </div>

              {transcribing && (
                <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transkriberer med Whisper... Dette kan ta litt tid.
                </div>
              )}

              {/* Trim controls */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-indigo-500" /> Trim video
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Start (sek)</label>
                    <input
                      type="number"
                      min={0}
                      max={effectiveTrimEnd - 0.1}
                      step={0.1}
                      value={trimStart}
                      onChange={e => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Slutt (sek)</label>
                    <input
                      type="number"
                      min={trimStart + 0.1}
                      max={videoDuration}
                      step={0.1}
                      value={effectiveTrimEnd}
                      onChange={e => setTrimEnd(Math.min(videoDuration, parseFloat(e.target.value) || videoDuration))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full relative">
                  <div
                    className="absolute h-full bg-indigo-500 rounded-full"
                    style={{
                      left: `${(trimStart / videoDuration) * 100}%`,
                      right: `${100 - (effectiveTrimEnd / videoDuration) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Valgt varighet: {(effectiveTrimEnd - trimStart).toFixed(1)}s av {videoDuration.toFixed(1)}s
                </p>
              </div>

              {/* Segments */}
              {segments.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {segments.map(seg => (
                    <div key={seg.id} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={seg.start.toFixed(2)}
                          step={0.01}
                          onChange={e => updateSegment(seg.id, { start: parseFloat(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                        />
                        <span className="text-xs text-slate-400">→</span>
                        <input
                          type="number"
                          value={seg.end.toFixed(2)}
                          step={0.01}
                          onChange={e => updateSegment(seg.id, { end: parseFloat(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                        />
                        <button
                          onClick={() => deleteSegment(seg.id)}
                          className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={seg.text}
                        onChange={e => updateSegment(seg.id, { text: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={addSegment}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus className="w-4 h-4" /> Legg til segment
              </button>
            </div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 2 — Style & Effects
          ──────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Stil og effekter</h2>

              {/* Subtitle style */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tekstingsstil</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUBTITLE_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSubtitleStyle(s.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        subtitleStyle === s.id
                          ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-sm font-medium ${subtitleStyle === s.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {s.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Position */}
              {subtitleStyle !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Posisjon</label>
                  <div className="flex gap-2">
                    {(['top', 'center', 'bottom'] as SubtitlePosition[]).map(pos => (
                      <button
                        key={pos}
                        onClick={() => setSubtitlePosition(pos)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all capitalize ${
                          subtitlePosition === pos
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {pos === 'top' ? 'Topp' : pos === 'center' ? 'Midten' : 'Bunn'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Colors */}
              {subtitleStyle !== 'none' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tekstfarge</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={subtitleColor}
                        onChange={e => setSubtitleColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-1"
                      />
                      <input
                        type="text"
                        value={subtitleColor}
                        onChange={e => setSubtitleColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Bakgrunnsfarge</label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Svart 60%', val: 'rgba(0,0,0,0.6)' },
                        { label: 'Ingen', val: 'transparent' },
                        { label: 'Hvit 80%', val: 'rgba(255,255,255,0.8)' },
                      ].map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => setSubtitleBgColor(opt.val)}
                          className={`px-2 py-1 rounded border text-xs transition-all ${
                            subtitleBgColor === opt.val
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Overlay */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Overlay</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setOverlayType(null)}
                    className={`w-full p-3 rounded-xl border text-left text-sm transition-all ${
                      overlayType === null
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Ingen overlay
                  </button>
                  {VIDEO_OVERLAY_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setOverlayType(t.id as OverlayType)}
                      className={`w-full p-3 rounded-xl border text-left text-sm transition-all ${
                        overlayType === t.id
                          ? 'border-indigo-500 bg-indigo-50/60 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">{t.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Outro */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300 transition-all">
                  <input
                    type="checkbox"
                    checked={showOutro}
                    onChange={e => setShowOutro(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-indigo-500" /> Vis branded outro
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5">2.5s avslutning med logo og merkenavn</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 3 — Music
          ──────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Musikk</h2>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-200">
                {[
                  { id: 'generate' as const, label: 'AI-generer', icon: Sparkles },
                  { id: 'upload' as const, label: 'Last opp', icon: Upload },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setMusicTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                      musicTab === tab.id
                        ? 'border-indigo-500 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {musicTab === 'generate' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Stemning</label>
                    <div className="flex flex-wrap gap-2">
                      {MOOD_OPTIONS.map(m => (
                        <button
                          key={m}
                          onClick={() => setSelectedMood(m)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                            selectedMood === m
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Sjanger</label>
                    <div className="flex flex-wrap gap-2">
                      {GENRE_OPTIONS.map(g => (
                        <button
                          key={g}
                          onClick={() => setSelectedGenre(g)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                            selectedGenre === g
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={generateMusic}
                    disabled={generatingMusic || !selectedMood || !selectedGenre}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                  >
                    {generatingMusic ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Genererer musikk...</>
                    ) : (
                      <><Music className="w-4 h-4" /> Generer musikk</>
                    )}
                  </button>
                </div>
              )}

              {musicTab === 'upload' && (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'audio/*'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) handleMusicUpload(file)
                    }
                    input.click()
                  }}
                >
                  {uploadingMusic ? (
                    <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-2" />
                  ) : (
                    <Music className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  )}
                  <p className="text-sm text-slate-600">Klikk for å laste opp lydfil</p>
                  <p className="text-xs text-slate-400 mt-1">MP3, WAV, AAC, M4A</p>
                </div>
              )}

              {/* Music player */}
              {musicUrl && (
                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                  <button
                    onClick={toggleMusicPreview}
                    className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 flex-shrink-0"
                  >
                    {isPlayingMusic ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {musicUrl.split('/').pop() || 'musikk.mp3'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Klikk for å forhåndsvise</p>
                  </div>
                  <button
                    onClick={() => {
                      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
                      setMusicUrl(null)
                      setIsPlayingMusic(false)
                    }}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Volume */}
              {musicUrl && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Volume2 className="w-4 h-4" /> Volum: {Math.round(musicVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={musicVolume}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setMusicVolume(v)
                      if (audioRef.current) audioRef.current.volume = v
                    }}
                    className="w-full accent-indigo-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 4 — Export
          ──────────────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Eksporter</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Download SRT */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Download className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">SRT-fil</p>
                      <p className="text-xs text-slate-400">UTF-8 BOM, standard format</p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadSRT(segments)}
                    disabled={segments.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Last ned SRT
                  </button>
                </div>

                {/* Burn subtitles */}
                <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Film className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Burn inn tekst</p>
                      <p className="text-xs text-slate-400">Eksporter video med teksting brent inn</p>
                    </div>
                  </div>
                  {burnedVideoUrl ? (
                    <div className="space-y-2">
                      <video src={burnedVideoUrl} controls className="w-full rounded-xl border border-slate-200 max-h-32" />
                      <a
                        href={burnedVideoUrl}
                        download
                        className="flex items-center justify-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Download className="w-4 h-4" /> Last ned video
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={handleBurnSubtitles}
                      disabled={burningSubtitles || segments.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:from-indigo-700 hover:to-purple-700 transition-all"
                    >
                      {burningSubtitles ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Behandler...</>
                      ) : (
                        <><Scissors className="w-4 h-4" /> Burn tekst inn</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Save as post */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Save className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Lagre som utkast</p>
                    <p className="text-xs text-slate-400">Legger til i innleggslisten som utkast</p>
                  </div>
                </div>
                {savedPost ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2.5">
                    <Check className="w-4 h-4" /> Lagret! Går til innlegg...
                  </div>
                ) : (
                  <button
                    onClick={handleSavePost}
                    disabled={savingPost || !videoUrl}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                  >
                    {savingPost ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Lagrer...</>
                    ) : (
                      <><Save className="w-4 h-4" /> Lagre som innlegg</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Preview panel (right column, steps 1–4) ── */}
        {step >= 1 && step <= 4 && (
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm sticky top-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Live Preview
              </p>
              {currentVideoUrl ? (
                <SubtitlePreview {...previewProps} />
              ) : (
                <div className="flex items-center justify-center h-64 text-sm text-slate-400 bg-slate-50 rounded-xl">
                  <Video className="w-8 h-8 text-slate-300 mr-2" /> Ingen video ennå
                </div>
              )}
              <div className="mt-3 text-xs text-slate-400 text-center">
                {subtitleStyle !== 'none' ? `Stil: ${SUBTITLE_STYLES.find(s => s.id === subtitleStyle)?.label}` : 'Ingen teksting'}
                {overlayType && ` · ${VIDEO_OVERLAY_TEMPLATES.find(t => t.id === overlayType)?.name}`}
                {showOutro && ' · Med outro'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Forrige
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
          >
            Neste <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
