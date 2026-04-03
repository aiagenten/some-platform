'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import MediaPickerModal from '@/components/MediaPickerModal'
import SEOAnalysisPanel from '@/components/seo/SEOAnalysisPanel'
import SEOMetaFields from '@/components/seo/SEOMetaFields'
import AEOPanel from '@/components/seo/AEOPanel'
import SERPPreview from '@/components/seo/SERPPreview'
import {
  ArrowLeft, Save, Loader2, Globe, Download, Image as ImageIcon,
  FileText, Clock, Eye, Trash2, X
} from 'lucide-react'

const ArticleEditor = dynamic(() => import('@/components/ArticleEditor'), { ssr: false })

type Article = {
  id: string
  title: string
  slug: string
  content: Record<string, unknown> | null
  excerpt: string | null
  featured_image_url: string | null
  status: string
  wordpress_post_id: number | null
  metadata: Record<string, unknown>
  target_keyword: string | null
  meta_title: string | null
  meta_description: string | null
  seo_score: number | null
  seo_data: Record<string, unknown>
  aeo_schema: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type Integration = {
  platform: string
  wordpress_url: string | null
} | null

export default function ArticleEditorPage() {
  const { id } = useParams()
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [integration, setIntegration] = useState<Integration>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [mediaPickerMode, setMediaPickerMode] = useState<'inline' | 'featured'>('inline')
  const [showExport, setShowExport] = useState(false)
  const [exportHtml, setExportHtml] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // SEO fields as local state (debounced save)
  const [targetKeyword, setTargetKeyword] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')

  useEffect(() => {
    async function load() {
      const [articleRes, integrationRes] = await Promise.all([
        fetch(`/api/articles/${id}`),
        fetch('/api/integrations/website'),
      ])
      const articleData = await articleRes.json()
      const integrationData = await integrationRes.json()
      if (articleData.id) {
        setArticle(articleData)
        setTargetKeyword(articleData.target_keyword || '')
        setMetaTitle(articleData.meta_title || '')
        setMetaDescription(articleData.meta_description || '')
      }
      if (integrationData?.platform) setIntegration(integrationData)
      setLoading(false)
    }
    load()
  }, [id])

  const save = useCallback(async (updates: Partial<Article>) => {
    if (!article) return
    setSaving(true)
    const res = await fetch(`/api/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (data.id) {
      setArticle(data)
      setLastSaved(new Date())
    }
    setSaving(false)
  }, [article, id])

  const debouncedSave = useCallback((updates: Partial<Article>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => save(updates), 1500)
  }, [save])

  const handleContentChange = useCallback((json: Record<string, unknown>) => {
    if (!article) return
    setArticle(prev => prev ? { ...prev, content: json } : prev)
    debouncedSave({ content: json })
  }, [article, debouncedSave])

  // SEO field change handlers with debounced save
  const handleKeywordChange = useCallback((v: string) => {
    setTargetKeyword(v)
    debouncedSave({ target_keyword: v } as Partial<Article>)
  }, [debouncedSave])

  const handleMetaTitleChange = useCallback((v: string) => {
    setMetaTitle(v)
    debouncedSave({ meta_title: v } as Partial<Article>)
  }, [debouncedSave])

  const handleMetaDescriptionChange = useCallback((v: string) => {
    setMetaDescription(v)
    debouncedSave({ meta_description: v } as Partial<Article>)
  }, [debouncedSave])

  const handleSlugChange = useCallback((v: string) => {
    setArticle(prev => prev ? { ...prev, slug: v } : prev)
    debouncedSave({ slug: v })
  }, [debouncedSave])

  const handleAEOGenerated = useCallback((aeo: Record<string, unknown>) => {
    setArticle(prev => prev ? { ...prev, aeo_schema: aeo } : prev)
  }, [])

  const handleInsertFAQ = useCallback((faqs: { question: string; answer: string }[]) => {
    if (!article?.content) return
    // Build TipTap JSON nodes for FAQ section
    const faqNodes: Record<string, unknown>[] = [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Ofte stilte spørsmål' }],
      },
    ]
    for (const faq of faqs) {
      faqNodes.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: faq.question }],
      })
      faqNodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: faq.answer }],
      })
    }
    const existingContent = (article.content as { type: string; content?: unknown[] }) || { type: 'doc', content: [] }
    const newContent = {
      ...existingContent,
      content: [...(existingContent.content || []), ...faqNodes],
    }
    setArticle(prev => prev ? { ...prev, content: newContent } : prev)
    save({ content: newContent } as Partial<Article>)
  }, [article, save])

  const handlePublishToWordPress = async () => {
    if (!article) return
    await save({
      content: article.content,
      title: article.title,
      excerpt: article.excerpt,
      target_keyword: targetKeyword,
      meta_title: metaTitle,
      meta_description: metaDescription,
    } as Partial<Article>)
    setPublishing(true)
    const res = await fetch(`/api/articles/${id}/publish`, { method: 'POST' })
    const data = await res.json()
    setPublishing(false)
    if (data.success) {
      setArticle(prev => prev ? { ...prev, status: 'published', wordpress_post_id: data.wordpress_post_id } : prev)
      alert(`Publisert til WordPress! ${data.wordpress_url || ''}`)
    } else {
      alert(`Feil: ${data.error}`)
    }
  }

  const handleExportHtml = async () => {
    await save({ content: article?.content, title: article?.title } as Partial<Article>)
    const { generateHTML } = await import('@tiptap/html')
    const StarterKit = (await import('@tiptap/starter-kit')).default
    const ImageExt = (await import('@tiptap/extension-image')).default
    const LinkExt = (await import('@tiptap/extension-link')).default
    if (article?.content) {
      try {
        const html = generateHTML(article.content as Parameters<typeof generateHTML>[0], [
          StarterKit,
          ImageExt,
          LinkExt.configure({ openOnClick: false }),
        ])
        setExportHtml(`<!DOCTYPE html>
<html lang="nb">
<head><meta charset="UTF-8"><title>${article.title}</title></head>
<body>
<h1>${article.title}</h1>
${html}
</body>
</html>`)
        setShowExport(true)
      } catch {
        alert('Kunne ikke generere HTML')
      }
    }
  }

  const handleImageSelect = (url: string) => {
    if (mediaPickerMode === 'featured') {
      setArticle(prev => prev ? { ...prev, featured_image_url: url } : prev)
      save({ featured_image_url: url })
    } else {
      const editorEl = document.querySelector('.ProseMirror') as HTMLElement | null
      if (editorEl) {
        const event = new CustomEvent('insert-image', { detail: { url } })
        editorEl.dispatchEvent(event)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Artikkel ikke funnet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/articles')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Tilbake til artikler
        </button>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Lagret {lastSaved.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {saving && (
            <span className="text-xs text-indigo-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Lagrer...
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-3 space-y-4">
          {/* Title */}
          <input
            type="text"
            value={article.title}
            onChange={e => {
              setArticle(prev => prev ? { ...prev, title: e.target.value } : prev)
              debouncedSave({ title: e.target.value })
            }}
            placeholder="Tittel..."
            className="w-full text-3xl font-bold text-slate-900 bg-transparent border-none outline-none placeholder-slate-300"
          />

          {/* Excerpt */}
          <textarea
            value={article.excerpt || ''}
            onChange={e => {
              setArticle(prev => prev ? { ...prev, excerpt: e.target.value } : prev)
              debouncedSave({ excerpt: e.target.value })
            }}
            placeholder="Kort beskrivelse / utdrag..."
            rows={2}
            className="w-full text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
          />

          {/* TipTap Editor */}
          <ArticleEditor
            content={article.content}
            onChange={handleContentChange}
            onInsertImage={() => {
              setMediaPickerMode('inline')
              setShowMediaPicker(true)
            }}
          />

          {/* SEO & Meta Fields — collapsible section below editor */}
          <SEOMetaFields
            targetKeyword={targetKeyword}
            metaTitle={metaTitle}
            metaDescription={metaDescription}
            slug={article.slug || ''}
            title={article.title}
            onChangeKeyword={handleKeywordChange}
            onChangeMetaTitle={handleMetaTitleChange}
            onChangeMetaDescription={handleMetaDescriptionChange}
            onChangeSlug={handleSlugChange}
          />

          {/* SERP Preview */}
          <SERPPreview
            metaTitle={metaTitle || article.title}
            metaDescription={metaDescription}
            slug={article.slug || ''}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Status
            </h3>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                article.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                article.status === 'scheduled' ? 'bg-blue-50 text-blue-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {article.status === 'published' ? 'Publisert' :
                 article.status === 'scheduled' ? 'Planlagt' : 'Utkast'}
              </span>
              {article.wordpress_post_id && (
                <span className="text-xs text-blue-600 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> WP #{article.wordpress_post_id}
                </span>
              )}
            </div>

            {/* Save */}
            <button
              onClick={() => save({
                title: article.title,
                content: article.content,
                excerpt: article.excerpt,
                featured_image_url: article.featured_image_url,
                metadata: article.metadata,
                target_keyword: targetKeyword,
                meta_title: metaTitle,
                meta_description: metaDescription,
              } as Partial<Article>)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lagre utkast
            </button>

            {/* WordPress publish */}
            {integration?.platform === 'wordpress' && integration?.wordpress_url && (
              <button
                onClick={handlePublishToWordPress}
                disabled={publishing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {article.wordpress_post_id ? 'Oppdater på WordPress' : 'Publiser til WordPress'}
              </button>
            )}

            {/* Export HTML */}
            <button
              onClick={handleExportHtml}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Eksporter HTML
            </button>
          </div>

          {/* Featured image */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-400" />
              Fremhevet bilde
            </h3>
            {article.featured_image_url ? (
              <div className="relative">
                <img
                  src={article.featured_image_url}
                  alt="Featured"
                  className="w-full rounded-xl object-cover aspect-video"
                />
                <button
                  onClick={() => {
                    setArticle(prev => prev ? { ...prev, featured_image_url: null } : prev)
                    save({ featured_image_url: null })
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMediaPickerMode('featured')
                  setShowMediaPicker(true)
                }}
                className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
              >
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-xs font-medium">Velg bilde</span>
              </button>
            )}
          </div>

          {/* SEO Analysis Panel */}
          <SEOAnalysisPanel
            content={article.content}
            title={article.title}
            targetKeyword={targetKeyword}
            metaTitle={metaTitle}
            metaDescription={metaDescription}
          />

          {/* AEO Panel */}
          <AEOPanel
            articleId={article.id}
            aeoData={article.aeo_schema as never}
            onAEOGenerated={handleAEOGenerated}
            onInsertFAQ={handleInsertFAQ}
          />
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleImageSelect}
      />

      {/* Export HTML Modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Eksporter HTML</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(exportHtml)
                    alert('Kopiert til utklippstavlen!')
                  }}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  Kopier
                </button>
                <button onClick={() => setShowExport(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="bg-slate-50 rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap overflow-x-auto">
                {exportHtml}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
