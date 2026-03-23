'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Sparkles, Bot, RefreshCw, Paintbrush, Loader2, Clock, Image as ImageIcon, Download, Layout, Plus, X, Search, Star, Copy, User, Upload, Film } from 'lucide-react'
import { OVERLAY_TEMPLATES, getOverlayTemplate } from '@/lib/overlay-templates'
import type { OverlayOptions } from '@/lib/overlay-templates'
import { renderCustomOverlay } from '@/lib/custom-overlay-renderer'
import type { CustomOverlayTemplate } from '@/lib/custom-overlay-types'

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
]

const FORMATS: Record<string, { value: string; label: string }[]> = {
  instagram: [
    { value: 'feed', label: 'Feed-post' },
    { value: 'carousel', label: 'Karusell' },
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
  ],
  facebook: [
    { value: 'feed', label: 'Innlegg' },
    { value: 'story', label: 'Story' },
    { value: 'video', label: 'Video' },
  ],
  linkedin: [
    { value: 'feed', label: 'Innlegg' },
    { value: 'article', label: 'Artikkel' },
  ],
}

type GeneratedContent = {
  text: string | null
  caption: string | null
  headline: string | null
  subtitle: string | null
  hashtags: string[]
  image_url: string | null
  image_error: string | null
  best_time: string | null
  image_suggestion: string | null
}

type ImageStyleOption = {
  id: string
  name: string
  prompt: string
  is_default: boolean
}

const DEFAULT_IMAGE_STYLES: ImageStyleOption[] = [
  { id: 'scandinavian-photo', name: 'Fotorealistisk skandinavisk', prompt: '', is_default: true },
  { id: 'office-professional', name: 'Profesjonelt kontormiljø', prompt: '', is_default: true },
  { id: 'flat-illustration', name: 'Flat design illustrasjon', prompt: '', is_default: true },
  { id: 'product-minimal', name: 'Minimalistisk produktfoto', prompt: '', is_default: true },
  { id: 'nordic-outdoor', name: 'Utendørs nordisk natur', prompt: '', is_default: true },
]

type BrandColor = { hex: string; role: string }
type BrandFont = { family: string; role: string; weight: number }
type BrandProfile = {
  logo_url: string | null
  colors: BrandColor[]
  fonts: BrandFont[]
  name?: string
  tagline?: string
}

type MediaAsset = {
  id: string
  url: string
  thumbnail_url: string | null
  filename: string | null
  source: string
  is_favorite: boolean
  tags: string[]
}

const VARIANT_OPTIONS = [
  { value: 1, label: '1 bilde' },
  { value: 3, label: '3 varianter' },
  { value: 5, label: '5 varianter' },
]

export default function GeneratePage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [platform, setPlatform] = useState('instagram')
  const [format, setFormat] = useState('feed')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [generated, setGenerated] = useState<GeneratedContent | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [orgName, setOrgName] = useState('')
  const [imageStyles, setImageStyles] = useState<ImageStyleOption[]>(DEFAULT_IMAGE_STYLES)
  const [selectedStyle, setSelectedStyle] = useState('scandinavian-photo')
  const [selectedOverlay, setSelectedOverlay] = useState('modern-dark')
  const [customTemplates, setCustomTemplates] = useState<CustomOverlayTemplate[]>([])
  const [standardVisibility, setStandardVisibility] = useState<Record<string, boolean>>({})
  // Reference image
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [mediaSearch, setMediaSearch] = useState('')
  const [loadingMedia, setLoadingMedia] = useState(false)
  // Digital Twin
  const [digitalTwins, setDigitalTwins] = useState<{ id: string; name: string; trigger_word: string; status: string }[]>([])
  const [selectedTwin, setSelectedTwin] = useState<string | null>(null)
  const [twinGenerating, setTwinGenerating] = useState(false)
  const [twinImage, setTwinImage] = useState<string | null>(null)
  // Bulk generation
  const [variantCount, setVariantCount] = useState(1)
  const [bulkResults, setBulkResults] = useState<GeneratedContent[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(0)
  // Manual upload
  const [contentMode, setContentMode] = useState<'ai' | 'upload'>('ai')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image')
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [manualCaption, setManualCaption] = useState('')
  const [manualHeadline, setManualHeadline] = useState('')
  const [manualSubtitle, setManualSubtitle] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadOrg() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (profile) {
        setOrgId(profile.org_id)
        // Load brand profile
        const { data: bp } = await supabase
          .from('brand_profiles')
          .select('logo_url, colors, fonts, tagline')
          .eq('org_id', profile.org_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (bp) setBrand(bp)

        // Load digital twins
        const { data: twins } = await supabase
          .from('digital_twins')
          .select('id, name, trigger_word, status')
          .eq('tenant_id', profile.org_id)
          .eq('status', 'ready')
        if (twins) setDigitalTwins(twins)

        // Load custom overlay templates
        try {
          const res = await fetch('/api/overlay-templates')
          if (res.ok) {
            const customData = await res.json()
            setCustomTemplates(customData)
          }
        } catch { /* ignore */ }

        // Load standard template visibility settings
        try {
          const visRes = await fetch('/api/overlay-templates/visibility')
          if (visRes.ok) {
            const visData = await visRes.json()
            setStandardVisibility(visData)
          }
        } catch { /* ignore */ }

        // Load org name + settings
        const { data: org } = await supabase
          .from('organizations')
          .select('name, settings')
          .eq('id', profile.org_id)
          .single()
        if (org) {
          setOrgName(org.name || '')
          const settings = (org.settings as Record<string, unknown>) || {}
          const styles = (settings.image_styles as ImageStyleOption[])
          if (styles?.length) {
            setImageStyles(styles)
            setSelectedStyle((settings.active_image_style as string) || styles[0].id)
          }
        }
      }
    }
    loadOrg()
  }, [])

  // Load media library for picker
  const loadMediaForPicker = async () => {
    if (!orgId) return
    setLoadingMedia(true)
    try {
      const res = await fetch(`/api/media?org_id=${orgId}`)
      if (res.ok) {
        const data = await res.json()
        const allAssets: MediaAsset[] = [
          ...(data.assets || []),
          ...(data.storageImages || []).map((img: { url: string; name: string }) => ({
            id: img.url,
            url: img.url,
            thumbnail_url: null,
            filename: img.name,
            source: 'ai_generated',
            is_favorite: false,
            tags: [],
          })),
        ]
        setMediaAssets(allAssets)
      }
    } catch (err) {
      console.error('Load media error:', err)
    } finally {
      setLoadingMedia(false)
    }
  }

  const openMediaPicker = () => {
    setShowMediaPicker(true)
    loadMediaForPicker()
  }

  // Get the AI-generated headline
  const getHeadline = useCallback(() => {
    return generated?.headline || topic || ''
  }, [generated?.headline, topic])

  // Get the AI-generated subtitle
  const getSubtitle = useCallback(() => {
    return generated?.subtitle || ''
  }, [generated?.subtitle])

  // Render branded overlay on canvas using selected template
  const renderOverlay = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !generated?.image_url || !brand) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 1080
    canvas.width = size
    canvas.height = size

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    }

    try {
      const baseImage = await loadImage(generated.image_url)
      let logo: HTMLImageElement | null = null
      if (brand.logo_url) {
        try { logo = await loadImage(brand.logo_url) } catch { /* skip */ }
      }

      const primaryColor = brand.colors.find(c => c.role === 'primary')?.hex || '#9933ff'
      const accentColor = brand.colors.find(c => c.role === 'accent')?.hex || primaryColor
      const headingFont = brand.fonts.find(f => f.role === 'heading')?.family || 'Inter'
      const bodyFont = brand.fonts.find(f => f.role === 'body')?.family || headingFont

      const options: OverlayOptions = {
        size,
        baseImage,
        logo,
        headline: getHeadline(),
        subtitle: getSubtitle(),
        brandName: orgName,
        primaryColor,
        accentColor,
        headingFont,
        bodyFont,
      }

      // Check if it's a custom template
      const customTmpl = customTemplates.find(t => `custom-${t.id}` === selectedOverlay)
      if (customTmpl) {
        await renderCustomOverlay(ctx, customTmpl, options)
      } else {
        const template = getOverlayTemplate(selectedOverlay)
        await template.render(ctx, options)
      }
    } catch (err) {
      console.error('Overlay render error:', err)
    }
  }, [generated?.image_url, brand, orgName, getHeadline, getSubtitle, selectedOverlay, customTemplates])

  // Re-render overlay when image, brand, or template changes
  useEffect(() => {
    if (generated?.image_url && brand) {
      renderOverlay()
    }
  }, [generated?.image_url, brand, renderOverlay, selectedOverlay])

  const handleDownloadOverlay = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `post-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  useEffect(() => {
    const first = FORMATS[platform]?.[0]?.value
    if (first) setFormat(first)
  }, [platform])

  const handleGenerate = async (regenerateText = false, regenerateImage = false) => {
    if (!orgId) return
    setError(null)
    const isRegenerate = regenerateText || regenerateImage

    // Bulk generation
    if (!isRegenerate && variantCount > 1) {
      setBulkLoading(true)
      setLoading(true)
      setBulkResults([])
      setSelectedVariant(0)

      try {
        const promises = Array.from({ length: variantCount }, () =>
          fetch('/api/posts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              org_id: orgId,
              platform,
              format,
              topic: topic || undefined,
              image_style_id: selectedStyle,
              reference_image_url: referenceImageUrl || undefined,
              selected_overlay: selectedOverlay,
            }),
          }).then(r => r.json())
        )

        const results = await Promise.all(promises)
        const validResults = results.filter(r => r.success).map(r => r.generated)

        if (validResults.length > 0) {
          setBulkResults(validResults)
          setGenerated(validResults[0])
          setPostId(results.find(r => r.success)?.post?.id || null)
        } else {
          setError('Alle genereringer feilet')
        }
      } catch {
        setError('Nettverksfeil. Prøv igjen.')
      } finally {
        setLoading(false)
        setBulkLoading(false)
      }
      return
    }

    if (regenerateText) setLoadingText(true)
    else if (regenerateImage) setLoadingImage(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          platform,
          format,
          topic: topic || undefined,
          regenerate_text: regenerateText,
          regenerate_image: regenerateImage,
          post_id: isRegenerate ? postId : undefined,
          image_style_id: selectedStyle,
          reference_image_url: referenceImageUrl || undefined,
          selected_overlay: selectedOverlay,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Noe gikk galt')
        return
      }
      setPostId(data.post.id)
      if (isRegenerate) {
        setGenerated(prev => ({
          text: regenerateText ? data.generated.text : (prev?.text || null),
          caption: regenerateText ? data.generated.caption : (prev?.caption || null),
          headline: regenerateText ? data.generated.headline : (prev?.headline || null),
          subtitle: regenerateText ? data.generated.subtitle : (prev?.subtitle || null),
          hashtags: regenerateText ? data.generated.hashtags : (prev?.hashtags || []),
          image_url: regenerateImage ? data.generated.image_url : (prev?.image_url || null),
          image_error: regenerateImage ? (data.generated.image_error || null) : (prev?.image_error || null),
          best_time: regenerateText ? (data.generated.best_time || null) : (prev?.best_time || null),
          image_suggestion: regenerateText ? (data.generated.image_suggestion || null) : (prev?.image_suggestion || null),
        }))
      } else {
        setGenerated(data.generated)
        setBulkResults([])
      }
    } catch {
      setError('Nettverksfeil. Prøv igjen.')
    } finally {
      setLoading(false)
      setLoadingText(false)
      setLoadingImage(false)
    }
  }

  // "Lag lignende i annen vinkel" — use current image as reference
  const handleSimilarAngle = () => {
    if (generated?.image_url) {
      setReferenceImageUrl(generated.image_url)
      handleGenerate(false, true)
    }
  }

  // Filter media for picker
  const filteredMedia = mediaAssets.filter(a => {
    if (!mediaSearch) return true
    const q = mediaSearch.toLowerCase()
    return (a.filename?.toLowerCase().includes(q)) || a.tags.some(t => t.toLowerCase().includes(q))
  }).sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1
    if (!a.is_favorite && b.is_favorite) return 1
    return 0
  })

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileSelect = (file: File) => {
    setUploadFile(file)
    const isVideo = file.type.startsWith('video/')
    setUploadType(isVideo ? 'video' : 'image')
    const url = URL.createObjectURL(file)
    setUploadPreview(url)
    setUploadedUrl(null)
    // Auto-upload immediately
    handleManualUpload(file)
  }

  const handleManualUpload = async (file?: File) => {
    const targetFile = file || uploadFile
    if (!targetFile || !orgId) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', targetFile)
      formData.append('org_id', orgId)
      formData.append('type', targetFile.type.startsWith('video/') ? 'video' : 'image')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setUploadedUrl(data.url)
      } else {
        const errData = await res.json().catch(() => ({}))
        console.error('Upload failed:', errData)
        alert('Opplasting feilet: ' + (errData.error || 'Ukjent feil'))
      }
    } catch (e) {
      console.error('Upload error:', e)
      alert('Nettverksfeil ved opplasting')
    }
    setUploading(false)
  }

  const handleSaveManualPost = async () => {
    if (!orgId || !uploadedUrl) return
    setLoading(true)
    setError(null)
    try {
      const postData: Record<string, unknown> = {
        org_id: orgId,
        platform,
        format,
        content_text: manualCaption || '',
        caption: manualCaption || '',
        headline: manualHeadline || null,
        subtitle: manualSubtitle || null,
        status: 'pending_approval',
        ai_generated: false,
        media_type: uploadType,
        selected_overlay: selectedOverlay,
      }
      if (uploadType === 'video') {
        postData.video_url = uploadedUrl
      } else {
        postData.content_image_url = uploadedUrl
      }
      const { data: post, error: insertError } = await supabase.from('social_posts').insert(postData).select('id').single()
      if (insertError) {
        console.error('Save manual post error:', insertError)
        setError(`Kunne ikke lagre innlegget: ${insertError.message}`)
        setLoading(false)
        return
      }
      if (post) {
        setPostId(post.id)
        setGenerated({
          text: manualCaption,
          caption: manualCaption,
          headline: manualHeadline || null,
          subtitle: manualSubtitle || null,
          hashtags: [],
          image_url: uploadType === 'image' ? uploadedUrl : null,
          image_error: null,
          best_time: null,
          image_suggestion: null,
        })
      }
    } catch (err) {
      console.error('Save manual post error:', err)
      setError('Noe gikk galt ved lagring. Prøv igjen.')
    }
    setLoading(false)
  }

  const handleGenerateAIText = async () => {
    if (!orgId) return
    setLoadingText(true)
    setError(null)
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          platform,
          format,
          topic: manualCaption || undefined,
          generate_text_only: true,
          image_context_url: uploadedUrl || undefined,
        }),
      })
      if (!res.ok) {
        setError('AI-tekstgenerering feilet. Prøv igjen.')
        setLoadingText(false)
        return
      }
      const data = await res.json()
      if (data.generated) {
        setManualCaption(data.generated.caption || data.generated.text || '')
        if (data.generated.headline) setManualHeadline(data.generated.headline)
        if (data.generated.subtitle) setManualSubtitle(data.generated.subtitle)
      }
    } catch {
      setError('Nettverksfeil ved AI-tekstgenerering.')
    }
    setLoadingText(false)
  }

  return (
    <div className="animate-fade-in-up">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-flex items-center gap-1 transition-colors">
        <span>←</span> Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Generer innhold</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Config panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            {/* Content Mode Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setContentMode('ai')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  contentMode === 'ai'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Generer med AI
              </button>
              <button
                onClick={() => setContentMode('upload')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  contentMode === 'upload'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                Last opp selv
              </button>
            </div>

            <h2 className="font-semibold text-slate-900 mb-5">Innstillinger</h2>

            {/* Platform */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Plattform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={`px-3 py-4 rounded-xl text-sm font-medium transition-all duration-200 border flex flex-col items-center gap-2 ${
                        platform === p.value
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${platform === p.value ? 'text-indigo-600' : 'text-slate-400'}`} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Format */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS[platform]?.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      format === f.value
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual Upload Zone - only in upload mode */}
            {contentMode === 'upload' && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Last opp bilde eller video</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*,video/mp4,video/mov,video/webm'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) handleFileSelect(file)
                    }
                    input.click()
                  }}
                >
                  {uploadPreview ? (
                    <div className="space-y-3">
                      {uploadType === 'video' ? (
                        <video src={uploadPreview} className="w-full max-h-48 rounded-lg mx-auto object-contain" controls />
                      ) : (
                        <img src={uploadPreview} alt="Forhåndsvisning" className="w-full max-h-48 rounded-lg mx-auto object-contain" />
                      )}
                      <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                        {uploadType === 'video' ? <Film className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        <span>{uploadFile?.name}</span>
                        <span className="text-slate-400">({(uploadFile!.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadFile(null); setUploadPreview(null); setUploadedUrl(null) }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Fjern og velg ny
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm text-slate-500">Dra og slipp bilde eller video her</p>
                      <p className="text-xs text-slate-400">Eller klikk for å velge fil</p>
                      <p className="text-xs text-slate-400">Støtter JPG, PNG, WebP, MP4, MOV, WebM</p>
                    </div>
                  )}
                </div>

                {uploadFile && !uploadedUrl && (
                  <button
                    onClick={() => handleManualUpload()}
                    disabled={uploading}
                    className="mt-3 w-full bg-indigo-100 text-indigo-700 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Laster opp...' : 'Last opp fil'}
                  </button>
                )}

                {uploadedUrl && (
                  <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-100 text-center">
                    Fil lastet opp!
                  </div>
                )}

                {/* Caption and overlay text for manual uploads */}
                {uploadFile && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-slate-700">Bildetekst / caption</label>
                        <button
                          onClick={handleGenerateAIText}
                          disabled={loadingText}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all disabled:opacity-50"
                        >
                          {loadingText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          {loadingText ? 'Genererer...' : 'Generer tekst med AI'}
                        </button>
                      </div>
                      <textarea
                        value={manualCaption}
                        onChange={(e) => setManualCaption(e.target.value)}
                        placeholder="Skriv teksten til innlegget..."
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>
                    {uploadType === 'image' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Overlay-overskrift</label>
                          <input
                            type="text"
                            value={manualHeadline}
                            onChange={(e) => setManualHeadline(e.target.value)}
                            placeholder="Overskrift på bildet..."
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Undertekst</label>
                          <input
                            type="text"
                            value={manualSubtitle}
                            onChange={(e) => setManualSubtitle(e.target.value)}
                            placeholder="Undertekst på bildet..."
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Image Style - AI mode only */}
            {contentMode === 'ai' && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Bildestil</label>
                <div className="flex flex-wrap gap-2">
                  {imageStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                        selectedStyle === style.id
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reference Image - AI mode only */}
            {contentMode === 'ai' && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Referansebilde <span className="text-slate-400 font-normal">(valgfritt)</span>
              </label>
              {referenceImageUrl ? (
                <div className="relative inline-block">
                  <img src={referenceImageUrl} alt="Referansebilde" className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                  <button
                    onClick={() => setReferenceImageUrl(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={openMediaPicker}
                  className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Velg bilde</span>
                </button>
              )}
            </div>
            )}

            {/* Digital Twin - AI mode only */}
            {contentMode === 'ai' && digitalTwins.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Digital Twin <span className="text-slate-400 font-normal">(valgfritt)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSelectedTwin(null); setTwinImage(null) }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                      !selectedTwin
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Ingen
                  </button>
                  {digitalTwins.map(twin => (
                    <button
                      key={twin.id}
                      onClick={() => setSelectedTwin(twin.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                        selectedTwin === twin.id
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <User className="w-3 h-3" />
                      {twin.name}
                    </button>
                  ))}
                </div>
                {selectedTwin && (
                  <div className="mt-2">
                    <button
                      onClick={async () => {
                        const twin = digitalTwins.find(t => t.id === selectedTwin)
                        if (!twin) return
                        setTwinGenerating(true)
                        try {
                          const res = await fetch('/api/digital-twin/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              twin_id: twin.id,
                              prompt: `Professional portrait of ${twin.trigger_word} for social media, high quality, natural lighting`,
                              image_size: 'square',
                              num_images: 1,
                            }),
                          })
                          if (res.ok) {
                            const data = await res.json()
                            if (data.images?.[0]?.url) {
                              setTwinImage(data.images[0].url)
                              setReferenceImageUrl(data.images[0].url)
                            }
                          }
                        } catch { /* ignore */ }
                        setTwinGenerating(false)
                      }}
                      disabled={twinGenerating}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      {twinGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {twinGenerating ? 'Genererer portrett...' : 'Generer portrett som referansebilde'}
                    </button>
                    {twinImage && (
                      <img src={twinImage} alt="Twin-generert" className="w-20 h-20 rounded-xl object-cover border border-slate-200 mt-2" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Topic - AI mode only */}
            {contentMode === 'ai' && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tema <span className="text-slate-400 font-normal">(valgfritt)</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="F.eks. lansering av nytt produkt, kundehistorie, bransjetips..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all duration-200 hover:border-slate-300"
                />
              </div>
            )}

            {/* Variant count - AI mode only */}
            {contentMode === 'ai' && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Antall varianter</label>
                <div className="flex gap-2">
                  {VARIANT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setVariantCount(opt.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        variantCount === opt.value
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate / Save button */}
            {contentMode === 'ai' ? (
              <button
                onClick={() => handleGenerate()}
                disabled={loading || !orgId}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {bulkLoading ? `Genererer ${variantCount} varianter...` : 'Genererer...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {variantCount > 1 ? `Generer ${variantCount} varianter` : 'Generer innhold'}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSaveManualPost}
                disabled={loading || !orgId || !uploadedUrl}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3.5 rounded-xl font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Lagre innlegg
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="space-y-6">
          {!generated && !loading && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-slate-500">Velg plattform og format, så genererer vi innhold for deg</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Bot className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-slate-500">
                {bulkLoading ? `Genererer ${variantCount} varianter parallelt...` : 'Genererer tekst og bilde...'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Dette kan ta 10-30 sekunder</p>
            </div>
          )}

          {generated && (
            <>
              {/* Bulk variant selector */}
              {bulkResults.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Velg variant ({bulkResults.length} generert)</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {bulkResults.map((result, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedVariant(i); setGenerated(result) }}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedVariant === i
                            ? 'border-indigo-500 shadow-md ring-2 ring-indigo-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {result.image_url ? (
                          <img src={result.image_url} alt={`Variant ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-md font-medium">
                          {i + 1}
                        </span>
                        {selectedVariant === i && (
                          <div className="absolute top-1 left-1">
                            <Star className="w-4 h-4 fill-amber-500 text-amber-500 drop-shadow" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text result */}
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Tekst</h3>
                  <button
                    onClick={() => handleGenerate(true, false)}
                    disabled={loadingText}
                    className="text-sm px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 border border-purple-100"
                  >
                    {loadingText ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {loadingText ? 'Regenererer...' : 'Regenerer tekst'}
                  </button>
                </div>
                {generated.text ? (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {generated.text}
                    </pre>
                    {generated.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {generated.hashtags.map((tag, i) => (
                          <span key={i} className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Ingen tekst generert</p>
                )}
                {generated?.best_time && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 mt-3">
                    <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-800">Beste tidspunkt å poste</p>
                      <p className="text-xs text-amber-700">{generated.best_time}</p>
                    </div>
                  </div>
                )}
                {generated?.image_suggestion && (
                  <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200 mt-2">
                    <ImageIcon className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-purple-800">Bildeforslag</p>
                      <p className="text-xs text-purple-700">{generated.image_suggestion}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Image result with brand overlay */}
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Bilde med merkevare</h3>
                  <div className="flex gap-2">
                    {generated.image_url && (
                      <>
                        <button
                          onClick={handleDownloadOverlay}
                          className="text-sm px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all duration-200 flex items-center gap-1.5 border border-emerald-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Last ned
                        </button>
                        <button
                          onClick={handleSimilarAngle}
                          disabled={loadingImage}
                          className="text-sm px-3 py-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 border border-amber-100"
                          title="Lag lignende bilde i annen vinkel/setting"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Lignende
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleGenerate(false, true)}
                      disabled={loadingImage}
                      className="text-sm px-3 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5 border border-purple-100"
                    >
                      {loadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {loadingImage ? 'Regenererer...' : 'Regenerer bilde'}
                    </button>
                  </div>
                </div>
                {loadingImage ? (
                  <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                    <div className="text-center">
                      <Paintbrush className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                      <p className="text-sm text-slate-400 mt-3">Genererer nytt bilde...</p>
                    </div>
                  </div>
                ) : generated.image_url ? (
                  <div className="space-y-3">
                    {/* Branded overlay canvas */}
                    <canvas
                      ref={canvasRef}
                      className="w-full rounded-xl shadow-sm border border-slate-200"
                      style={{ aspectRatio: '1/1' }}
                    />

                    {/* Overlay template selector */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Layout className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-600">Velg overlay</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {customTemplates.filter(t => t.is_visible !== false).map((tmpl) => (
                          <button
                            key={tmpl.id}
                            onClick={() => setSelectedOverlay(`custom-${tmpl.id}`)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                              selectedOverlay === `custom-${tmpl.id}`
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-200'
                            }`}
                            title={tmpl.description || tmpl.name}
                          >
                            {tmpl.name}
                          </button>
                        ))}
                        {customTemplates.filter(t => t.is_visible !== false).length > 0 && (
                          <span className="text-slate-300 text-xs self-center">|</span>
                        )}
                        {OVERLAY_TEMPLATES.filter(t => standardVisibility[t.id] !== false).map((tmpl) => (
                          <button
                            key={tmpl.id}
                            onClick={() => setSelectedOverlay(tmpl.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                              selectedOverlay === tmpl.id
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                            }`}
                            title={tmpl.description}
                          >
                            {tmpl.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Raw image toggle */}
                    <details className="text-xs">
                      <summary className="text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
                        Vis originalbilde (uten overlay)
                      </summary>
                      <img
                        src={generated.image_url}
                        alt="Originalt AI-bilde"
                        className="w-full rounded-xl object-cover mt-2"
                      />
                    </details>
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex flex-col items-center justify-center border border-slate-200 gap-2">
                    <p className="text-sm text-slate-400">Ingen bilde generert</p>
                    {generated?.image_error && (
                      <p className="text-xs text-red-400 px-4 text-center">{generated.image_error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {postId && (
                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/posts/${postId}`}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl font-medium hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 text-center shadow-sm"
                  >
                    Se innlegg →
                  </Link>
                  <Link
                    href="/dashboard/posts"
                    className="flex-1 bg-white text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-all duration-200 text-center border border-slate-200"
                  >
                    Alle innlegg
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMediaPicker(false)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Velg referansebilde</h3>
              <button onClick={() => setShowMediaPicker(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={mediaSearch}
                  onChange={e => setMediaSearch(e.target.value)}
                  placeholder="Søk etter bilder..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingMedia ? (
                <div className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                </div>
              ) : filteredMedia.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filteredMedia.map((asset, i) => (
                    <button
                      key={asset.id || i}
                      onClick={() => {
                        setReferenceImageUrl(asset.url)
                        setShowMediaPicker(false)
                      }}
                      className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all group"
                    >
                      <img src={asset.thumbnail_url || asset.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {asset.is_favorite && (
                        <div className="absolute top-1 left-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 drop-shadow" />
                        </div>
                      )}
                      <span className={`absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        asset.source === 'ai_generated' ? 'bg-purple-500/80 text-white' :
                        'bg-black/50 text-white'
                      }`}>
                        {asset.source === 'ai_generated' ? 'AI' : asset.source === 'upload' ? 'Opp.' : asset.source}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-8">Ingen bilder funnet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
