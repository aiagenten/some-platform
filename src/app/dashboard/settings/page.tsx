'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

type BrandLearning = {
  id: string
  learning_type: string
  rule: string
  source: string
  confidence: number
  active: boolean
  created_at: string
}

type SocialAccount = {
  id: string
  platform: string
  account_name: string
  account_id: string
  token_expires_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
  connected_at: string
}

const PLATFORM_INFO: Record<string, { icon: string; label: string; color: string }> = {
  instagram: { icon: '📸', label: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  facebook: { icon: '📘', label: 'Facebook', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  linkedin: { icon: '💼', label: 'LinkedIn', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  tiktok: { icon: '🎵', label: 'TikTok', color: 'bg-gray-50 text-gray-700 border-gray-200' },
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Laster innstillinger...</div>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [learnings, setLearnings] = useState<BrandLearning[]>([])
  const [learningsLoading, setLearningsLoading] = useState(true)
  const [togglingLearning, setTogglingLearning] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const success = searchParams.get('success')
  const error = searchParams.get('error')
  const pagesCount = searchParams.get('pages')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('org_id, organizations(name)')
        .eq('id', user.id)
        .single()

      if (!profile) return
      setOrgId(profile.org_id)
      // @ts-expect-error - joined query
      setOrgName(profile.organizations?.name || '')

      // Fetch connected accounts (exclude user tokens used for refresh)
      const { data: accountsData } = await supabase
        .from('social_accounts')
        .select('id, platform, account_name, account_id, token_expires_at, scopes, metadata, connected_at')
        .eq('org_id', profile.org_id)
        .order('platform')

      // Filter out internal user tokens
      const visibleAccounts = (accountsData || []).filter(
        (a) => !(a.metadata as Record<string, unknown>)?.for_refresh
      )
      setAccounts(visibleAccounts)
      setLoading(false)

      // Fetch learnings
      const learningsRes = await fetch(`/api/posts/learn?org_id=${profile.org_id}`)
      if (learningsRes.ok) {
        const learningsJson = await learningsRes.json()
        setLearnings(learningsJson.learnings || [])
      }
      setLearningsLoading(false)
    }
    load()
  }, [])

  const handleConnectFacebook = () => {
    if (!orgId) return
    window.location.href = `/api/auth/facebook?org_id=${orgId}`
  }

  const handleToggleLearning = async (learningId: string, currentActive: boolean) => {
    setTogglingLearning(learningId)
    const res = await fetch('/api/posts/learn', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learning_id: learningId, active: !currentActive }),
    })
    if (res.ok) {
      setLearnings(prev =>
        prev.map(l => l.id === learningId ? { ...l, active: !currentActive } : l)
      )
    }
    setTogglingLearning(null)
  }

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Er du sikker på at du vil koble fra denne kontoen?')) return
    setDisconnecting(accountId)

    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', accountId)

    if (!error) {
      setAccounts(prev => prev.filter(a => a.id !== accountId))
    }
    setDisconnecting(null)
  }

  const getTokenStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { label: 'Ukjent', color: 'text-gray-500' }
    const expires = new Date(expiresAt)
    const now = new Date()
    const daysLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysLeft < 0) return { label: 'Utløpt', color: 'text-red-600' }
    if (daysLeft < 7) return { label: `${daysLeft}d igjen`, color: 'text-red-500' }
    if (daysLeft < 30) return { label: `${daysLeft}d igjen`, color: 'text-yellow-600' }
    return { label: `${daysLeft}d igjen`, color: 'text-green-600' }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Innstillinger</h1>
      <p className="text-gray-500 mb-8">{orgName}</p>

      {/* Status messages */}
      {success === 'connected' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          ✅ Facebook/Instagram tilkoblet! {pagesCount && `${pagesCount} side(r) funnet.`}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          ❌ Tilkobling feilet: {error}
        </div>
      )}

      {/* Connected accounts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Tilkoblede kontoer</h2>

        {loading ? (
          <p className="text-gray-400 text-sm">Laster...</p>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🔗</div>
            <p className="text-gray-500 text-sm">Ingen kontoer tilkoblet enda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const info = PLATFORM_INFO[account.platform] || PLATFORM_INFO.facebook
              const tokenStatus = getTokenStatus(account.token_expires_at)
              const meta = account.metadata as Record<string, string>

              return (
                <div
                  key={account.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${info.color}`}
                >
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {account.account_name}
                      {meta?.ig_username && (
                        <span className="text-gray-500 font-normal ml-1">@{meta.ig_username}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{info.label}</span>
                      <span>·</span>
                      <span className={tokenStatus.color}>{tokenStatus.label}</span>
                      <span>·</span>
                      <span>Koblet {new Date(account.connected_at).toLocaleDateString('nb-NO')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnecting === account.id}
                    className="text-xs text-red-500 hover:text-red-700 transition px-3 py-1.5 rounded hover:bg-red-50"
                  >
                    {disconnecting === account.id ? '...' : 'Koble fra'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Connect buttons */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Koble til plattformer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleConnectFacebook}
            disabled={!orgId}
            className="flex items-center gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition text-left disabled:opacity-50"
          >
            <span className="text-2xl">📘</span>
            <div>
              <p className="font-medium text-blue-800">Facebook & Instagram</p>
              <p className="text-xs text-blue-600">Koble til sider og IG Business-kontoer</p>
            </div>
          </button>

          <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 text-left opacity-60 cursor-not-allowed">
            <span className="text-2xl">💼</span>
            <div>
              <p className="font-medium text-gray-600">LinkedIn</p>
              <p className="text-xs text-gray-500">Kommer snart</p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Learnings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">🧠 Hva vi har lært</h2>
            <p className="text-xs text-gray-500 mt-1">
              AI-genererte regler basert på avvisninger, redigeringer og engasjement
            </p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {learnings.filter(l => l.active).length} aktive
          </span>
        </div>

        {learningsLoading ? (
          <p className="text-gray-400 text-sm py-4">Laster learnings...</p>
        ) : learnings.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">📚</div>
            <p className="text-gray-500 text-sm">Ingen learnings enda</p>
            <p className="text-gray-400 text-xs mt-1">
              Learnings genereres automatisk når innlegg avvises, redigeres eller presterer bra
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {learnings.map((learning) => {
              const sourceIcons: Record<string, string> = {
                rejection: '❌',
                edit: '✏️',
                analytics: '📈',
                manual: '👤',
              }
              const typeColors: Record<string, string> = {
                style: 'bg-purple-100 text-purple-700',
                tone: 'bg-blue-100 text-blue-700',
                topic: 'bg-green-100 text-green-700',
                format: 'bg-orange-100 text-orange-700',
                timing: 'bg-yellow-100 text-yellow-700',
              }

              return (
                <div
                  key={learning.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                    learning.active
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <span className="text-lg">{sourceIcons[learning.source] || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${learning.active ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                      {learning.rule}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[learning.learning_type] || 'bg-gray-100 text-gray-600'}`}>
                        {learning.learning_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.round(learning.confidence * 100)}% sikkerhet
                      </span>
                      <span className="text-xs text-gray-400">
                        · {new Date(learning.created_at).toLocaleDateString('nb-NO')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleLearning(learning.id, learning.active)}
                    disabled={togglingLearning === learning.id}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      learning.active ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                        learning.active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
