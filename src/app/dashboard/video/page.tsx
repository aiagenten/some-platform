'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Video, Upload, Sparkles, ChevronRight, ChevronLeft, Play, Pause,
  RefreshCw, Music, Eye, Send, Save, Check, Loader2, Image as ImageIcon,
  ArrowRight, Volume2, VolumeX, Film
} from 'lucide-react'
import dynamic from 'next/dynamic'
import MediaPickerModal from '@/components/MediaPickerModal'
import { VIDEO_OVERLAY_TEMPLATES, type VideoOverlayConfig } from '@/lib/video-overlay-templates'

const RemotionPreview = dynamic(
  () => import('@/remotion/RemotionPreview').then(m => ({ default: m.RemotionPreview })),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-sm text-slate-400">Laster preview...</div> }
)

type ImageStyle = {
  id: string
  name: string
  prompt: string
  is_default: boolean
}

const DEFAULT_STYLES: ImageStyle[] = [
  { id: 'scandinavian-photo', name: 'Fotorealistisk skandinavisk', prompt: '', is_default: true },
  { id: 'office-professional', name: 'Profesjonelt kontormiljø', prompt: '', is_default: true },
  { id: 'flat-illustration', name: 'Flat design illustrasjon', prompt: '', is_default: true },
  { id: 'product-minimal', name: 'Minimalistisk produktfoto', prompt: '', is_default: true },
  { id: 'nordic-outdoor', name: 'Utendørs nordisk natur', prompt: '', is_default: true },
]

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram Reels', defaultAspect: '9:16', icon: '📱' },
  { id: 'tiktok', name: 'TikTok', defaultAspect: '9:16', icon: '🎵' },
  { id: 'linkedin', name: 'LinkedIn', defaultAspect: '16:9', icon: '💼' },
  { id: 'facebook', name: 'Facebook', defaultAspect: '1:1', icon: '👥' },
]

const ANGLE_PRESETS = [
  { label: 'Sett bakfra', prompt: 'viewed from behind' },
  { label: 'Sett forfra', prompt: 'viewed from the front' },
  { label: 'Zoomet ut', prompt: 'zoomed out, wide shot, far away' },
  { label: 'Zoomet inn', prompt: 'zoomed in, extreme close-up' },
  { label: 'Fugleperspektiv', prompt: 'seen from above, bird\'s eye view' },
  { label: 'Bakkenivå', prompt: 'seen from ground level, low angle' },
  { label: 'Rotert 90° venstre', prompt: 'rotated 90 degrees to the left' },
  { label: 'Rotert 90° høyre', prompt: 'rotated 90 degrees to the right' },
]

const MOTION_PRESETS = [
  { label: 'Smooth kamerabevegelse', prompt: 'Smooth cinematic camera movement' },
  { label: 'Dramatisk zoom', prompt: 'Dramatic slow zoom into the subject' },
  { label: 'Sakte panorering', prompt: 'Slow horizontal pan across the scene' },
  { label: 'Parallax-effekt', prompt: 'Parallax depth effect with foreground and background movement' },
]

const MOOD_OPTIONS = ['Energisk', 'Rolig', 'Dramatisk', 'Lekent', 'Profesjonell', 'Inspirerende']
const GENRE_OPTIONS = ['Pop', 'Elektronisk', 'Akustisk', 'Filmmusikk', 'Lo-fi', 'Corporate']

export default function VideoCreator() {
  const [step, setStep] = useState(0)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [styles, setStyles] = useState<ImageStyle[]>(DEFAULT_STYLES)
  const router = useRouter()
  const supabase = createClient()

  // Step 0: Platform
  const [platform, setPlatform] = useState('instagram')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration, setDuration] = useState(5)

  // Step 1: Start image
  const [startImageTab, setStartImageTab] = useState<'upload' | 'generate'>('generate')
  const [startImageUrl, setStartImageUrl] = useState<string | null>(null)
  const [startImagePrompt, setStartImagePrompt] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('')
  const [generatingStart, setGeneratingStart] = useState(false)

  // Step 2: End image
  const [endImageUrl, setEndImageUrl] = useState<string | null>(null)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [anglePrompt, setAnglePrompt] = useState('')
  const [customAngle, setCustomAngle] = useState('')
  const [motionPrompt, setMotionPrompt] = useState('')
  const [customMotion, setCustomMotion] = useState('')
  const [generatingEnd, setGeneratingEnd] = useState(false)

  // Step 3: Video
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)

  // Step 4: Music & Overlay
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [selectedMood, setSelectedMood] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [generatingMusic, setGeneratingMusic] = useState(false)
  const [noMusic, setNoMusic] = useState(false)
  const [isPlayingMusic, setIsPlayingMusic] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null)
  const [overlayFadeIn] = useState(1.0)
  const [showOutro, setShowOutro] = useState(true)
  const [brandConfig, setBrandConfig] = useState<VideoOverlayConfig>({
    logoUrl: null,
    brandName: '',
    tagline: '',
    primaryColor: '#4F46E5',
    accentColor: '#06B6D4',
    headingFont: 'sans-serif',
    bodyFont: 'sans-serif',
  })

  // Step 5: Caption
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load user, org, and styles
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile) return
      setOrgId(profile.org_id)

      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', profile.org_id)
        .single()

      const settings = (org?.settings as Record<string, unknown>) || {}
      const savedStyles = (settings.image_styles as ImageStyle[]) || null
      if (savedStyles) setStyles(savedStyles)
      setSelectedStyle((settings.active_image_style as string) || 'scandinavian-photo')

      // Load brand data for overlays/outro
      const { data: brandProfile } = await supabase
        .from('brand_profiles')
        .select('logo_url, tagline, colors, fonts')
        .eq('org_id', profile.org_id)
        .single()

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, logo_url')
        .eq('id', profile.org_id)
        .single()

      if (brandProfile || orgData) {
        const colors = (brandProfile?.colors as Array<{ hex: string; role: string }>) || []
        const primary = colors.find(c => c.role === 'primary')?.hex || '#4F46E5'
        const accent = colors.find(c => c.role === 'accent')?.hex || '#06B6D4'
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

  // Handle platform change → auto set aspect ratio
  const handlePlatformChange = (p: string) => {
    setPlatform(p)
    const pf = PLATFORMS.find(x => x.id === p)
    if (pf) setAspectRatio(pf.defaultAspect)
  }

  // Upload handler
  const handleUpload = useCallback(async (file: File) => {
    if (!orgId) return
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${orgId}/start-images/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase
      .storage.from('videos')
      .upload(fileName, file, { contentType: file.type, upsert: false })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      setStartImageUrl(urlData.publicUrl)
    } else {
      setError('Kunne ikke laste opp bildet')
    }
  }, [orgId, supabase])

  // Generate start image
  const generateStartImage = async () => {
    if (!startImagePrompt || !orgId) return
    setGeneratingStart(true)
    setError(null)
    try {
      const res = await fetch('/api/video/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: startImagePrompt,
          style_id: selectedStyle,
          aspect_ratio: aspectRatio,
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (data.image_url) {
        setStartImageUrl(data.image_url)
      } else {
        setError(data.error || 'Bildegenerering feilet')
      }
    } catch {
      setError('Nettverksfeil ved bildegenerering')
    } finally {
      setGeneratingStart(false)
    }
  }

  // Generate end image
  const generateEndImage = async () => {
    if (!startImageUrl || !orgId) return
    const angle = customAngle || anglePrompt
    if (!angle) { setError('Velg eller skriv en vinkel'); return }
    setGeneratingEnd(true)
    setError(null)
    try {
      const res = await fetch('/api/video/generate-end-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_image_url: startImageUrl,
          angle_prompt: angle,
          aspect_ratio: aspectRatio,
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (data.image_url) {
        setEndImageUrl(data.image_url)
      } else {
        setError(data.error || 'Sluttbilde-generering feilet')
      }
    } catch {
      setError('Nettverksfeil ved sluttbilde-generering')
    } finally {
      setGeneratingEnd(false)
    }
  }

  // Create video record in DB
  const ensureVideoRecord = async () => {
    if (videoId || !orgId || !userId) return null
    const { data, error: insertErr } = await supabase
      .from('videos')
      .insert({
        org_id: orgId,
        user_id: userId,
        status: 'draft',
        start_image_url: startImageUrl,
        start_image_source: startImageTab === 'upload' ? 'uploaded' : 'generated',
        start_image_prompt: startImagePrompt || null,
        end_image_url: endImageUrl,
        end_image_prompt: customAngle || anglePrompt || null,
        motion_prompt: customMotion || motionPrompt || null,
        duration,
        aspect_ratio: aspectRatio,
        platform,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Insert video error:', insertErr)
      return null
    }
    setVideoId(data.id)
    return data.id
  }

  // Generate video
  const generateVideo = async () => {
    if (!startImageUrl || !orgId) return
    setGeneratingVideo(true)
    setError(null)
    try {
      const vid = videoId || await ensureVideoRecord()
      // Submit to queue (fast, non-blocking)
      const res = await fetch('/api/video/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_image_url: startImageUrl,
          end_image_url: endImageUrl,
          motion_prompt: customMotion || motionPrompt || 'Smooth cinematic camera movement',
          duration,
          aspect_ratio: aspectRatio,
          video_id: vid,
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (!data.request_id) {
        setError(data.error || 'Kunne ikke starte videogenerering')
        setGeneratingVideo(false)
        return
      }

      // Poll for completion
      const requestId = data.request_id
      let attempts = 0
      const maxAttempts = 120 // 2 minutes max
      const poll = async () => {
        attempts++
        try {
          const statusRes = await fetch(
            `/api/video/status?request_id=${requestId}&org_id=${orgId}&video_id=${vid}`
          )
          const statusData = await statusRes.json()

          if (statusData.status === 'COMPLETED' && statusData.video_url) {
            setVideoUrl(statusData.video_url)
            setGeneratingVideo(false)
            return
          }
          if (statusData.status === 'FAILED') {
            setError('Videogenerering feilet')
            setGeneratingVideo(false)
            return
          }
          if (attempts < maxAttempts) {
            setTimeout(poll, 3000) // Poll every 3 seconds
          } else {
            setError('Videogenerering tok for lang tid. Prøv igjen.')
            setGeneratingVideo(false)
          }
        } catch {
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000)
          } else {
            setError('Mistet kontakt med serveren')
            setGeneratingVideo(false)
          }
        }
      }
      poll()
    } catch {
      setError('Nettverksfeil ved videogenerering')
      setGeneratingVideo(false)
    }
  }

  // Generate music
  const generateMusic = async () => {
    if (!orgId || !selectedMood || !selectedGenre) return
    setGeneratingMusic(true)
    setError(null)
    try {
      const musicPrompt = `${selectedMood}, ${selectedGenre.toLowerCase()}, modern, no vocals`
      const res = await fetch('/api/video/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          music_prompt: musicPrompt,
          duration,
          video_id: videoId,
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (!data.request_id) {
        setError(data.error || 'Kunne ikke starte musikkgenerering')
        setGeneratingMusic(false)
        return
      }

      // Poll for completion
      const requestId = data.request_id
      let attempts = 0
      const maxAttempts = 60 // ~3 minutes
      const poll = async () => {
        attempts++
        try {
          const statusRes = await fetch(
            `/api/video/music-status?request_id=${requestId}&org_id=${orgId}&video_id=${videoId}`
          )
          const statusData = await statusRes.json()
          if (statusData.status === 'COMPLETED' && statusData.music_url) {
            setMusicUrl(statusData.music_url)
            setGeneratingMusic(false)
            return
          }
          if (statusData.status === 'FAILED') {
            setError('Musikkgenerering feilet')
            setGeneratingMusic(false)
            return
          }
          if (attempts < maxAttempts) {
            setTimeout(poll, 3000)
          } else {
            setError('Musikkgenerering tok for lang tid. Prøv igjen.')
            setGeneratingMusic(false)
          }
        } catch {
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000)
          } else {
            setError('Mistet kontakt med serveren')
            setGeneratingMusic(false)
          }
        }
      }
      poll()
    } catch {
      setError('Nettverksfeil ved musikkgenerering')
      setGeneratingMusic(false)
    }
  }

  // Play/pause music preview
  const toggleMusic = () => {
    if (!musicUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(musicUrl)
      audioRef.current.onended = () => setIsPlayingMusic(false)
    }
    if (isPlayingMusic) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlayingMusic(!isPlayingMusic)
  }

  // Generate caption
  const generateCaption = async () => {
    if (!orgId) return
    setGeneratingCaption(true)
    setError(null)
    try {
      const res = await fetch('/api/video/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          motion_prompt: customMotion || motionPrompt,
          music_mood: selectedMood,
          video_id: videoId,
          org_id: orgId,
        }),
      })
      const data = await res.json()
      if (data.caption) {
        setCaption(data.caption)
        setHashtags(data.hashtags || [])
      } else {
        setError(data.error || 'Tekst-generering feilet')
      }
    } catch {
      setError('Nettverksfeil')
    } finally {
      setGeneratingCaption(false)
    }
  }

  // Save as draft — also create a social_post so it appears in the posts list
  const saveAsDraft = async () => {
    if (!videoId || !orgId) return
    setSaving(true)
    await supabase.from('videos').update({
      caption,
      overlay_template_id: selectedOverlay,
      overlay_fade_in_sec: overlayFadeIn,
      show_outro: showOutro,
      music_mood: selectedMood,
      status: 'ready',
    }).eq('id', videoId)

    // Create a social_post linked to the video so it shows in the posts list
    await supabase.from('social_posts').insert({
      org_id: orgId,
      platform,
      format: 'video',
      caption: caption || '',
      content_text: caption || '',
      content_image_url: videoUrl,
      video_id: videoId,
      status: 'draft',
    })

    setSaving(false)
    router.push('/dashboard/posts')
  }

  // Step components
  const STEPS = [
    { label: 'Plattform', icon: Video },
    { label: 'Startbilde', icon: ImageIcon },
    { label: 'Sluttbilde', icon: ImageIcon },
    { label: 'Video', icon: Play },
    { label: 'Musikk & Overlay', icon: Music },
    { label: 'Tekst', icon: Send },
  ]

  const canProceed = () => {
    switch (step) {
      case 0: return !!platform
      case 1: return !!startImageUrl
      case 2: return !!endImageUrl
      case 3: return !!videoUrl
      case 4: return true
      case 5: return true
      default: return false
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Video Creator</h1>
        <p className="text-sm text-slate-500 mt-1">Lag profesjonelle videoer med AI-genererte bilder, bevegelse og musikk</p>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const isActive = i === step
            const isDone = i < step
            return (
              <button
                key={i}
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : isDone
                      ? 'text-emerald-600 cursor-pointer hover:bg-emerald-50'
                      : 'text-slate-400 cursor-default'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm min-h-[400px]">

        {/* STEP 0: Platform & Format */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Velg plattform og format</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePlatformChange(p.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    platform === p.id
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{p.icon}</div>
                  <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{p.defaultAspect}</p>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Aspektforhold</label>
              <div className="flex gap-2">
                {['9:16', '1:1', '16:9'].map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      aspectRatio === ar
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Varighet</label>
              <div className="flex gap-2">
                {[5, 10].map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-6 py-2 rounded-lg border text-sm font-medium transition-all ${
                      duration === d
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {d} sekunder
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Start Image */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Startbilde</h2>

            <div className="flex gap-2 border-b border-slate-200 pb-0">
              {[
                { id: 'generate' as const, label: 'Generer fra prompt', icon: Sparkles },
                { id: 'upload' as const, label: 'Last opp', icon: Upload },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStartImageTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                    startImageTab === tab.id
                      ? 'border-indigo-500 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {startImageTab === 'upload' && (
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) handleUpload(file)
                }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) handleUpload(file)
                  }
                  input.click()
                }}
              >
                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="text-sm text-slate-600">Dra og slipp, eller klikk for å velge</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP</p>
              </div>
            )}

            {startImageTab === 'generate' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bildestil</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {styles.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStyle(s.id)}
                        className={`p-3 rounded-lg border text-left text-sm transition-all ${
                          selectedStyle === s.id
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Beskriv bildet</label>
                  <textarea
                    value={startImagePrompt}
                    onChange={e => setStartImagePrompt(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="F.eks: En ung kvinne som jobber på laptop på en kafé i Oslo..."
                  />
                </div>

                <button
                  onClick={generateStartImage}
                  disabled={generatingStart || !startImagePrompt}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generatingStart ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Genererer...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generer bilde</>
                  )}
                </button>
              </div>
            )}

            {/* Preview */}
            {startImageUrl && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={startImageUrl} alt="Start" className="max-h-80 object-contain" />
                </div>
                <button
                  onClick={() => { setStartImageUrl(null) }}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Velg nytt bilde
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: End Image */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Sluttbilde og bevegelse</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Start image reference */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Startbilde (referanse)</p>
                {startImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={startImageUrl} alt="Start" className="w-full object-contain max-h-64" />
                  </div>
                )}
              </div>

              {/* Right: End image */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Sluttbilde</p>
                {endImageUrl ? (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={endImageUrl} alt="Slutt" className="w-full object-contain max-h-64" />
                    </div>
                    <button
                      onClick={() => setEndImageUrl(null)}
                      className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerer
                    </button>
                  </div>
                ) : (
                  <div className="h-64 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm">
                    Velg vinkel og generer
                  </div>
                )}
              </div>
            </div>

            {/* Upload end image option */}
            <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-sm text-slate-600">Eller velg sluttbilde:</span>
              <label className="cursor-pointer px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Last opp
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !orgId) return
                    setGeneratingEnd(true)
                    setError(null)
                    try {
                      const fileName = `${orgId}/end-images/${Date.now()}-${file.name}`
                      const { error: uploadError } = await supabase
                        .storage.from('videos')
                        .upload(fileName, file, { contentType: file.type, upsert: false })
                      if (uploadError) throw uploadError
                      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
                      setEndImageUrl(urlData.publicUrl)
                    } catch {
                      setError('Kunne ikke laste opp sluttbilde')
                    } finally {
                      setGeneratingEnd(false)
                    }
                  }}
                />
              </label>
              <button
                onClick={() => setShowMediaPicker(true)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Mediebibliotek
              </button>
            </div>

            {/* Angle presets */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Eller generer sluttbilde med AI — velg kameravinkel:</label>
              <div className="flex flex-wrap gap-2">
                {ANGLE_PRESETS.map(a => (
                  <button
                    key={a.prompt}
                    onClick={() => { setAnglePrompt(a.prompt); setCustomAngle('') }}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      anglePrompt === a.prompt && !customAngle
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <input
                value={customAngle}
                onChange={e => { setCustomAngle(e.target.value); if (e.target.value) setAnglePrompt('') }}
                className="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Eller skriv egen vinkel..."
              />
            </div>

            {/* Motion presets */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Hva skjer i videoen?</label>
              <div className="flex flex-wrap gap-2">
                {MOTION_PRESETS.map(m => (
                  <button
                    key={m.prompt}
                    onClick={() => { setMotionPrompt(m.prompt); setCustomMotion('') }}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      motionPrompt === m.prompt && !customMotion
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <input
                value={customMotion}
                onChange={e => { setCustomMotion(e.target.value); if (e.target.value) setMotionPrompt('') }}
                className="mt-2 w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Eller beskriv bevegelsen..."
              />
            </div>

            <button
              onClick={generateEndImage}
              disabled={generatingEnd || (!anglePrompt && !customAngle)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {generatingEnd ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Genererer sluttbilde...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generer sluttbilde</>
              )}
            </button>
          </div>
        )}

        {/* STEP 3: Generate Video */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Generer video</h2>

            {/* Side-by-side images */}
            <div className="flex items-center gap-4 justify-center">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2">Start</p>
                {startImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 w-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={startImageUrl} alt="Start" className="w-full object-contain" />
                  </div>
                )}
              </div>
              <ArrowRight className="w-8 h-8 text-indigo-400 flex-shrink-0" />
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2">Slutt</p>
                {endImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 w-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={endImageUrl} alt="Slutt" className="w-full object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">
                Estimert pris: <span className="font-semibold text-slate-900">~kr {duration === 5 ? '5' : '10'}</span> for {duration}s video
              </p>
              <p className="text-xs text-slate-400 mt-1">Kling O1 via fal.ai</p>
            </div>

            {!videoUrl ? (
              <div className="text-center">
                <button
                  onClick={generateVideo}
                  disabled={generatingVideo}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 text-lg"
                >
                  {generatingVideo ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Genererer video...</>
                  ) : (
                    <><Video className="w-5 h-5" /> Generer video</>
                  )}
                </button>
                {generatingVideo && (
                  <p className="text-sm text-slate-500 mt-3">Dette kan ta 1-3 minutter...</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <video
                  src={videoUrl}
                  controls
                  className="rounded-xl border border-slate-200 max-h-96 mx-auto"
                />
                <div className="text-center">
                  <button
                    onClick={() => { setVideoUrl(null); generateVideo() }}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerer video
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Music & Overlay */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Musikk og overlay</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Music */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    <Music className="w-4 h-4 text-indigo-600" /> Musikk
                  </h3>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={noMusic}
                      onChange={e => setNoMusic(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Ingen musikk
                  </label>
                </div>

                {!noMusic && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Stemning</label>
                      <div className="flex flex-wrap gap-1.5">
                        {MOOD_OPTIONS.map(m => (
                          <button
                            key={m}
                            onClick={() => setSelectedMood(m)}
                            className={`px-3 py-1 rounded-lg border text-xs transition-all ${
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
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Sjanger</label>
                      <div className="flex flex-wrap gap-1.5">
                        {GENRE_OPTIONS.map(g => (
                          <button
                            key={g}
                            onClick={() => setSelectedGenre(g)}
                            className={`px-3 py-1 rounded-lg border text-xs transition-all ${
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
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {generatingMusic ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Genererer...</>
                      ) : (
                        <><Music className="w-4 h-4" /> Generer musikk</>
                      )}
                    </button>

                    {musicUrl && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <button
                          onClick={toggleMusic}
                          className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"
                        >
                          {isPlayingMusic ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">{selectedMood} {selectedGenre}</p>
                          <p className="text-xs text-slate-500">{duration}s</p>
                        </div>
                        <button
                          onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }; setMusicUrl(null); setIsPlayingMusic(false) }}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Overlay */}
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" /> Overlay
                </h3>

                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedOverlay(null)}
                    className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${
                      !selectedOverlay ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Ingen overlay
                  </button>
                  {VIDEO_OVERLAY_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedOverlay(t.id)}
                      className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${
                        selectedOverlay === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">{t.description}</span>
                    </button>
                  ))}
                </div>

                {/* Outro toggle */}
                <div className="pt-2 border-t border-slate-100">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2 mb-2">
                    <Film className="w-4 h-4 text-indigo-600" /> Outro
                  </h3>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 transition-all">
                    <input
                      type="checkbox"
                      checked={showOutro}
                      onChange={e => setShowOutro(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700">Vis branded outro</span>
                      <span className="block text-xs text-slate-400">2.5s avslutning med logo og merkenavn</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Remotion Player preview */}
            {videoUrl && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Preview med overlay{showOutro ? ' og outro' : ''}
                </p>
                <RemotionPreview
                  videoUrl={videoUrl}
                  musicUrl={noMusic ? null : musicUrl}
                  overlayType={(selectedOverlay as 'logo-watermark' | 'lower-third' | 'full-branded') || null}
                  showOutro={showOutro}
                  durationSec={duration}
                  aspectRatio={aspectRatio}
                  brand={brandConfig}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Caption & Publish */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Tekst og publisering</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Posttekst</label>
                  <button
                    onClick={generateCaption}
                    disabled={generatingCaption}
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {generatingCaption ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Genererer...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> Auto-generer</>
                    )}
                  </button>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Skriv eller generer tekst til posten..."
                />

                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {hashtags.map((h, i) => (
                      <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Preview</p>
                {videoUrl && (
                  <video src={videoUrl} controls className="rounded-xl border border-slate-200 w-full max-h-48" />
                )}
                {musicUrl && !noMusic && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Volume2 className="w-4 h-4" /> Musikk: {selectedMood} {selectedGenre}
                  </div>
                )}
                {noMusic && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <VolumeX className="w-4 h-4" /> Ingen musikk
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  Plattform: {PLATFORMS.find(p => p.id === platform)?.name} | {aspectRatio} | {duration}s
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={saveAsDraft}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lagre som utkast
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" /> Forrige
        </button>
        {step < 5 && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Neste <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <MediaPickerModal
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(url) => {
          setEndImageUrl(url)
          setShowMediaPicker(false)
        }}
      />
    </div>
  )
}
