'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Instagram, Facebook, Linkedin, Music, Link2, Bell, Brain, BookOpen, X, Pencil, TrendingUp, User, FileText, CheckCircle2, XCircle } from 'lucide-react'

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

const PLATFORM_INFO: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  instagram: { icon: Instagram, label: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  facebook: { icon: Facebook, label: 'Facebook', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  linkedin: { icon: Linkedin, label: 'LinkedIn', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  tiktok: { icon: Music, label: 'TikTok', color: 'bg-slate-50 text-slate-700 border-slate-200' },
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
  const [notifPrefs, setNotifPrefs] = useState({ email_on_approval: true, email_on_publish: true })
  const [notifLoading, setNotifLoading] = useState(true)
  const [savingNotif, setSavingNotif] = useState(false)
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

      const { data: accountsData } = await supabase
        .from('social_accounts')
        .select('id, platform, account_name, account_id, token_expires_at, scopes, metadata, connected_at')
        .eq('org_id', profile.org_id)
        .order('platform')

      const visibleAccounts = (accountsData || []).filter(
        (a) => !(a.metadata as Record<string, unknown>)?.for_refresh
      )
      setAccounts(visibleAccounts)
      setLoading(false)

      const learningsRes = await fetch(`/api/posts/learn?org_id=${profile.org_id}`)
      if (learningsRes.ok) {
        const learningsJson = await learningsRes.json()
        setLearnings(learningsJson.learnings || [])
      }
      setLearningsLoading(false)

      const notifRes = await fetch('/api/notifications/preferences')
      if (notifRes.ok) {
        const notifJson = await notifRes.json()
        setNotifPrefs(notifJson.preferences || { email_on_approval: true, email_on_publish: true })
      }
      setNotifLoading(false)
    }
    load()
  }, [])

  const handleConnectFacebook = () => {
    if (!orgId) return
    window.location.href = `/api/auth/facebook?org_id=${orgId}`
  }

  const handleNotifToggle = async (key: 'email_on_approval' | 'email_on_publish') => {
    setSavingNotif(true)
    const newPrefs = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(newPrefs)
    await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrefs),
    })
    setSavingNotif(false)
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
    if (!expiresAt) return { label: 'Ukjent', color: 'text-slate-500' }
    const expires = new Date(expiresAt)
    const now = new Date()
    const daysLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { label: 'Utløpt', color: 'text-red-600' }
    if (daysLeft < 7) return { label: `${daysLeft}d igjen`, color: 'text-red-500' }
    if (daysLeft < 30) return { label: `${daysLeft}d igjen`, color: 'text-amber-600' }
    return { label: `${daysLeft}d igjen`, color: 'text-emerald-600' }
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Innstillinger</h1>
      <p className="text-slate-500 mb-8">{orgName}</p>

      {/* Status messages */}
      {success === 'connected' && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          Facebook/Instagram tilkoblet! {pagesCount && `${pagesCount} side(r) funnet.`}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          Tilkobling feilet: {error}
        </div>
      )}

      {/* Connected accounts */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Tilkoblede kontoer</h2>

        {loading ? (
          <p className="text-slate-400 text-sm">Laster...</p>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <Link2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Ingen kontoer tilkoblet enda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const info = PLATFORM_INFO[account.platform] || PLATFORM_INFO.facebook
              const tokenStatus = getTokenStatus(account.token_expires_at)
              const meta = account.metadata as Record<string, string>
              const Icon = info.icon

              return (
                <div
                  key={account.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 hover:shadow-sm ${info.color}`}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/60">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {account.account_name}
                      {meta?.ig_username && (
                        <span className="text-slate-500 font-normal ml-1">@{meta.ig_username}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
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
                    className="text-xs text-red-500 hover:text-red-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
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
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Koble til plattformer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleConnectFacebook}
            disabled={!orgId}
            className="flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Facebook className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="font-medium text-blue-800">Facebook & Instagram</p>
              <p className="text-xs text-blue-600">Koble til sider og IG Business-kontoer</p>
            </div>
          </button>

          <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 text-left opacity-60 cursor-not-allowed">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="font-medium text-slate-600">LinkedIn</p>
              <p className="text-xs text-slate-500">Kommer snart</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mt-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-slate-600" />
          <h2 className="font-semibold text-slate-900">Varslinger</h2>
        </div>
        {notifLoading ? (
          <p className="text-slate-400 text-sm">Laster...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">E-post ved godkjenning</p>
                <p className="text-xs text-slate-500">Få varsel når innhold venter på godkjenning</p>
              </div>
              <button
                onClick={() => handleNotifToggle('email_on_approval')}
                disabled={savingNotif}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  notifPrefs.email_on_approval ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                    notifPrefs.email_on_approval ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">E-post ved publisering</p>
                <p className="text-xs text-slate-500">Få varsel når ditt innlegg blir publisert</p>
              </div>
              <button
                onClick={() => handleNotifToggle('email_on_publish')}
                disabled={savingNotif}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  notifPrefs.email_on_publish ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                    notifPrefs.email_on_publish ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Brand Learnings */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mt-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-slate-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Hva vi har lært</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                AI-genererte regler basert på avvisninger, redigeringer og engasjement
              </p>
            </div>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium border border-indigo-100">
            {learnings.filter(l => l.active).length} aktive
          </span>
        </div>

        {learningsLoading ? (
          <p className="text-slate-400 text-sm py-4">Laster learnings...</p>
        ) : learnings.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Ingen learnings enda</p>
            <p className="text-slate-400 text-xs mt-1">
              Learnings genereres automatisk når innlegg avvises, redigeres eller presterer bra
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {learnings.map((learning) => {
              const sourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
                rejection: X,
                edit: Pencil,
                analytics: TrendingUp,
                manual: User,
              }
              const typeColors: Record<string, string> = {
                style: 'bg-purple-50 text-purple-700 border-purple-100',
                tone: 'bg-blue-50 text-blue-700 border-blue-100',
                topic: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                format: 'bg-orange-50 text-orange-700 border-orange-100',
                timing: 'bg-amber-50 text-amber-700 border-amber-100',
              }
              const SourceIcon = sourceIcons[learning.source] || FileText

              return (
                <div
                  key={learning.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                    learning.active
                      ? 'border-slate-200 bg-white hover:shadow-sm'
                      : 'border-slate-100 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <SourceIcon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${learning.active ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                      {learning.rule}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-lg border ${typeColors[learning.learning_type] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                        {learning.learning_type}
                      </span>
                      <span className="text-xs text-slate-400">
                        {Math.round(learning.confidence * 100)}% sikkerhet
                      </span>
                      <span className="text-xs text-slate-400">
                        · {new Date(learning.created_at).toLocaleDateString('nb-NO')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleLearning(learning.id, learning.active)}
                    disabled={togglingLearning === learning.id}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      learning.active ? 'bg-indigo-600' : 'bg-slate-200'
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
