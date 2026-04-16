'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Palette, Upload, RefreshCw, Loader2, CheckCircle2, XCircle, Image as ImageIcon, Sparkles, AlertTriangle, Plus, Linkedin, Facebook, Instagram, Link2, Link2Off, Star, StarOff } from 'lucide-react'
import Link from 'next/link'

type BrandColor = {
  hex: string
  role: string
}

type BrandFont = {
  family: string
  role: string
  weight: number
}

type BrandVisualStyle = {
  border_radius?: string
  button_style?: {
    border_radius?: string
    has_shadow?: boolean
    has_gradient?: boolean
    is_outlined?: boolean
  }
  card_style?: {
    border_radius?: string
    has_shadow?: boolean
  }
  spacing_feel?: string
  visual_weight?: string
  layout_style?: string
  overall_vibe?: string
}

type BrandProfile = {
  id: string
  org_id: string
  name?: string
  is_default?: boolean
  created_at?: string
  colors: BrandColor[]
  fonts: BrandFont[]
  tone: string | null
  voice_description: string | null
  tone_keywords: string[]
  tagline: string | null
  description: string | null
  target_audience: string | null
  do_list: string[]
  dont_list: string[]
  key_messages: string[]
  logo_url: string | null
  source_url: string | null
  visual_style: BrandVisualStyle | null
}

type BrandAsset = {
  name: string
  url: string
}

type TrainingPost = {
  id: string
  platform: string
  content_text: string | null
  caption: string | null
  created_at: string
  status: string
  ai_generated: boolean
}

type Learning = {
  id: string
  rule: string
  learning_type: string
  active: boolean
  source_post_id: string | null
}

type SocialAccount = {
  id: string
  platform: string
  account_name: string
  account_id: string
  token_expires_at: string | null
  metadata: Record<string, unknown>
}

type BrandProfileAccount = {
  id: string
  social_account_id: string
  platform: string
  is_default: boolean
  account: SocialAccount
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

export default function BrandPage() {
  const [showMissingBanner, setShowMissingBanner] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [allBrands, setAllBrands] = useState<BrandProfile[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandProfile | null>(null)
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [trainingPosts, setTrainingPosts] = useState<TrainingPost[]>([])
  const [learnings, setLearnings] = useState<Learning[]>([])
  const [excludedPosts, setExcludedPosts] = useState<string[]>([])
  const [toneInput, setToneInput] = useState("")
  const [toneInputType, setToneInputType] = useState<"text" | "url">("url")
  const [addingTone, setAddingTone] = useState(false)
  const [toneSamples, setToneSamples] = useState<{ id: string; source_url: string | null; content_preview: string; source_type: string; created_at: string }[]>([])
  const [editingBorderRadius, setEditingBorderRadius] = useState(false)
  const [borderRadiusValue, setBorderRadiusValue] = useState('')
  const [linkedAccounts, setLinkedAccounts] = useState<BrandProfileAccount[]>([])
  const [allAccounts, setAllAccounts] = useState<SocialAccount[]>([])
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('missing') === '1') setShowMissingBanner(true)
    }
  }, [])

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

      // Load all brand profiles
      const { data: allBrandsData } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      setAllBrands(allBrandsData || [])

      // Select first profile or first default
      const initial = allBrandsData?.[0]
      if (initial) {
        setSelectedBrandId(initial.id)
        setBrand(initial)
      }

      // Load social accounts
      const { data: accountsData } = await supabase
        .from('social_accounts')
        .select('id, platform, account_name, account_id, token_expires_at, metadata')
        .eq('org_id', profile.org_id)
        .order('platform')

      const visible = (accountsData || []).filter(a => !(a.metadata as Record<string, unknown>)?.for_refresh)
      setAllAccounts(visible)

      // Load brand assets
      const { data: files } = await supabase.storage
        .from('brand-assets')
        .list(profile.org_id, { limit: 50 })

      if (files && files.length > 0) {
        const assetList = files.map((f) => {
          const { data: urlData } = supabase.storage
            .from('brand-assets')
            .getPublicUrl(`${profile.org_id}/${f.name}`)
          return { name: f.name, url: urlData.publicUrl }
        })
        setAssets(assetList)
      }

      const { data: postsData } = await supabase
        .from('social_posts')
        .select('id, platform, content_text, caption, created_at, status, ai_generated')
        .eq('org_id', profile.org_id)
        .in('status', ['approved', 'published'])
        .order('created_at', { ascending: false })
        .limit(20)

      setTrainingPosts(postsData || [])

      const { data: learningsData } = await supabase
        .from('brand_learnings')
        .select('id, rule, learning_type, active, source_post_id')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      setLearnings(learningsData || [])

      const { data: samplesData } = await supabase
        .from('tone_samples')
        .select('id, source_url, content_preview, source_type, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
      setToneSamples(samplesData || [])

      const inactivePostIds = (learningsData || [])
        .filter(l => !l.active && l.source_post_id)
        .map(l => l.source_post_id!)
      setExcludedPosts(Array.from(new Set(inactivePostIds)))

      setLoading(false)
    }
    load()
  }, [])

  // Load linked accounts when selected brand changes
  useEffect(() => {
    async function loadLinkedAccounts() {
      if (!selectedBrandId) return

      const { data: junctionRows } = await supabase
        .from('brand_profile_social_accounts')
        .select('id, social_account_id, platform, is_default')
        .eq('brand_profile_id', selectedBrandId)

      if (!junctionRows) return

      const accountIds = Array.from(new Set(junctionRows.map(j => j.social_account_id)))
      if (accountIds.length === 0) {
        setLinkedAccounts([])
        return
      }

      const { data: accountRows } = await supabase
        .from('social_accounts')
        .select('id, platform, account_name, account_id, token_expires_at, metadata')
        .in('id', accountIds)

      const accountMap = Object.fromEntries((accountRows || []).map(a => [a.id, a]))

      const enriched = (junctionRows || [])
        .map(j => ({
          id: j.id,
          social_account_id: j.social_account_id,
          platform: j.platform,
          is_default: j.is_default,
          account: accountMap[j.social_account_id],
        }))
        .filter(j => j.account)

      setLinkedAccounts(enriched)
    }

    loadLinkedAccounts()
  }, [selectedBrandId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId) return

    setUploading(true)
    setMessage(null)

    const ext = file.name.split('.').pop()
    const path = `${orgId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('brand-assets')
      .upload(path, file)

    if (error) {
      setMessage({ type: 'error', text: `Opplasting feilet: ${error.message}` })
    } else {
      const { data: urlData } = supabase.storage
        .from('brand-assets')
        .getPublicUrl(path)
      setAssets(prev => [...prev, { name: file.name, url: urlData.publicUrl }])
      setMessage({ type: 'success', text: 'Bilde lastet opp!' })
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRescrape = async () => {
    if (!orgId || !brand?.source_url) return
    setScraping(true)
    setMessage(null)

    try {
      const res = await fetch('/api/brand/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, website_url: brand.source_url }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.brand) setBrand(data.brand)
        setMessage({ type: 'success', text: 'Merkevare re-analysert!' })
      } else {
        setMessage({ type: 'error', text: 'Re-analyse feilet' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Nettverksfeil' })
    }

    setScraping(false)
  }

  const handleAddToneSample = async () => {
    if (!toneInput.trim() || !orgId) return
    setAddingTone(true)
    try {
      const res = await fetch("/api/brand/tone-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          [toneInputType]: toneInput.trim()
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: "success", text: `${data.rules_extracted} skrivestilregler ble hentet ut og lagt til i merkevaren!` })
        setToneInput("")
        const { data: samplesData } = await supabase.from("tone_samples").select("id, source_url, content_preview, source_type, created_at").eq("org_id", orgId).order("created_at", { ascending: false })
        setToneSamples(samplesData || [])
      } else {
        setMessage({ type: "error", text: data.error || "Noe gikk galt" })
      }
    } finally {
      setAddingTone(false)
    }
  }

  const handleToggleExclude = async (postId: string) => {
    const isCurrentlyExcluded = excludedPosts.includes(postId)

    setExcludedPosts(prev =>
      isCurrentlyExcluded ? prev.filter(id => id !== postId) : [...prev, postId]
    )

    const postLearnings = learnings.filter(l => l.source_post_id === postId)
    for (const learning of postLearnings) {
      await supabase
        .from('brand_learnings')
        .update({ active: isCurrentlyExcluded })
        .eq('id', learning.id)
    }

    setLearnings(prev => prev.map(l =>
      l.source_post_id === postId ? { ...l, active: isCurrentlyExcluded } : l
    ))
  }

  const handleCreateProfile = async () => {
    if (!orgId || !newProfileName.trim()) return
    setSavingProfile(true)
    const { data, error } = await supabase
      .from('brand_profiles')
      .insert({ org_id: orgId, name: newProfileName.trim(), is_default: allBrands.length === 0 })
      .select('*')
      .single()

    if (!error && data) {
      setCreatingProfile(false)
      setNewProfileName('')
      setMessage({ type: 'success', text: 'Ny merkevare opprettet!' })
      setAllBrands(prev => [data, ...prev])
      setSelectedBrandId(data.id)
      setBrand(data)
    } else {
      setMessage({ type: 'error', text: 'Kunne ikke opprett merkevare' })
    }
    setSavingProfile(false)
  }

  const handleLinkAccount = async (accountId: string, platform: string) => {
    if (!selectedBrandId) return
    const platformAccounts = linkedAccounts.filter(a => a.platform === platform)
    const isFirst = platformAccounts.length === 0

    await supabase.from('brand_profile_social_accounts').upsert({
      brand_profile_id: selectedBrandId,
      social_account_id: accountId,
      platform,
      is_default: isFirst,
    }, { onConflict: 'brand_profile_id,social_account_id' })

    setMessage({ type: 'success', text: 'Konto koblet!' })

    // Reload linked accounts
    const { data: junctionRows } = await supabase
      .from('brand_profile_social_accounts')
      .select('id, social_account_id, platform, is_default')
      .eq('brand_profile_id', selectedBrandId)

    if (junctionRows) {
      const accountIds = Array.from(new Set(junctionRows.map(j => j.social_account_id)))
      const { data: accountRows } = await supabase
        .from('social_accounts')
        .select('id, platform, account_name, account_id, token_expires_at, metadata')
        .in('id', accountIds)

      const accountMap = Object.fromEntries((accountRows || []).map(a => [a.id, a]))
      const enriched = (junctionRows || [])
        .map(j => ({
          id: j.id,
          social_account_id: j.social_account_id,
          platform: j.platform,
          is_default: j.is_default,
          account: accountMap[j.social_account_id],
        }))
        .filter(j => j.account)

      setLinkedAccounts(enriched)
    }
  }

  const handleUnlinkAccount = async (junctionId: string) => {
    await supabase.from('brand_profile_social_accounts').delete().eq('id', junctionId)
    setMessage({ type: 'success', text: 'Konto fjernet' })
    setLinkedAccounts(prev => prev.filter(a => a.id !== junctionId))
  }

  const handleSetDefaultAccount = async (platform: string, socialAccountId: string) => {
    if (!selectedBrandId) return

    // Clear current default for this profile+platform
    await supabase
      .from('brand_profile_social_accounts')
      .update({ is_default: false })
      .eq('brand_profile_id', selectedBrandId)
      .eq('platform', platform)
      .eq('is_default', true)

    // Set new default
    await supabase
      .from('brand_profile_social_accounts')
      .update({ is_default: true })
      .eq('brand_profile_id', selectedBrandId)
      .eq('social_account_id', socialAccountId)

    setMessage({ type: 'success', text: 'Standardkonto endret' })

    // Update local state
    setLinkedAccounts(prev => prev.map(a =>
      a.platform === platform
        ? { ...a, is_default: a.social_account_id === socialAccountId }
        : a
    ))
  }

  if (loading) {
    return (
      <div className="animate-fade-in-up flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Merkevare</h1>
          <p className="text-slate-500 text-sm mt-1">Administrer merkevare-profiler og sosiale kontoer</p>
        </div>
        <button
          onClick={() => setCreatingProfile(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all duration-200 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Opprett ny merkevare
        </button>
      </div>

      {showMissingBanner && allBrands.length === 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Merkevare må settes opp først</p>
            <p className="text-xs text-amber-700 mt-1">
              For å publisere innlegg må vi vite hvilke sosiale kontoer som hører til merkevaren din.
              Opprett en merkevare og koble til ønskede LinkedIn/Facebook-kontoer.
            </p>
          </div>
        </div>
      )}

      {/* Create profile form */}
      {creatingProfile && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-indigo-700 mb-1 block">Profilnavn</label>
            <input
              autoFocus
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProfile()}
              placeholder="f.eks. «Personlig» eller «AI Agenten AS»"
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={handleCreateProfile}
            disabled={savingProfile || !newProfileName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Opprett'}
          </button>
          <button
            onClick={() => { setCreatingProfile(false); setNewProfileName('') }}
            className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm"
          >
            Avbryt
          </button>
        </div>
      )}

      {/* Brand profile selector */}
      {allBrands.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 mb-2">Velg merkevare:</p>
          <div className="flex flex-wrap gap-2">
            {allBrands.map(bp => (
              <button
                key={bp.id}
                onClick={() => {
                  setSelectedBrandId(bp.id)
                  setBrand(bp)
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedBrandId === bp.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {bp.name || `Merkevare ${new Date(bp.created_at || '').toLocaleDateString('no-NO')}`}
                {bp.is_default && <span className="ml-1 text-xs opacity-75">(standard)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Re-onboarding banner */}
      {brand && (!brand.tone || !brand.description || brand.colors.length === 0) && (
        <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Merkevaren din mangler informasjon. Kjør onboarding på nytt for å fylle inn alt.</p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/20"
            >
              Start onboarding
            </Link>
          </div>
        </div>
      )}

      {!brand ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center shadow-sm">
          <Palette className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Ingen merkevare-profil funnet.</p>
          <p className="text-sm text-slate-400 mt-1">Opprett en ny merkevare for å komme i gang.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Social Account Linking */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Sosiale kontoer</h2>

            {linkedAccounts.length === 0 ? (
              <p className="text-slate-400 text-sm mb-4">Ingen kontoer koblet til denne merkevaren ennå.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {['linkedin', 'facebook', 'instagram'].map(platform => {
                  const platformAccounts = linkedAccounts.filter(a => a.platform === platform)
                  if (platformAccounts.length === 0) return null

                  const Icon = PLATFORM_ICON[platform] || Facebook
                  const color = PLATFORM_COLOR[platform] || PLATFORM_COLOR.facebook

                  return (
                    <div key={platform}>
                      <p className="text-xs font-medium text-slate-600 mb-2 capitalize">{platform}</p>
                      <div className="space-y-2">
                        {platformAccounts.map(acc => (
                          <div key={acc.id} className={`flex items-center gap-3 p-3 rounded-xl border ${color}`}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">
                                {acc.account.account_name}
                                {(acc.account.metadata as Record<string, string>)?.ig_username &&
                                  <span className="text-slate-500 font-normal ml-1">@{(acc.account.metadata as Record<string, string>).ig_username}</span>
                                }
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {acc.is_default ? (
                                <span className="text-xs bg-white/80 border border-current px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <Star className="w-3 h-3" /> Standard
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSetDefaultAccount(platform, acc.social_account_id)}
                                  className="text-xs opacity-60 hover:opacity-100 px-2 py-0.5 rounded-full border border-current hover:bg-white/40 transition-all flex items-center gap-1"
                                >
                                  <StarOff className="w-3 h-3" /> Sett standard
                                </button>
                              )}
                              <button
                                onClick={() => handleUnlinkAccount(acc.id)}
                                className="text-xs text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Link2Off className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Link account buttons */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-600 mb-3">Koble til kontoer:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {allAccounts.filter(acc => !linkedAccounts.some(la => la.social_account_id === acc.id)).map(acc => {
                  const Icon = PLATFORM_ICON[acc.platform] || Facebook
                  return (
                    <button
                      key={acc.id}
                      onClick={() => handleLinkAccount(acc.id, acc.platform)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-all"
                    >
                      <Link2 className="w-3 h-3" />
                      <Icon className="w-3 h-3" />
                      {acc.account_name}
                    </button>
                  )
                })}
              </div>

              {/* OAuth buttons */}
              <p className="text-xs font-medium text-slate-600 mb-2">Eller koble til ny konto:</p>
              <div className="flex gap-2">
                <a
                  href={`/api/auth/linkedin?org_id=${orgId}&brand_profile_id=${selectedBrandId}&redirect_to=dashboard/brand`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium transition-all"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                </a>
                <a
                  href={`/api/auth/facebook?org_id=${orgId}&brand_profile_id=${selectedBrandId}&redirect_to=dashboard/brand`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-all"
                >
                  <Facebook className="w-3.5 h-3.5" />
                  Facebook & Instagram
                </a>
              </div>
            </div>
          </div>
          {/* Brand Profile */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Merkevareprofil</h2>
              {brand?.source_url && (
                <button
                  onClick={handleRescrape}
                  disabled={scraping}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-all duration-200 disabled:opacity-50 border border-indigo-100"
                >
                  {scraping ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {scraping ? 'Analyserer...' : 'Re-analyser'}
                </button>
              )}
            </div>
            {(brand.tagline || brand.description) && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Merkenavn</p>
                <p className="text-lg font-semibold text-slate-900">{brand.tagline || brand.description?.split(".")[0]}</p>
              </div>
            )}
            {brand.description && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Beskrivelse</p>
                <p className="text-sm text-slate-700">{brand.description}</p>
              </div>
            )}
            {brand.target_audience && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Målgruppe</p>
                <p className="text-sm text-slate-700">{brand.target_audience}</p>
              </div>
            )}
            {brand.colors && brand.colors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Farger</p>
                <div className="flex flex-wrap gap-2">
                  {brand.colors.map((color, i) => {
                    const hex = color.hex
                    const role = color.role
                    const roleLabels: Record<string, string> = {
                      primary: 'Primær',
                      secondary: 'Sekundær',
                      accent: 'Aksent',
                      neutral_dark: 'Tekst mørk',
                      neutral_light: 'Tekst lys',
                    }
                    return (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div
                          className="w-5 h-5 rounded-md border border-slate-200"
                          style={{ backgroundColor: hex }}
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-mono text-slate-700">{hex}</span>
                          {role && roleLabels[role] && (
                            <span className="text-[10px] text-indigo-600 font-medium">{roleLabels[role]}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Visual Style — Border Radius & Design Elements */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Designelementer</h2>

            {/* Border Radius */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">Kantstil (border-radius)</p>
                <button
                  onClick={() => {
                    setEditingBorderRadius(!editingBorderRadius)
                    setBorderRadiusValue(brand.visual_style?.border_radius || '')
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {editingBorderRadius ? 'Avbryt' : 'Rediger'}
                </button>
              </div>

              {editingBorderRadius ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Skarpe', value: 'none', radius: '0px' },
                      { label: 'Litt avrundet', value: 'sm', radius: '8px' },
                      { label: 'Avrundet', value: 'lg', radius: '16px' },
                      { label: 'Veldig avrundet', value: '2xl', radius: '24px' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setBorderRadiusValue(opt.value)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                          borderRadiusValue === opt.value
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="w-12 h-8 bg-indigo-500"
                          style={{ borderRadius: opt.radius }}
                        />
                        <span className="text-xs text-slate-600">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={async () => {
                      if (!orgId || !brand) return
                      const updatedStyle = { ...(brand.visual_style || {}), border_radius: borderRadiusValue }
                      await supabase.from('brand_profiles').update({ visual_style: updatedStyle }).eq('id', brand.id)
                      setBrand({ ...brand, visual_style: updatedStyle })
                      setEditingBorderRadius(false)
                      setMessage({ type: 'success', text: 'Kantstil oppdatert!' })
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all"
                  >
                    Lagre
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {(() => {
                    const br = brand.visual_style?.border_radius
                    const labels: Record<string, string> = {
                      none: 'Skarpe kanter', '0': 'Skarpe kanter',
                      sm: 'Litt avrundede kanter', md: 'Avrundede kanter',
                      lg: 'Avrundede kanter', xl: 'Veldig avrundede kanter',
                      '2xl': 'Veldig avrundede kanter', '3xl': 'Pille-form',
                      full: 'Pille-form',
                    }
                    const radiusMap: Record<string, string> = {
                      none: '0px', '0': '0px', sm: '8px', md: '12px',
                      lg: '16px', xl: '20px', '2xl': '24px', '3xl': '32px', full: '9999px',
                    }
                    const displayLabel = br ? (labels[br.toLowerCase()] || br) : 'Ikke definert'
                    const displayRadius = br ? (radiusMap[br.toLowerCase()] || '8px') : '0px'
                    return (
                      <>
                        <div
                          className="w-16 h-10 bg-indigo-500 flex-shrink-0"
                          style={{ borderRadius: displayRadius }}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{displayLabel}</p>
                          {brand.visual_style?.button_style?.border_radius && (
                            <p className="text-xs text-slate-400">Knapper: {brand.visual_style.button_style.border_radius}</p>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Other visual style info */}
            {brand.visual_style && (
              <div className="flex flex-wrap gap-2 mt-3">
                {brand.visual_style.layout_style && (
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 capitalize">
                    {brand.visual_style.layout_style}
                  </span>
                )}
                {brand.visual_style.visual_weight && (
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 capitalize">
                    Visuell tyngde: {brand.visual_style.visual_weight}
                  </span>
                )}
                {brand.visual_style.spacing_feel && (
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 capitalize">
                    Spacing: {brand.visual_style.spacing_feel}
                  </span>
                )}
                {brand.visual_style.button_style?.has_shadow && (
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                    Skygge på knapper
                  </span>
                )}
                {brand.visual_style.button_style?.is_outlined && (
                  <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                    Outline-knapper
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tone of Voice */}
          {(brand.tone || brand.voice_description) && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-2">Tone og stemme</h2>
              {brand.tone && <p className="text-sm text-slate-700 mb-2"><span className="font-medium">Tone:</span> {brand.tone}</p>}
              {brand.voice_description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{brand.voice_description}</p>}
              {brand.tone_keywords && brand.tone_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {brand.tone_keywords.map((kw, i) => (
                    <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100">{kw}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Key Messages */}
          {brand.key_messages && brand.key_messages.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-3">Nøkkelbudskap</h2>
              <ul className="space-y-2">
                {brand.key_messages.map((msg, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Do / Don't */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {brand.do_list && brand.do_list.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <h2 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Gjør dette
                </h2>
                <ul className="space-y-2">
                  {brand.do_list.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {brand.dont_list && brand.dont_list.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <h2 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Unngå dette
                </h2>
                <ul className="space-y-2">
                  {brand.dont_list.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Logo Upload */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-slate-600" />
              Brand-bilder
            </h2>

            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition-all duration-200 disabled:opacity-50 border border-slate-200"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Laster opp...' : 'Last opp bilde'}
              </button>
            </div>

            {assets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {assets.map((asset, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Ingen bilder lastet opp enda</p>
            )}
          </div>

          {/* Treningsinnlegg */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-900">Treningsinnlegg</h2>
                <p className="text-sm text-slate-500 mt-0.5">Innlegg AI-en lærer av. Kun godkjente og publiserte innlegg vises.</p>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-700">{trainingPosts.length} innlegg</span>
              </div>
            </div>

            {trainingPosts.length > 0 ? (
              trainingPosts.map(post => {
                const postLearnings = learnings.filter(l => l.source_post_id === post.id)
                const isExcluded = excludedPosts.includes(post.id)

                return (
                  <div key={post.id} className={`p-4 rounded-xl border mb-3 transition-all ${isExcluded ? 'opacity-40 border-slate-200 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500 uppercase">{post.platform}</span>
                          {post.ai_generated && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI-generert</span>}
                          {postLearnings.length > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{postLearnings.length} læring{postLearnings.length > 1 ? 'er' : ''}</span>}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{post.caption || post.content_text || 'Ingen tekst'}</p>
                      </div>
                      <button
                        onClick={() => handleToggleExclude(post.id)}
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-all ${isExcluded ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}`}
                      >
                        {isExcluded ? 'Inkluder' : 'Fjern'}
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Ingen treningsinnlegg ennå. Publiser innlegg for å trene merkevaren.</p>
            )}
          </div>

          {/* Tone of Voice-eksempler */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-1">Tone of Voice-eksempler</h2>
            <p className="text-sm text-slate-500 mb-4">Legg til artikler, blogginnlegg eller tekster du har skrevet. AI-en analyserer stilen og bruker den som inspirasjon.</p>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setToneInputType("url")} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${toneInputType === "url" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-slate-200 text-slate-500"}`}>🔗 URL til artikkel</button>
              <button onClick={() => setToneInputType("text")} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${toneInputType === "text" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-slate-200 text-slate-500"}`}>📝 Lim inn tekst</button>
            </div>

            {toneInputType === "url" ? (
              <input
                type="url"
                value={toneInput}
                onChange={e => setToneInput(e.target.value)}
                placeholder="https://dinblogg.no/artikkel"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
              />
            ) : (
              <textarea
                value={toneInput}
                onChange={e => setToneInput(e.target.value)}
                placeholder="Lim inn tekst her (blogginnlegg, nyhetsbrev, artikkel...)..."
                rows={5}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-3 resize-none"
              />
            )}

            <button
              onClick={handleAddToneSample}
              disabled={addingTone || !toneInput.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {addingTone ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyserer...</> : <><Sparkles className="w-4 h-4" /> Analyser og legg til</>}
            </button>

            {toneSamples.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lagt til</p>
                {toneSamples.map(sample => (
                  <div key={sample.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-lg">{sample.source_type === "url" ? "🔗" : "📝"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{sample.source_url || "Innlimt tekst"}</p>
                      <p className="text-xs text-slate-400 truncate">{sample.content_preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Re-onboarding link */}
          <div className="text-center pt-2">
            <Link
              href="/onboarding"
              className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Kjør onboarding på nytt
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
