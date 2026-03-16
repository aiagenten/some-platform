'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import PlatformPreview from '@/components/PlatformPreview'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  format: string
  status: string
  scheduled_for: string | null
  content_image_url: string | null
  content_video_url: string | null
  hashtags: string[]
  media_urls: string[]
  ai_generated: boolean
  ai_prompt: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  published_at: string | null
  published_id: string | null
  created_at: string
  updated_at: string
}

type Feedback = {
  id: string
  action: string
  comment: string | null
  rejection_reason: string | null
  created_at: string
  given_by: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  pending_approval: 'bg-yellow-200 text-yellow-800',
  approved: 'bg-green-200 text-green-800',
  scheduled: 'bg-green-200 text-green-800',
  published: 'bg-blue-200 text-blue-800',
  rejected: 'bg-red-200 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  pending_approval: 'Venter på godkjenning',
  approved: 'Godkjent',
  scheduled: 'Planlagt',
  published: 'Publisert',
  rejected: 'Avvist',
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  linkedin: '💼',
  tiktok: '🎵',
}

export default function PostDetailPage() {
  const params = useParams()
  const postId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [post, setPost] = useState<Post | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Rejection state
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgLogo, setOrgLogo] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (profile) {
        setOrgId(profile.org_id)
        // Fetch org info for preview
        const { data: org } = await supabase
          .from('organizations')
          .select('name, logo_url')
          .eq('id', profile.org_id)
          .single()
        if (org) {
          setOrgName(org.name)
          setOrgLogo(org.logo_url)
        }
      }

      const { data: postData } = await supabase
        .from('social_posts')
        .select('*')
        .eq('id', postId)
        .single()

      if (postData) setPost(postData)

      const { data: feedbackData } = await supabase
        .from('content_feedback')
        .select('id, action, comment, rejection_reason, created_at, given_by')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (feedbackData) setFeedback(feedbackData)
      setLoading(false)
    }
    load()
  }, [postId])

  const handleApprove = async () => {
    if (!post || !userId || !orgId) return
    setActionLoading(true)

    await supabase
      .from('social_posts')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', post.id)

    await supabase
      .from('content_feedback')
      .insert({
        post_id: post.id,
        org_id: orgId,
        given_by: userId,
        action: 'approved',
        comment: 'Godkjent',
      })

    setPost({ ...post, status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
    setActionLoading(false)
  }

  const handleReject = async () => {
    if (!post || !userId || !orgId || !rejectComment.trim()) return
    setActionLoading(true)

    await supabase
      .from('social_posts')
      .update({
        status: 'rejected',
        rejection_reason: rejectComment,
      })
      .eq('id', post.id)

    await supabase
      .from('content_feedback')
      .insert({
        post_id: post.id,
        org_id: orgId,
        given_by: userId,
        action: 'rejected',
        rejection_reason: rejectComment,
        comment: rejectComment,
      })

    setPost({ ...post, status: 'rejected', rejection_reason: rejectComment })
    setShowRejectForm(false)
    setRejectComment('')
    setActionLoading(false)
  }

  const handlePublish = async () => {
    if (!post) return
    setPublishLoading(true)
    try {
      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setPost({ ...post, status: 'publishing' })
        // Poll for status update after a few seconds
        setTimeout(async () => {
          const { data: updated } = await supabase
            .from('social_posts')
            .select('*')
            .eq('id', post.id)
            .single()
          if (updated) setPost(updated)
        }, 5000)
      } else {
        alert(data.error || 'Publisering feilet')
      }
    } catch {
      alert('Nettverksfeil')
    } finally {
      setPublishLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!post) return
    setActionLoading(true)

    await supabase
      .from('social_posts')
      .update({ status: 'draft' })
      .eq('id', post.id)

    setPost({ ...post, status: 'draft' })
    setActionLoading(false)
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Laster...</div>
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Innlegg ikke funnet</p>
        <Link href="/dashboard/posts" className="text-blue-600 hover:underline mt-2 inline-block">
          ← Tilbake til innlegg
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link href="/dashboard/posts" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        ← Tilbake til innlegg
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Text preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PLATFORM_ICONS[post.platform] || '📱'}</span>
                <div>
                  <h2 className="font-semibold text-gray-900">{post.platform} · {post.format}</h2>
                  {post.scheduled_for && (
                    <p className="text-xs text-gray-400">
                      Planlagt: {new Date(post.scheduled_for).toLocaleString('nb-NO')}
                    </p>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[post.status]}`}>
                {STATUS_LABELS[post.status] || post.status}
              </span>
            </div>

            {/* Caption / Text */}
            <div className="prose prose-sm max-w-none">
              {post.caption && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tekst</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{post.caption}</p>
                </div>
              )}
              {post.content_text && post.content_text !== post.caption && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Innhold</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{post.content_text}</p>
                </div>
              )}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {post.hashtags.map((tag, i) => (
                    <span key={i} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {post.ai_generated && (
              <div className="mt-4 px-3 py-2 bg-purple-50 rounded-lg text-xs text-purple-700">
                🤖 AI-generert innlegg
                {post.ai_prompt && <span className="block mt-1 opacity-75">Prompt: {post.ai_prompt}</span>}
              </div>
            )}
          </div>

          {/* Image preview — separate as per Silje's recommendation */}
          {(post.content_image_url || (post.media_urls && post.media_urls.length > 0)) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Bilde</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {post.content_image_url && (
                  <img
                    src={post.content_image_url}
                    alt="Post bilde"
                    className="w-full rounded-lg object-cover"
                  />
                )}
                {post.media_urls?.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Media ${i + 1}`}
                    className="w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Video preview */}
          {post.content_video_url && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Video</h3>
              <video
                src={post.content_video_url}
                controls
                className="w-full rounded-lg"
              />
            </div>
          )}

          {/* E9: Platform Preview */}
          {(post.caption || post.content_text) && (
            <PlatformPreview
              caption={post.caption || post.content_text || ''}
              imageUrl={post.content_image_url}
              platform={post.platform}
              brandName={orgName}
              brandLogo={orgLogo}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Handlinger</h3>
            <div className="space-y-2">
              {(post.status === 'pending_approval' || post.status === 'draft') && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                  >
                    ✓ Godkjenn
                  </button>
                  <button
                    onClick={() => setShowRejectForm(!showRejectForm)}
                    disabled={actionLoading}
                    className="w-full bg-red-50 text-red-600 py-2.5 rounded-lg font-medium hover:bg-red-100 transition disabled:opacity-50"
                  >
                    ✗ Avvis med kommentar
                  </button>
                </>
              )}

              {showRejectForm && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Begrunn avvisningen..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <button
                    onClick={handleReject}
                    disabled={!rejectComment.trim() || actionLoading}
                    className="w-full bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                  >
                    Send avvisning
                  </button>
                </div>
              )}

              <button
                onClick={handleRegenerate}
                disabled={actionLoading}
                className="w-full bg-purple-50 text-purple-600 py-2.5 rounded-lg font-medium hover:bg-purple-100 transition disabled:opacity-50"
              >
                🔄 Regenerer
              </button>

              {/* E11: Publish button — only for approved posts */}
              {(post.status === 'approved' || post.status === 'scheduled') && (
                <button
                  onClick={handlePublish}
                  disabled={publishLoading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 mt-2"
                >
                  {publishLoading ? '⏳ Publiserer...' : '🚀 Publiser nå'}
                </button>
              )}

              {post.status === 'published' && post.published_at && (
                <div className="w-full bg-green-50 text-green-700 py-2.5 rounded-lg text-center text-sm font-medium mt-2">
                  ✓ Publisert {new Date(post.published_at).toLocaleString('nb-NO')}
                </div>
              )}

              {post.status === 'publishing' && (
                <div className="w-full bg-blue-50 text-blue-600 py-2.5 rounded-lg text-center text-sm font-medium mt-2 animate-pulse">
                  ⏳ Publisering pågår...
                </div>
              )}

              {post.status === 'failed' && (
                <div className="w-full bg-red-50 text-red-600 py-2.5 rounded-lg text-center text-sm font-medium mt-2">
                  ❌ Publisering feilet
                </div>
              )}
            </div>

            {/* Approval info */}
            {post.approved_at && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                Godkjent {new Date(post.approved_at).toLocaleString('nb-NO')}
              </div>
            )}
            {post.rejection_reason && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-red-600 mb-1">Avvisningsgrunn:</p>
                <p className="text-xs text-gray-600">{post.rejection_reason}</p>
              </div>
            )}
          </div>

          {/* Feedback history */}
          {feedback.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Tilbakemeldinger</h3>
              <div className="space-y-3">
                {feedback.map((fb) => (
                  <div key={fb.id} className="border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={
                        fb.action === 'approved' ? 'text-green-600' :
                        fb.action === 'rejected' ? 'text-red-600' :
                        'text-gray-600'
                      }>
                        {fb.action === 'approved' ? '✓ Godkjent' :
                         fb.action === 'rejected' ? '✗ Avvist' :
                         '✎ Redigert'}
                      </span>
                      <span>·</span>
                      <span>{new Date(fb.created_at).toLocaleString('nb-NO')}</span>
                    </div>
                    {(fb.comment || fb.rejection_reason) && (
                      <p className="text-xs text-gray-600 mt-1">
                        {fb.comment || fb.rejection_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
