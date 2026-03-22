'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Instagram, Facebook, Linkedin, Music, Link2, CheckCircle2, XCircle, HardDrive, Cloud } from 'lucide-react'

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
  google_drive: { icon: HardDrive, label: 'Google Drive', color: 'bg-green-50 text-green-700 border-green-200' },
  onedrive: { icon: Cloud, label: 'OneDrive', color: 'bg-blue-50 text-blue-700 border-blue-200' },
}

export default function AccountsSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Laster...</div>}>
      <AccountsContent />
    </Suspense>
  )
}

function AccountsContent() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
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
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (!profile) return
      setOrgId(profile.org_id)

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
    }
    load()
  }, [])

  const handleConnectFacebook = () => {
    if (!orgId) return
    window.location.href = `/api/auth/facebook?org_id=${orgId}`
  }

  const handleConnectLinkedIn = () => {
    if (!orgId) return
    window.location.href = `/api/auth/linkedin?org_id=${orgId}`
  }

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Er du sikker på at du vil koble fra denne kontoen?')) return
    setDisconnecting(accountId)
    const { error } = await supabase.from('social_accounts').delete().eq('id', accountId)
    if (!error) setAccounts(prev => prev.filter(a => a.id !== accountId))
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
    <>
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
                <div key={account.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 hover:shadow-sm ${info.color}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/60">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {account.account_name}
                      {meta?.ig_username && <span className="text-slate-500 font-normal ml-1">@{meta.ig_username}</span>}
                      {account.platform === 'linkedin' && meta?.account_type === 'organization' && (
                        <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200 font-medium">Bedrift</span>
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
          <button onClick={handleConnectFacebook} disabled={!orgId} className="flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Facebook className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="font-medium text-blue-800">Facebook & Instagram</p>
              <p className="text-xs text-blue-600">Koble til sider og IG Business-kontoer</p>
            </div>
          </button>
          <button onClick={handleConnectLinkedIn} disabled={!orgId} className="flex items-center gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 transition-all duration-200 text-left disabled:opacity-50 hover:shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-sky-700" />
            </div>
            <div>
              <p className="font-medium text-sky-800">LinkedIn</p>
              <p className="text-xs text-sky-600">Koble til profil og bedriftssider</p>
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
