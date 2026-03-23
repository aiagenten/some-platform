'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Upload, Film, Loader2, Download, Play, Trash2, Plus,
  CheckCircle2, FileVideo, Clock, Type, ArrowLeft
} from 'lucide-react'

type Segment = {
  id: string
  start: number
  end: number
  text: string
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function formatSRT(segments: Segment[]): string {
  return segments.map((seg, i) => {
    const start = formatTime(seg.start)
    const end = formatTime(seg.end)
    return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`
  }).join('\n')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function VideoUploadPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [burningSubtitles, setBurningSubtitles] = useState(false)
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null)
  const [savingPost, setSavingPost] = useState(false)
  const [savedPost, setSavedPost] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.org_id)
        setUserId(user.id)
      }
    }
    init()
  }, [])

  const handleFileSelect = (file: File) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm']
    if (!validTypes.includes(file.type)) {
      alert('Ugyldig filtype. Vennligst velg en MP4, MOV eller WebM fil.')
      return
    }
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setVideoPreviewUrl(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleUpload = async () => {
    if (!selectedFile || !orgId) return
    setUploading(true)
    setUploadProgress(0)

    try {
      const ext = selectedFile.name.split('.').pop() || 'mp4'
      const fileName = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) { clearInterval(progressInterval); return 90 }
          return prev + Math.random() * 15
        })
      }, 300)

      // Upload directly to Supabase Storage (no size limit from API route)
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        })

      clearInterval(progressInterval)

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
      setUploadedVideoUrl(urlData.publicUrl)
      setUploadProgress(100)

      setTimeout(() => {
        setStep(2)
      }, 500)
    } catch (err) {
      console.error('Upload error:', err)
      alert('Opplasting feilet. Vennligst prøv igjen.')
    } finally {
      setUploading(false)
    }
  }

  const handleTranscribe = async () => {
    if (!uploadedVideoUrl) return
    setTranscribing(true)

    try {
      const res = await fetch('/api/video/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: uploadedVideoUrl }),
      })

      if (!res.ok) throw new Error('Transkribering feilet')

      const data = await res.json()
      const transcribedSegments: Segment[] = (data.segments || []).map((seg: { start: number; end: number; text: string }, i: number) => ({
        id: `seg-${i}`,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }))

      setSegments(transcribedSegments)
      setStep(3)
    } catch (err) {
      console.error('Transcription error:', err)
      alert('Transkribering feilet. Vennligst prøv igjen.')
    } finally {
      setTranscribing(false)
    }
  }

  const updateSegmentText = (id: string, text: string) => {
    setSegments(prev => prev.map(seg => seg.id === id ? { ...seg, text } : seg))
  }

  const removeSegment = (id: string) => {
    setSegments(prev => prev.filter(seg => seg.id !== id))
  }

  const addSegment = () => {
    const lastSeg = segments[segments.length - 1]
    const newStart = lastSeg ? lastSeg.end : 0
    const newSeg: Segment = {
      id: `seg-${Date.now()}`,
      start: newStart,
      end: newStart + 3,
      text: '',
    }
    setSegments(prev => [...prev, newSeg])
  }

  const handleDownloadSRT = () => {
    const srtContent = formatSRT(segments)
    const blob = new Blob([srtContent], { type: 'text/srt' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '.srt') : 'subtitles.srt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleBurnSubtitles = async () => {
    if (!uploadedVideoUrl) return
    setBurningSubtitles(true)

    try {
      const res = await fetch('/api/video/burn-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: uploadedVideoUrl,
          segments: segments.map(seg => ({
            start: seg.start,
            end: seg.end,
            text: seg.text,
          })),
        }),
      })

      if (!res.ok) throw new Error('Innbrenning feilet')

      const data = await res.json()
      setProcessedVideoUrl(data.url)
    } catch (err) {
      console.error('Burn subtitles error:', err)
      alert('Innbrenning av undertekster feilet. Vennligst prøv igjen.')
    } finally {
      setBurningSubtitles(false)
    }
  }

  const handleSaveAsPost = async () => {
    if (!orgId || !userId) return
    setSavingPost(true)

    try {
      const videoUrl = processedVideoUrl || uploadedVideoUrl
      const { error } = await supabase.from('social_posts').insert({
        org_id: orgId,
        created_by: userId,
        content_text: segments.map(s => s.text).join(' '),
        caption: segments.map(s => s.text).join(' '),
        video_url: videoUrl,
        media_type: 'video',
        platform: 'instagram',
        format: 'reel',
        status: 'draft',
        ai_generated: false,
      })

      if (error) throw error
      setSavedPost(true)
    } catch (err) {
      console.error('Save post error:', err)
      alert('Lagring feilet. Vennligst prøv igjen.')
    } finally {
      setSavingPost(false)
    }
  }

  const stepItems = [
    { num: 1, label: 'Last opp' },
    { num: 2, label: 'Transkriber' },
    { num: 3, label: 'Rediger' },
    { num: 4, label: 'Eksporter' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-6 md:p-10">
      <div className="max-w-4xl mx-auto animate-fade-in-up">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Video &amp; undertekster</h1>
          <p className="text-slate-500 mt-1">Last opp video og generer undertekster automatisk</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {stepItems.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => { if (s.num < step) setStep(s.num) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  step === s.num
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : step > s.num
                    ? 'bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                disabled={s.num > step}
              >
                {step > s.num ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
                    {s.num}
                  </span>
                )}
                {s.label}
              </button>
              {i < stepItems.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.num ? 'bg-indigo-300' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Last opp video
            </h2>

            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                <FileVideo className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-700 font-medium mb-1">
                  Dra og slipp videofil her
                </p>
                <p className="text-slate-400 text-sm">
                  eller klikk for å velge fil (MP4, MOV, WebM)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Video preview */}
                {videoPreviewUrl && (
                  <div className="rounded-xl overflow-hidden bg-black">
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="w-full max-h-[400px] object-contain"
                    />
                  </div>
                )}

                {/* File info */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Film className="w-8 h-8 text-indigo-600" />
                    <div>
                      <p className="font-medium text-slate-900">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setVideoPreviewUrl(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Upload progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Laster opp...</span>
                      <span className="text-indigo-600 font-medium">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload button */}
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Laster opp...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Last opp video
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Transcription */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Type className="w-5 h-5 text-indigo-600" />
              Transkribering
            </h2>

            {uploadedVideoUrl && (
              <div className="rounded-xl overflow-hidden bg-black mb-6">
                <video
                  src={uploadedVideoUrl}
                  controls
                  className="w-full max-h-[300px] object-contain"
                />
              </div>
            )}

            {!transcribing && segments.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-4">
                  Klikk knappen under for å starte automatisk transkribering av videoen.
                </p>
                <button
                  onClick={handleTranscribe}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-8 rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                >
                  <Type className="w-5 h-5" />
                  Transkriber video
                </button>
              </div>
            )}

            {transcribing && (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-700 font-medium">Transkriberer med Whisper AI...</p>
                <p className="text-slate-400 text-sm mt-1">Dette kan ta noen minutter avhengig av videolengden</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Edit subtitles */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <Type className="w-5 h-5 text-indigo-600" />
                  Rediger undertekster
                </h2>
                <span className="text-sm text-slate-400">{segments.length} segmenter</span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {segments.map((seg) => (
                  <div key={seg.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                    <div className="flex-shrink-0 pt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-mono bg-white rounded-lg px-2 py-1 border border-slate-200">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                      </div>
                    </div>
                    <textarea
                      value={seg.text}
                      onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                      rows={2}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => removeSegment(seg.id)}
                      className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors pt-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addSegment}
                className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Legg til segment
              </button>
            </div>

            {/* SRT Preview */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">SRT forhåndsvisning</h3>
              <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-sm font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                {formatSRT(segments) || 'Ingen segmenter'}
              </pre>
            </div>

            <button
              onClick={() => setStep(4)}
              disabled={segments.length === 0}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Gå til eksport
            </button>
          </div>
        )}

        {/* Step 4: Export */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                Eksporter
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Download SRT */}
                <button
                  onClick={handleDownloadSRT}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-6 text-left transition-all group"
                >
                  <Download className="w-8 h-8 text-indigo-600 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-slate-900">Last ned SRT</h3>
                  <p className="text-sm text-slate-500 mt-1">Last ned undertekstfil i SRT-format</p>
                </button>

                {/* Burn subtitles */}
                <button
                  onClick={handleBurnSubtitles}
                  disabled={burningSubtitles}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-6 text-left transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {burningSubtitles ? (
                    <Loader2 className="w-8 h-8 text-indigo-600 mb-3 animate-spin" />
                  ) : (
                    <Film className="w-8 h-8 text-indigo-600 mb-3 group-hover:scale-110 transition-transform" />
                  )}
                  <h3 className="font-semibold text-slate-900">Brenn inn undertekster</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {burningSubtitles ? 'Brenner inn undertekster...' : 'Legg undertekster direkte på videoen'}
                  </p>
                </button>
              </div>
            </div>

            {/* Processed video preview */}
            {processedVideoUrl && (
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 animate-fade-in-up">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Play className="w-5 h-5 text-indigo-600" />
                  Ferdig video
                </h3>
                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    src={processedVideoUrl}
                    controls
                    className="w-full max-h-[400px] object-contain"
                  />
                </div>
              </div>
            )}

            {/* Save as post */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <button
                onClick={handleSaveAsPost}
                disabled={savingPost || savedPost}
                className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  savedPost
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {savingPost ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Lagrer...
                  </>
                ) : savedPost ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Lagret som innlegg
                  </>
                ) : (
                  'Lagre som innlegg'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
