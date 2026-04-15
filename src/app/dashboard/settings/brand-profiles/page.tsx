'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Linkedin, Facebook, Instagram, Plus, Star, StarOff,
  Trash2, Link2, Link2Off, ChevronDown, ChevronUp, Loader2, CheckCircle2
} from 'lucide-react'

type SocialAccount = {
  id: string
  platform: string
  account_name: string
  account_id: string
  token_expires_at: string | null
  metadata: Record<string, unknown>
}

type BrandProfileAccount = {
  id: string // junction id
  social_account_id: string
  platform: string
  is_default: boolean
  account: SocialAccount
}

type BrandProfile = {
  id: string
  name: string
  is_default: boolean
  created_at: string
  linked_accounts: BrandProfileAccount[]
}

const PLATFORM_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
}

const PLATFORM_COLOR: Record<string, string> = {
  linkedin: 'bg-sky-50 text-sky-700 border-sky-200',
  facebook: 'bg-blue-50 text-blue-700 border-blue-200',
  instagram: 'bg-pink-50 text-pink-700 border-pink-200',
}

export default function BrandProfilesSettingsPage() {
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [allAccounts, setAllAccounts] = useState<SocialAccount[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('users').select('org_id').eq('id', user.id).single()
    if (!profile) return
    const oid = profile.org_id
    setOrgId(oid)

    // Load all brand profiles with their linked accounts
    const { data: bps } = await supabase
      .from('brand_profiles')
      .select('id, name, is_default, created_at')
      .eq('org_id', oid)
      .order('is_default', { ascending: false })
      .order('created_at')

    // Load junction + social account details for all profiles
    const profileIds = (bps || []).map(p => p.id)
    const { data: junctionRows } = profileIds.length > 0
      ? await supabase
          .from('brand_profile_social_accounts')
          .select('id, brand_profile_id, social_account_id, platform, is_default')
          .in('brand_profile_id', profileIds)
      : { data: [] }

    const accountIds = Array.from(new Set((junctionRows || []).map(j => j.social_account_id)))
    const { data: accountRows } = accountIds.length > 0
      ? await supabase
          .from('social_accounts')
          .select('id, platform, account_name, account_id, token_expires_at, metadata')
          .in('id', accountIds)
      : { data: [] }

    const accountMap = Object.fromEntries((accountRows || []).map(a => [a.id, a]))

    const enrichedProfiles: BrandProfile[] = (bps || []).map(bp => ({
      ...bp,
      linked_accounts: (junctionRows || [])
        .filter(j => j.brand_profile_id === bp.id)
        .map(j => ({
          id: j.id,
          social_account_id: j.social_account_id,
          platform: j.platform,
          is_default: j.is_default,
          account: accountMap[j.social_account_id],
        }))
        .filter(j => j.account),
    }))

    // All org accounts (for linking)
    const { data: allAcc } = await supabase
      .from('social_accounts')
      .select('id, platform, account_name, account_id, token_expires_at, metadata')
      .eq('org_id', oid)
      .order('platform')
    const visible = (allAcc || []).filter(a => !(a.metadata as Record<string, unknown>)?.for_refresh)

    setProfiles(enrichedProfiles)
    setAllAccounts(visible)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Expand first profile by default
  useEffect(() => {
    if (profiles.length > 0 && !expandedProfile) {
      setExpandedProfile(profiles[0].id)
    }
  }, [profiles])

  async function createProfile() {
    if (!orgId || !newName.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('brand_profiles')
      .insert({ org_id: orgId, name: newName.trim(), is_default: profiles.length === 0 })
      .select('id')
      .single()
    if (!error && data) {
      setCreating(false)
      setNewName('')
      showToast('Brand-profil opprettet')
      await load()
      setExpandedProfile(data.id)
    }
    setSaving(false)
  }

  async function setDefaultProfile(profileId: string) {
    if (!orgId) return
    // Clear current default, then set new one
    await supabase
      .from('brand_profiles')
      .update({ is_default: false })
      .eq('org_id', orgId)
      .eq('is_default', true)
    await supabase
      .from('brand_profiles')
      .update({ is_default: true })
      .eq('id', profileId)
    showToast('Standard brand-profil endret')
    await load()
  }

  async function deleteProfile(profileId: string) {
    if (!confirm('Slett denne brand-profilen? Tilknyttede kontoer beholdes.')) return
    await supabase.from('brand_profiles').delete().eq('id', profileId)
    showToast('Brand-profil slettet')
    await load()
  }

  async function linkAccount(profileId: string, accountId: string, platform: string) {
    // Check if this is the first account for this platform in this profile — make it default
    const profile = profiles.find(p => p.id === profileId)
    const platformAccounts = profile?.linked_accounts.filter(a => a.platform === platform) || []
    const isFirst = platformAccounts.length === 0

    await supabase.from('brand_profile_social_accounts').upsert({
      brand_profile_id: profileId,
      social_account_id: accountId,
      platform,
      is_default: isFirst,
    }, { onConflict: 'brand_profile_id,social_account_id' })
    showToast('Konto koblet til profil')
    await load()
  }

  async function unlinkAccount(junctionId: string) {
    await supabase.from('brand_profile_social_accounts').delete().eq('id', junctionId)
    showToast('Konto fjernet fra profil')
    await load()
  }

  async function setDefaultAccount(profileId: string, platform: string, socialAccountId: string) {
    // Clear current default for this profile+platform
    await supabase
      .from('brand_profile_social_accounts')
      .update({ is_default: false })
      .eq('brand_profile_id', profileId)
      .eq('platform', platform)
      .eq('is_default', true)
    // Set new default
    await supabase
      .from('brand_profile_social_accounts')
      .update({ is_default: true })
      .eq('brand_profile_id', profileId)
      .eq('social_account_id', socialAccountId)
    showToast('Standardkonto endret')
    await load()
  }

  function connectAccount(profileId: string) {
    if (!orgId) return
    // Store brand_profile_id so OAuth callback can link the new account
    const state = Buffer.from(JSON.stringify({
      org_id: orgId,
      redirect_to: 'settings',
      brand_profile_id: profileId,
    })).toString('base64')
    // Show a picker — for now use LinkedIn (most common)
    // User can use the main accounts page for Facebook
    window.location.href = `/api/auth/linkedin?org_id=${orgId}&brand_profile_id=${profileId}&redirect_to=settings`
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Laster brand-profiler...</div>

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm animate-fade-in-up">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-semibold text-slate-900">Brand-profiler</h2>
          <p className="text-sm text-slate-500 mt-0.5">Hver profil har egne tilknyttede sosiale kontoer</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Ny profil
        </button>
      </div>

      {/* Create new profile inline form */}
      {creating && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-indigo-700 mb-1 block">Profilnavn</label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProfile()}
              placeholder="f.eks. «Personlig» eller «AI Agenten AS»"
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={createProfile}
            disabled={saving || !newName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Opprett'}
          </button>
          <button
            onClick={() => { setCreating(false); setNewName('') }}
            className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm"
          >
            Avbryt
          </button>
        </div>
      )}

      {profiles.length === 0 && !creating && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center shadow-sm">
          <p className="text-slate-400 text-sm">Ingen brand-profiler ennå</p>
          <p className="text-slate-400 text-xs mt-1">Opprett en profil for å koble til sosiale kontoer</p>
        </div>
      )}

      {/* Profile cards */}
      {profiles.map(profile => {
        const isExpanded = expandedProfile === profile.id
        // Accounts not yet linked to this profile
        const linkedIds = new Set(profile.linked_accounts.map(a => a.social_account_id))
        const unlinkable = allAccounts.filter(a => !linkedIds.has(a.id))

        return (
          <div key={profile.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {/* Profile header */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
            >
              <div className="flex-1 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-700 font-bold text-sm">{profile.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 text-sm">{profile.name}</span>
                    {profile.is_default && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium border border-indigo-200">Standard</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {profile.linked_accounts.length} konto{profile.linked_accounts.length !== 1 ? 'er' : ''} tilkoblet
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!profile.is_default && (
                  <button
                    onClick={e => { e.stopPropagation(); setDefaultProfile(profile.id) }}
                    className="text-xs text-slate-400 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
                    title="Sett som standard"
                  >
                    <StarOff className="w-3.5 h-3.5" />
                    Sett standard
                  </button>
                )}
                {profiles.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteProfile(profile.id) }}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Slett profil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />
                }
              </div>
            </div>

            {/* Expanded: linked accounts */}
            {isExpanded && (
              <div className="border-t border-slate-100 p-4 space-y-3">
                {profile.linked_accounts.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-2">Ingen kontoer koblet til denne profilen ennå</p>
                )}

                {profile.linked_accounts.map(la => {
                  const Icon = PLATFORM_ICON[la.platform] || Facebook
                  const color = PLATFORM_COLOR[la.platform] || PLATFORM_COLOR.facebook
                  const meta = la.account.metadata as Record<string, string>
                  return (
                    <div key={la.id} className={`flex items-center gap-3 p-3 rounded-xl border ${color}`}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">
                          {la.account.account_name}
                          {meta?.ig_username && <span className="text-slate-500 font-normal ml-1">@{meta.ig_username}</span>}
                        </p>
                        <p className="text-xs text-slate-500">{la.platform}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {la.is_default ? (
                          <span className="text-xs bg-white/80 border border-current px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Star className="w-3 h-3" /> Standard
                          </span>
                        ) : (
                          <button
                            onClick={() => setDefaultAccount(profile.id, la.platform, la.social_account_id)}
                            className="text-xs opacity-60 hover:opacity-100 px-2 py-0.5 rounded-full border border-current hover:bg-white/40 transition-all flex items-center gap-1"
                          >
                            <StarOff className="w-3 h-3" /> Sett standard
                          </button>
                        )}
                        <button
                          onClick={() => unlinkAccount(la.id)}
                          className="text-xs text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          title="Fjern fra profil"
                        >
                          <Link2Off className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Link existing accounts */}
                {unlinkable.length > 0 && (
                  <div className="border-t border-dashed border-slate-200 pt-3">
                    <p className="text-xs font-medium text-slate-500 mb-2">Koble eksisterende konto:</p>
                    <div className="flex flex-wrap gap-2">
                      {unlinkable.map(acc => {
                        const Icon = PLATFORM_ICON[acc.platform] || Facebook
                        return (
                          <button
                            key={acc.id}
                            onClick={() => linkAccount(profile.id, acc.id, acc.platform)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-all"
                          >
                            <Link2 className="w-3 h-3" />
                            <Icon className="w-3 h-3" />
                            {acc.account_name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Connect new account via OAuth */}
                <div className="border-t border-dashed border-slate-200 pt-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">Koble til ny konto:</p>
                  <div className="flex gap-2">
                    <a
                      href={`/api/auth/linkedin?org_id=${orgId}&brand_profile_id=${profile.id}&redirect_to=settings`}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium transition-all"
                    >
                      <Linkedin className="w-3.5 h-3.5" />
                      LinkedIn
                    </a>
                    <a
                      href={`/api/auth/facebook?org_id=${orgId}&brand_profile_id=${profile.id}&redirect_to=settings`}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-all"
                    >
                      <Facebook className="w-3.5 h-3.5" />
                      Facebook & Instagram
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
