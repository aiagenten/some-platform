'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Linkedin, Facebook, Instagram, Check, Loader2, PartyPopper, Palette, Type, MessageSquare, Target, ShieldCheck, ShieldX, Plus, X, Link2, Sparkles, CheckSquare, Square, ChevronDown, Upload, Image as ImageIcon } from 'lucide-react'

type BrandProfile = {
  colors: string[]
  fonts: string[]
  logo_url: string | null
  tone: string
  voice_description: string
  tone_keywords: string[]
  tagline: string
  description: string
  target_audience: string
  do_list: string[]
  dont_list: string[]
  key_messages: string[]
  industry: string
}

type ToneProfile = {
  tone: string
  typical_words: string[]
  emoji_usage: { uses_emojis: boolean; common_emojis: string[]; frequency: string }
  sentence_length: string
  dos: string[]
  donts: string[]
  good_examples: string[]
  voice_description: string
  tone_keywords: string[]
}

type SocialPost = {
  id: string
  text: string
  created_at: string
  image_url: string | null
  permalink: string | null
  likes: number
  comments: number
  shares: number
  platform: string
}

type ConnectedAccount = {
  platform: string
  account_id: string
  name: string
  access_token: string
}

const PLATFORM_CONFIG: Record<string, { icon: typeof Linkedin; color: string; bg: string }> = {
  linkedin: { icon: Linkedin, color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  facebook: { icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
}

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'border-sky-300 bg-sky-50 text-sky-700' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'border-pink-300 bg-pink-50 text-pink-700' },
]

const STEPS = [
  { num: 1, label: 'Plattformer' },
  { num: 2, label: 'SoMe-kontoer' },
  { num: 3, label: 'Nettside' },
  { num: 4, label: 'Merkevare' },
  { num: 5, label: 'Ferdig' },
]

export default function OnboardingPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    }>
      <OnboardingPage />
    </Suspense>
  )
}

function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('onboarding_platforms')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return []
  })
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // SoMe connection state
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('onboarding_accounts')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return []
  })
  const [fetchingPosts, setFetchingPosts] = useState(false)
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([])
  const [analyzingTone, setAnalyzingTone] = useState(false)
  const [toneProfile, setToneProfile] = useState<ToneProfile | null>(null)
  const [someError, setSomeError] = useState('')
  const [importedPostSelections, setImportedPostSelections] = useState<Record<string, boolean>>({})
  const [savingSelections, setSavingSelections] = useState(false)
  const [postsFetched, setPostsFetched] = useState(false)

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // LinkedIn company page selection state
  const [selectedLinkedInAccount, setSelectedLinkedInAccount] = useState<string | null>(null)
  const [publishToPersonal, setPublishToPersonal] = useState(false)
  const [manualCompanyId, setManualCompanyId] = useState('')
  const [addingManualCompany, setAddingManualCompany] = useState(false)

  // Meta page selection state
  const [selectedMetaPageId, setSelectedMetaPageId] = useState<string | null>(null)
  const [brandTag, setBrandTag] = useState('')

  useEffect(() => {
    async function getOrg() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (data) setOrgId(data.org_id)
    }
    getOrg()
  }, [])

  // Persist connected accounts to localStorage
  useEffect(() => {
    if (connectedAccounts.length > 0) {
      try { localStorage.setItem('onboarding_accounts', JSON.stringify(connectedAccounts)) } catch {}
    }
  }, [connectedAccounts])

  // Auto-select first LinkedIn organization account when accounts change
  useEffect(() => {
    const linkedInAccounts = connectedAccounts.filter(a => a.platform === 'linkedin')
    const firstOrg = linkedInAccounts.find(a => a.account_id.startsWith('organization:'))
    if (firstOrg && !selectedLinkedInAccount) {
      setSelectedLinkedInAccount(firstOrg.account_id)
    }
  }, [connectedAccounts, selectedLinkedInAccount])

  // Auto-select first Facebook page when Meta accounts change
  useEffect(() => {
    const facebookAccounts = connectedAccounts.filter(a => a.platform === 'facebook')
    if (facebookAccounts.length > 0 && !selectedMetaPageId) {
      setSelectedMetaPageId(facebookAccounts[0].account_id)
    }
  }, [connectedAccounts, selectedMetaPageId])

  // Auto-fill brand tag from first connected account name (if empty)
  useEffect(() => {
    if (brandTag) return
    const orgAccount = connectedAccounts.find(a => a.platform === 'linkedin' && a.account_id.startsWith('organization:'))
    if (orgAccount && orgAccount.name && !orgAccount.name.startsWith('Bedrift #')) {
      setBrandTag(orgAccount.name)
      return
    }
    const fbAccount = connectedAccounts.find(a => a.platform === 'facebook')
    if (fbAccount && fbAccount.name) {
      setBrandTag(fbAccount.name)
    }
  }, [connectedAccounts, brandTag])

  // Fetch posts from all connected accounts (filtered by selected Meta page)
  const fetchAllPosts = useCallback(async () => {
    if (connectedAccounts.length === 0) return
    setFetchingPosts(true)
    setSomeError('')

    try {
      const allPosts: SocialPost[] = []

      // Filter accounts: only selected Meta page + its Instagram, only selected LinkedIn account
      const accountsToFetch = connectedAccounts.filter(account => {
        if (account.platform === 'facebook') {
          return !selectedMetaPageId || account.account_id === selectedMetaPageId
        }
        if (account.platform === 'instagram') {
          if (!selectedMetaPageId) return true
          const allInstagram = connectedAccounts.filter(a => a.platform === 'instagram')
          if (allInstagram.length <= 1) return true
          const fbPages = connectedAccounts.filter(a => a.platform === 'facebook')
          const selectedFbIndex = fbPages.findIndex(a => a.account_id === selectedMetaPageId)
          const thisIgIndex = allInstagram.findIndex(a => a.account_id === account.account_id)
          return selectedFbIndex === thisIgIndex
        }
        if (account.platform === 'linkedin') {
          // Only fetch from the selected LinkedIn account (organization page)
          if (!selectedLinkedInAccount) return false
          return account.account_id === selectedLinkedInAccount
        }
        return true
      })

      for (const account of accountsToFetch) {
        try {
          const res = await fetch('/api/social/fetch-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: account.platform,
              access_token: account.access_token,
              account_id: account.account_id,
              org_id: orgId,
            }),
          })
          const data = await res.json()
          if (data.posts) {
            allPosts.push(...data.posts)
          }
        } catch (err) {
          console.error(`Error fetching ${account.platform} posts:`, err)
        }
      }

      setSocialPosts(allPosts)

      // Default all imported posts to selected as learning material
      const selections: Record<string, boolean> = {}
      allPosts.forEach(p => { selections[p.id] = true })
      setImportedPostSelections(selections)

      // Auto-analyze tone if we have posts with text
      const postsWithText = allPosts.filter(p => p.text && p.text.trim().length > 0)
      if (postsWithText.length > 0) {
        setAnalyzingTone(true)
        try {
          const toneRes = await fetch('/api/brand/analyze-tone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              posts: postsWithText,
              org_id: orgId,
            }),
          })
          const toneData = await toneRes.json()
          if (toneData.tone_profile) {
            setToneProfile(toneData.tone_profile)
          }
        } catch (err) {
          console.error('Tone analysis error:', err)
        }
        setAnalyzingTone(false)
      }
    } catch (err) {
      console.error('Post fetch error:', err)
      setSomeError('Kunne ikke hente poster. Prøv igjen.')
    }

    setFetchingPosts(false)
    setPostsFetched(true)
  }, [connectedAccounts, orgId, selectedMetaPageId, selectedLinkedInAccount])

  // Check for Facebook or LinkedIn callback params on mount — just save accounts, don't fetch posts
  useEffect(() => {
    const fbConnected = searchParams.get('fb_connected')
    const liConnected = searchParams.get('li_connected')
    const accountsParam = searchParams.get('accounts')

    if ((fbConnected === 'true' || liConnected === 'true') && accountsParam) {
      try {
        const accounts: ConnectedAccount[] = JSON.parse(decodeURIComponent(accountsParam))
        setStep(2) // Go to SoMe step

        // Merge with existing connected accounts (don't fetch posts yet — wait for user to click 'Hent poster')
        setConnectedAccounts(prev => {
          const existing = new Set(prev.map(a => `${a.platform}-${a.account_id}`))
          const merged = [...prev]
          for (const acc of accounts) {
            if (!existing.has(`${acc.platform}-${acc.account_id}`)) {
              merged.push(acc)
            }
          }
          return merged
        })

        // Clean URL
        const url = new URL(window.location.href)
        url.searchParams.delete('fb_connected')
        url.searchParams.delete('li_connected')
        url.searchParams.delete('accounts')
        url.searchParams.delete('pages')
        window.history.replaceState({}, '', url.pathname)
      } catch {
        console.error('Failed to parse accounts from callback')
      }
    }
  }, [searchParams])

  const startFacebookOAuth = () => {
    if (!orgId) return
    window.location.href = `/api/auth/facebook?org_id=${orgId}&redirect_to=onboarding`
  }

  const startLinkedInOAuth = () => {
    if (!orgId) return
    window.location.href = `/api/auth/linkedin?org_id=${orgId}&redirect_to=onboarding`
  }

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
      try { localStorage.setItem('onboarding_platforms', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleScrape = async () => {
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch('/api/brand/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, org_id: orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setScrapeError(data.error || 'Kunne ikke analysere nettsiden')
        setScraping(false)
        return
      }

      // Merge tone profile data into brand profile if available
      if (toneProfile) {
        data.tone = data.tone || toneProfile.tone
        data.voice_description = data.voice_description || toneProfile.voice_description
        data.tone_keywords = Array.from(
          new Set([...(data.tone_keywords || []), ...(toneProfile.tone_keywords || [])])
        ).slice(0, 8)
        data.do_list = Array.from(
          new Set([...(data.do_list || []), ...(toneProfile.dos || [])])
        ).slice(0, 8)
        data.dont_list = Array.from(
          new Set([...(data.dont_list || []), ...(toneProfile.donts || [])])
        ).slice(0, 8)
      }

      setBrandProfile(data)
      setStep(4)
    } catch {
      setScrapeError('Nettverksfeil. Prøv igjen.')
    }
    setScraping(false)
  }

  const handleFinish = async () => {
    if (!orgId || !brandProfile) return
    setSaving(true)
    await supabase.from('brand_profiles').upsert({
      org_id: orgId,
      source_url: websiteUrl,
      colors: brandProfile.colors,
      fonts: brandProfile.fonts,
      logo_url: brandProfile.logo_url,
      tagline: brandProfile.tagline,
      description: brandProfile.description,
      tone: brandProfile.tone,
      voice_description: brandProfile.voice_description,
      tone_keywords: brandProfile.tone_keywords,
      target_audience: brandProfile.target_audience,
      key_messages: brandProfile.key_messages,
      do_list: brandProfile.do_list,
      dont_list: brandProfile.dont_list,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })

    for (const platform of selectedPlatforms) {
      await supabase.from('social_accounts').upsert({
        org_id: orgId,
        platform,
        account_name: `${platform}-pending`,
        account_id: `pending-${platform}-${orgId}`,
      }, { onConflict: 'org_id,platform,account_id' })
    }

    setSaving(false)
    try {
      localStorage.removeItem('onboarding_platforms')
      localStorage.removeItem('onboarding_accounts')
    } catch {}
    router.push('/dashboard')
  }

  const updateBrandField = (field: keyof BrandProfile, value: unknown) => {
    if (!brandProfile) return
    setBrandProfile({ ...brandProfile, [field]: value })
  }

  const updateListItem = (field: 'do_list' | 'dont_list' | 'colors' | 'fonts' | 'tone_keywords' | 'key_messages', index: number, value: string) => {
    if (!brandProfile) return
    const list = [...(brandProfile[field] as string[])]
    list[index] = value
    setBrandProfile({ ...brandProfile, [field]: list })
  }

  const addListItem = (field: 'do_list' | 'dont_list' | 'colors' | 'fonts' | 'tone_keywords' | 'key_messages') => {
    if (!brandProfile) return
    setBrandProfile({ ...brandProfile, [field]: [...(brandProfile[field] as string[]), ''] })
  }

  const removeListItem = (field: 'do_list' | 'dont_list' | 'colors' | 'fonts' | 'tone_keywords' | 'key_messages', index: number) => {
    if (!brandProfile) return
    const list = [...(brandProfile[field] as string[])]
    list.splice(index, 1)
    setBrandProfile({ ...brandProfile, [field]: list })
  }

  const progressPercent = ((step - 1) / (STEPS.length - 1)) * 100

  const hasFacebookOrInstagram = selectedPlatforms.includes('facebook') || selectedPlatforms.includes('instagram')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with progress */}
      <div className="bg-white border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              SoMe
            </span>
            <span className="text-sm text-slate-500">Steg {step} av {STEPS.length}</span>
          </div>
          {/* Progress bar */}
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Step labels */}
          <div className="flex justify-between mt-2">
            {STEPS.map((s) => (
              <span
                key={s.num}
                className={`text-xs font-medium transition-colors ${
                  s.num <= step ? 'text-indigo-600' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Step 1: Platforms */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Velg plattformer</h2>
              <p className="text-slate-500">Hvilke sosiale medier vil du bruke?</p>
            </div>
            <div className="max-w-md mx-auto space-y-3">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                const selected = selectedPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-200 ${
                      selected
                        ? `${p.color} shadow-md`
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${selected ? '' : 'text-slate-400'}`} />
                    <span className={`font-medium ${selected ? '' : 'text-slate-700'}`}>{p.label}</span>
                    {selected && (
                      <div className="ml-auto w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-indigo-600" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="max-w-md mx-auto mt-8">
              <button
                onClick={() => setStep(2)}
                disabled={selectedPlatforms.length === 0}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                Neste
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Connect SoMe accounts */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Koble dine SoMe-kontoer</h2>
              <p className="text-slate-500">
                Vi henter eksisterende poster for å analysere din tone-of-voice.
              </p>
            </div>
            <div className="max-w-lg mx-auto">
              {/* Facebook/Instagram OAuth */}
              {hasFacebookOrInstagram && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Facebook className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Facebook & Instagram</h3>
                      <p className="text-sm text-slate-500">Koble til via Facebook for begge plattformer</p>
                    </div>
                  </div>

                  {connectedAccounts.some(a => a.platform === 'facebook' || a.platform === 'instagram') ? (
                    <div className="mb-4">
                      {/* Meta page selector - group by Facebook page */}
                      {connectedAccounts.filter(a => a.platform === 'facebook').length > 1 ? (
                        <div className="space-y-2 mb-3">
                          <p className="text-sm text-slate-600 mb-2">Velg hvilken side du vil bygge merkevare for:</p>
                          {connectedAccounts.filter(a => a.platform === 'facebook').map((fbAcc) => {
                            const fbPages = connectedAccounts.filter(a => a.platform === 'facebook')
                            const fbIndex = fbPages.findIndex(a => a.account_id === fbAcc.account_id)
                            const allInstagram = connectedAccounts.filter(a => a.platform === 'instagram')
                            const linkedIg = allInstagram[fbIndex] || null
                            const isSelected = selectedMetaPageId === fbAcc.account_id
                            return (
                              <button
                                key={`meta-page-${fbAcc.account_id}`}
                                onClick={() => setSelectedMetaPageId(fbAcc.account_id)}
                                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all text-left ${
                                  isSelected
                                    ? 'border-blue-400 bg-blue-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-blue-500' : 'border-slate-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Facebook className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-slate-900">{fbAcc.name}</span>
                                    {linkedIg && (
                                      <>
                                        <span className="text-slate-300">|</span>
                                        <Instagram className="w-4 h-4 text-pink-600" />
                                        <span className="text-sm text-slate-600">{linkedIg.name}</span>
                                      </>
                                    )}
                                  </div>

                                </div>
                                {isSelected && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-medium shrink-0">
                                    Valgt
                                  </span>
                                )}
                              </button>
                            )
                          })}
                          <p className="text-xs text-slate-500 mt-2">
                            Velg hvilken side du vil bygge merkevare for. Du kan legge til flere merkevarer senere.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {connectedAccounts.filter(a => a.platform === 'facebook' || a.platform === 'instagram').map((acc) => (
                            <div key={`${acc.platform}-${acc.account_id}`} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm text-emerald-700 font-medium capitalize">{acc.platform}</span>
                              <span className="text-sm text-emerald-600">— {acc.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={startFacebookOAuth}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all duration-200"
                    >
                      <Link2 className="w-4 h-4" />
                      Koble til Facebook / Instagram
                    </button>
                  )}
                </div>
              )}

              {/* LinkedIn OAuth */}
              {selectedPlatforms.includes('linkedin') && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center">
                      <Linkedin className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">LinkedIn</h3>
                      <p className="text-sm text-slate-500">Velg bedriftsside for publisering</p>
                    </div>
                  </div>

                  {connectedAccounts.some(a => a.platform === 'linkedin') ? (
                    <>
                      {/* Account selection */}
                      <div className="space-y-2 mb-4">
                        {connectedAccounts.filter(a => a.platform === 'linkedin').map((acc) => {
                          const isOrg = acc.account_id.startsWith('organization:')
                          const isSelected = selectedLinkedInAccount === acc.account_id
                          return (
                            <button
                              key={`${acc.platform}-${acc.account_id}`}
                              onClick={() => setSelectedLinkedInAccount(acc.account_id)}
                              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border-2 transition-all text-left ${
                                isSelected
                                  ? 'border-sky-400 bg-sky-50'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-sky-500' : 'border-slate-300'
                              }`}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />}
                              </div>
                              <span className="text-base">{isOrg ? '\uD83C\uDFE2' : '\uD83D\uDC64'}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-slate-900">
                                  {isOrg ? 'Bedriftsside' : 'Personlig'}: {acc.name}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  {isOrg ? 'Anbefalt for bedriftspublisering' : 'Personlig LinkedIn-profil'}
                                </span>
                              </div>
                              {isOrg && (
                                <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200 font-medium shrink-0">
                                  Bedrift
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Personal posting toggle */}
                      {selectedLinkedInAccount?.startsWith('organization:') && connectedAccounts.some(a => a.platform === 'linkedin' && a.account_id.startsWith('person:')) && (
                        <label className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 cursor-pointer">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={publishToPersonal}
                            onClick={() => setPublishToPersonal(!publishToPersonal)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                              publishToPersonal ? 'bg-sky-500' : 'bg-slate-300'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                              publishToPersonal ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`} />
                          </button>
                          <span className="text-sm text-slate-700">Publiser også til personlig profil</span>
                        </label>
                      )}

                      {/* No org pages found — manual input */}
                      {!connectedAccounts.some(a => a.platform === 'linkedin' && a.account_id.startsWith('organization:')) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                          <p className="text-sm text-amber-800 mb-3">
                            Vi fant ingen bedriftssider du administrerer på LinkedIn.
                          </p>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={manualCompanyId}
                              onChange={(e) => setManualCompanyId(e.target.value.replace(/\D/g, ''))}
                              placeholder="Bedriftsside-ID (tall)"
                              className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900 placeholder:text-slate-400"
                            />
                            <button
                              onClick={async () => {
                                if (!manualCompanyId || !orgId) return
                                setAddingManualCompany(true)
                                const newAccount: ConnectedAccount = {
                                  platform: 'linkedin',
                                  account_id: `organization:${manualCompanyId}`,
                                  name: `Bedrift #${manualCompanyId}`,
                                  access_token: connectedAccounts.find(a => a.platform === 'linkedin')?.access_token || '',
                                }
                                setConnectedAccounts(prev => [...prev, newAccount])
                                setSelectedLinkedInAccount(newAccount.account_id)

                                // Save to database
                                const existingLinkedin = connectedAccounts.find(a => a.platform === 'linkedin')
                                if (existingLinkedin) {
                                  await fetch('/api/social/save-account', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      org_id: orgId,
                                      platform: 'linkedin',
                                      account_id: `organization:${manualCompanyId}`,
                                      account_name: `Bedrift #${manualCompanyId}`,
                                      access_token: existingLinkedin.access_token,
                                      metadata: {
                                        account_type: 'organization',
                                        organization_id: manualCompanyId,
                                        manually_added: true,
                                      },
                                    }),
                                  }).catch(() => {})
                                }
                                setManualCompanyId('')
                                setAddingManualCompany(false)
                              }}
                              disabled={!manualCompanyId || addingManualCompany}
                              className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {addingManualCompany ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Legg til'}
                            </button>
                          </div>
                          <details className="text-sm">
                            <summary className="text-amber-700 cursor-pointer hover:text-amber-800 font-medium flex items-center gap-1">
                              <ChevronDown className="w-3.5 h-3.5" />
                              Hvordan finner jeg bedriftsside-ID?
                            </summary>
                            <ol className="mt-2 space-y-1 text-amber-700 list-decimal list-inside text-xs">
                              <li>Gå til bedriftssiden din på LinkedIn</li>
                              <li>Klikk på «Admin» i toppmenyen</li>
                              <li>Se i URL-en: linkedin.com/company/<strong>XXXX</strong> — tallet er din bedrifts-ID</li>
                              <li>Alternativt: Gå til linkedin.com/company/[firmanavn]/admin → se URL</li>
                            </ol>
                          </details>
                        </div>
                      )}

                      <button
                        onClick={startLinkedInOAuth}
                        className="w-full flex items-center justify-center gap-2 text-sky-600 border border-sky-200 py-2 rounded-xl text-sm font-medium hover:bg-sky-50 transition-all duration-200"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Koble til på nytt
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startLinkedInOAuth}
                      className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white py-3 rounded-xl font-medium hover:bg-sky-700 transition-all duration-200"
                    >
                      <Link2 className="w-4 h-4" />
                      Koble til LinkedIn
                    </button>
                  )}
                </div>
              )}

              {/* Brand tag — shown when at least one account is connected */}
              {connectedAccounts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-900">Merkevarenavn</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">
                    Gi merkevaren et navn — dette kobler kontoene dine sammen under én profil.
                  </p>
                  <input
                    type="text"
                    value={brandTag}
                    onChange={(e) => setBrandTag(e.target.value)}
                    placeholder="F.eks. AI Agenten AS"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all duration-200 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              )}

              {/* Fetch posts button — shown when accounts are connected but posts haven't been fetched yet */}
              {connectedAccounts.length > 0 && !postsFetched && !fetchingPosts && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="font-semibold text-slate-900">Hent poster</h3>
                      <p className="text-sm text-slate-500">
                        Klikk for å hente poster fra valgte kontoer for merkevareanalyse.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={fetchAllPosts}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/20"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Hent poster
                  </button>
                </div>
              )}

              {/* No posts found after fetch */}
              {postsFetched && socialPosts.length === 0 && !fetchingPosts && !analyzingTone && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-4">
                  <p className="text-sm text-amber-800 font-medium mb-1">Ingen poster funnet</p>
                  <p className="text-sm text-amber-700">
                    Vi fant ingen poster fra de valgte kontoene. Du kan fortsette uten tone-analyse — merkevaren bygges fra nettsiden din i stedet.
                  </p>
                  <button
                    onClick={() => { setPostsFetched(false) }}
                    className="mt-3 text-sm text-amber-700 underline hover:text-amber-900"
                  >
                    Prøv igjen
                  </button>
                </div>
              )}

              {/* Post fetching / analysis status */}
              {fetchingPosts && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    <p className="text-sm text-indigo-700 font-medium">
                      Henter poster fra dine SoMe-kontoer...
                    </p>
                  </div>
                </div>
              )}

              {analyzingTone && (
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                    <p className="text-sm text-purple-700 font-medium">
                      Vi fant {socialPosts.length} poster og analyserer tone-of-voice...
                    </p>
                  </div>
                </div>
              )}

              {/* Tone analysis result summary */}
              {toneProfile && !analyzingTone && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-slate-900">Tone-analyse ferdig</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Tone:</span>
                      <span className="text-sm font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg">
                        {toneProfile.tone}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{toneProfile.voice_description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {toneProfile.tone_keywords?.map((kw, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                          {kw}
                        </span>
                      ))}
                    </div>
                    {toneProfile.good_examples && toneProfile.good_examples.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 mb-1">Eksempler på god tone:</p>
                        {toneProfile.good_examples.slice(0, 2).map((ex, i) => (
                          <p key={i} className="text-xs text-slate-600 italic bg-slate-50 rounded-lg p-2 mb-1">
                            &ldquo;{ex}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Analysert {socialPosts.filter(p => p.text).length} poster
                    </p>
                  </div>
                </div>
              )}

              {/* Imported posts review */}
              {socialPosts.length > 0 && !fetchingPosts && !analyzingTone && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">Velg læringsmateriale</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Velg hvilke poster AI-en skal lære av. {Object.values(importedPostSelections).filter(Boolean).length} av {socialPosts.length} valgt.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const all: Record<string, boolean> = {}
                          socialPosts.forEach(p => { all[p.id] = true })
                          setImportedPostSelections(all)
                        }}
                        className="text-xs px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all"
                      >
                        Velg alle
                      </button>
                      <button
                        onClick={() => {
                          const none: Record<string, boolean> = {}
                          socialPosts.forEach(p => { none[p.id] = false })
                          setImportedPostSelections(none)
                        }}
                        className="text-xs px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all"
                      >
                        Fjern alle
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {socialPosts.map((post) => {
                      const selected = importedPostSelections[post.id] ?? true
                      const pConfig = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.facebook
                      const PlatformIcon = pConfig.icon
                      return (
                        <button
                          key={post.id}
                          onClick={() => setImportedPostSelections(prev => ({ ...prev, [post.id]: !selected }))}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                            selected ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white opacity-60'
                          }`}
                        >
                          {/* Post thumbnail */}
                          {post.image_url ? (
                            <img
                              src={post.image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                          {selected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border ${pConfig.bg}`}>
                                <PlatformIcon className={`w-3 h-3 ${pConfig.color}`} />
                                <span className={pConfig.color}>{post.platform === 'linkedin' ? 'LinkedIn' : post.platform === 'facebook' ? 'Facebook' : 'Instagram'}</span>
                              </span>
                              {post.likes > 0 && <span className="text-xs text-slate-400">{post.likes} likes</span>}
                            </div>
                            <p className="text-sm text-slate-700 line-clamp-2">{post.text || 'Ingen tekst'}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {someError && (
                <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 mb-4">
                  {someError}
                </div>
              )}

              {/* LinkedIn company page requirement message */}
              {selectedPlatforms.includes('linkedin') && connectedAccounts.some(a => a.platform === 'linkedin') && !selectedLinkedInAccount?.startsWith('organization:') && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-slate-600">
                    Velg eller legg til en bedriftsside for å fortsette
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  Tilbake
                </button>
                <button
                  onClick={async () => {
                    // Save brand tag to all connected accounts
                    if (orgId && brandTag.trim()) {
                      await supabase
                        .from('social_accounts')
                        .update({ brand_tag: brandTag.trim() })
                        .eq('org_id', orgId)
                    }

                    // Save LinkedIn account selection metadata
                    if (orgId && selectedPlatforms.includes('linkedin') && selectedLinkedInAccount) {
                      const selectedAcc = connectedAccounts.find(a => a.platform === 'linkedin' && a.account_id === selectedLinkedInAccount)
                      if (selectedAcc) {
                        await supabase
                          .from('social_accounts')
                          .update({
                            metadata: {
                              is_primary: true,
                              publish_to_personal: publishToPersonal,
                            },
                          } as Record<string, unknown>)
                          .eq('org_id', orgId)
                          .eq('platform', 'linkedin')
                          .eq('account_id', selectedLinkedInAccount)
                      }
                      // Mark non-selected LinkedIn accounts as non-primary
                      const otherLinkedIn = connectedAccounts.filter(
                        a => a.platform === 'linkedin' && a.account_id !== selectedLinkedInAccount
                      )
                      for (const acc of otherLinkedIn) {
                        await supabase
                          .from('social_accounts')
                          .update({
                            metadata: {
                              is_primary: false,
                              publish_to_personal: acc.account_id.startsWith('person:') ? publishToPersonal : false,
                            },
                          } as Record<string, unknown>)
                          .eq('org_id', orgId)
                          .eq('platform', 'linkedin')
                          .eq('account_id', acc.account_id)
                      }
                    }

                    // Save learning material selections before proceeding
                    if (orgId && socialPosts.length > 0) {
                      setSavingSelections(true)
                      const selectedIds = Object.entries(importedPostSelections)
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                      const deselectedIds = Object.entries(importedPostSelections)
                        .filter(([, v]) => !v)
                        .map(([k]) => k)

                      if (selectedIds.length > 0) {
                        await supabase
                          .from('imported_social_posts')
                          .update({ is_learning_material: true })
                          .eq('org_id', orgId)
                          .in('external_id', selectedIds)
                      }
                      if (deselectedIds.length > 0) {
                        await supabase
                          .from('imported_social_posts')
                          .update({ is_learning_material: false })
                          .eq('org_id', orgId)
                          .in('external_id', deselectedIds)
                      }
                      setSavingSelections(false)
                    }
                    setStep(3)
                  }}
                  disabled={
                    fetchingPosts || analyzingTone || savingSelections ||
                    (selectedPlatforms.includes('linkedin') && connectedAccounts.some(a => a.platform === 'linkedin') && !selectedLinkedInAccount?.startsWith('organization:')) ||
                    (connectedAccounts.length > 0 && !postsFetched)
                  }
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  {savingSelections ? 'Lagrer...' : connectedAccounts.length === 0 && hasFacebookOrInstagram
                    ? 'Hopp over'
                    : connectedAccounts.length > 0 && !postsFetched
                      ? 'Hent poster først'
                      : 'Neste'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Website URL */}
        {step === 3 && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Din nettside</h2>
              <p className="text-slate-500">Vi analyserer nettsiden din for å forstå merkevaren.</p>
            </div>
            <div className="max-w-md mx-auto">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://dinbedrift.no"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200 text-slate-900 placeholder:text-slate-400 text-lg"
              />
              {scrapeError && (
                <div className="mt-3 bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100">
                  {scrapeError}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  Tilbake
                </button>
                <button
                  onClick={handleScrape}
                  disabled={!websiteUrl || scraping}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  {scraping ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyserer...
                    </>
                  ) : 'Analyser nettside'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Edit brand profile — FULL WIDTH */}
        {step === 4 && brandProfile && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Din merkevare</h2>
              <p className="text-slate-500">
                Vi fant dette{toneProfile ? ' (inkl. tone fra SoMe-poster)' : ''}. Juster som du vil.
              </p>
            </div>

            {/* Tone from SoMe banner */}
            {toneProfile && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-800">Tone fra SoMe-analyse inkludert</p>
                  <p className="text-xs text-purple-600 mt-1">
                    Do&apos;s, don&apos;ts og tone-nøkkelord er merget fra {socialPosts.filter(p => p.text).length} analyserte poster.
                  </p>
                </div>
              </div>
            )}

            {/* Section 1: Description & Tagline */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Beskrivelse</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Beskrivelse</label>
                  <textarea
                    value={brandProfile.description || ''}
                    onChange={(e) => updateBrandField('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all duration-200 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tagline</label>
                  <input
                    value={brandProfile.tagline || ''}
                    onChange={(e) => updateBrandField('tagline', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all duration-200 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Colors & Fonts (side-by-side) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-slate-900">Farger</h3>
                </div>
                <div className="space-y-2">
                  {brandProfile.colors.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={c.startsWith('#') ? c : '#000000'}
                        onChange={(e) => updateListItem('colors', i, e.target.value)}
                        className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-1"
                      />
                      <input
                        value={c}
                        onChange={(e) => updateListItem('colors', i, e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button onClick={() => removeListItem('colors', i)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('colors')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Farge
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Type className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-slate-900">Fonter</h3>
                </div>
                <div className="space-y-3">
                  {brandProfile.fonts.map((f, i) => (
                    <div key={i}>
                      {f && (
                        // eslint-disable-next-line @next/next/no-page-custom-font
                        <link
                          rel="stylesheet"
                          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}&display=swap`}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          value={f}
                          onChange={(e) => updateListItem('fonts', i, e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button onClick={() => removeListItem('fonts', i)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {f && (
                        <div className="mt-1.5 pl-1">
                          <p className="text-base font-medium text-slate-800" style={{ fontFamily: `'${f}', sans-serif` }}>
                            {f}
                          </p>
                          <p className="text-sm text-slate-500" style={{ fontFamily: `'${f}', sans-serif` }}>
                            Aa Bb Cc 123
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addListItem('fonts')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Font
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Tone & Voice */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Tone & Stemme</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tone</label>
                  <input
                    value={brandProfile.tone || ''}
                    onChange={(e) => updateBrandField('tone', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Stemmebeskrivelse</label>
                  <input
                    value={brandProfile.voice_description || ''}
                    onChange={(e) => updateBrandField('voice_description', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nøkkelord</label>
                <div className="flex flex-wrap gap-2">
                  {brandProfile.tone_keywords.map((kw, i) => (
                    <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                      <input
                        value={kw}
                        onChange={(e) => updateListItem('tone_keywords', i, e.target.value)}
                        className="bg-transparent text-sm text-indigo-700 w-20 outline-none"
                      />
                      <button onClick={() => removeListItem('tone_keywords', i)} className="text-indigo-400 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('tone_keywords')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 border border-dashed border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Legg til
                  </button>
                </div>
              </div>
            </div>

            {/* Section 4: Do's & Don'ts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">Gjør dette</h3>
                </div>
                {brandProfile.do_list.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={item}
                      onChange={(e) => updateListItem('do_list', i, e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={() => removeListItem('do_list', i)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addListItem('do_list')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors mt-1">
                  <Plus className="w-3.5 h-3.5" /> Legg til
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldX className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-slate-900">Unngå dette</h3>
                </div>
                {brandProfile.dont_list.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={item}
                      onChange={(e) => updateListItem('dont_list', i, e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={() => removeListItem('dont_list', i)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addListItem('dont_list')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors mt-1">
                  <Plus className="w-3.5 h-3.5" /> Legg til
                </button>
              </div>
            </div>

            {/* Section 5: Target Audience & Key Messages */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Målgruppe & Nøkkelmeldinger</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Målgruppe</label>
                  <input
                    value={brandProfile.target_audience || ''}
                    onChange={(e) => updateBrandField('target_audience', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nøkkelmeldinger</label>
                  {brandProfile.key_messages.map((msg, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        value={msg}
                        onChange={(e) => updateListItem('key_messages', i, e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button onClick={() => removeListItem('key_messages', i)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('key_messages')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Legg til
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all duration-200"
              >
                Tilbake
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-500/20"
              >
                Neste
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="animate-fade-in-up text-center max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Alt klart!</h2>
            <p className="text-slate-500 mb-8">
              Merkevaren din er satt opp. Vi er klare til å lage innhold for{' '}
              {selectedPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}.
            </p>
            {toneProfile && (
              <p className="text-sm text-purple-600 mb-4 flex items-center justify-center gap-1">
                <Sparkles className="w-4 h-4" /> Tone-of-voice fra {socialPosts.filter(p => p.text).length} eksisterende poster er inkludert i merkevaren.
              </p>
            )}

            {/* Logo upload */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6 shadow-sm text-left">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Last opp firmalogo</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">Logoen brukes i innlegg og som profilbilde</p>

              {(logoPreview || brandProfile?.logo_url) && (
                <div className="mb-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview || brandProfile?.logo_url || ''}
                    alt="Logo"
                    className="max-h-24 max-w-48 object-contain rounded-xl border border-slate-200 p-2"
                  />
                </div>
              )}

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !orgId) return
                  setUploadingLogo(true)
                  try {
                    const ext = file.name.split('.').pop() || 'png'
                    const path = `${orgId}/logo.${ext}`
                    const { error: uploadError } = await supabase.storage
                      .from('brand-assets')
                      .upload(path, file, { upsert: true })
                    if (uploadError) throw uploadError
                    const { data: urlData } = supabase.storage
                      .from('brand-assets')
                      .getPublicUrl(path)
                    const publicUrl = urlData.publicUrl
                    setLogoPreview(publicUrl)
                    if (brandProfile) {
                      setBrandProfile({ ...brandProfile, logo_url: publicUrl })
                    }
                    await supabase
                      .from('brand_profiles')
                      .update({ logo_url: publicUrl })
                      .eq('org_id', orgId)
                  } catch (err) {
                    console.error('Logo upload error:', err)
                  }
                  setUploadingLogo(false)
                }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-all duration-200 disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Laster opp...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {brandProfile?.logo_url || logoPreview ? 'Bytt logo' : 'Velg fil'}
                  </>
                )}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(4)}
                className="px-6 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all duration-200"
              >
                Tilbake
              </button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
              >
                {saving ? 'Lagrer...' : 'Gå til dashboard →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
