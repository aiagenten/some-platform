'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getOrg() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single()
      if (data) setOrgId(data.org_id)
    }
    getOrg()
  }, [])

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
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
      setBrandProfile(data)
      setStep(3)
    } catch {
      setScrapeError('Nettverksfeil. Prøv igjen.')
    }
    setScraping(false)
  }

  const handleFinish = async () => {
    if (!orgId || !brandProfile) return
    setSaving(true)

    // Save updated brand profile
    await supabase
      .from('brand_profiles')
      .upsert({
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

    // Save selected platforms as social accounts (placeholder)
    for (const platform of selectedPlatforms) {
      await supabase
        .from('social_accounts')
        .upsert({
          org_id: orgId,
          platform,
          account_name: `${platform}-pending`,
          account_id: `pending-${platform}-${orgId}`,
        }, { onConflict: 'org_id,platform,account_id' })
    }

    setSaving(false)
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress */}
        <div className="flex items-center justify-center mb-10 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div className={`w-12 h-0.5 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Step 1: Platforms */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Velg plattformer</h2>
              <p className="text-gray-500 mb-6">Hvilke sosiale medier vil du bruke?</p>
              <div className="space-y-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition ${
                      selectedPlatforms.includes(p.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <span className="font-medium text-gray-900">{p.label}</span>
                    {selectedPlatforms.includes(p.id) && (
                      <span className="ml-auto text-blue-600">✓</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={selectedPlatforms.length === 0}
                className="w-full mt-6 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Neste
              </button>
            </div>
          )}

          {/* Step 2: Website URL */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Din nettside</h2>
              <p className="text-gray-500 mb-6">Vi analyserer nettsiden din for å forstå merkevaren.</p>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://dinbedrift.no"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
              />
              {scrapeError && (
                <div className="mt-3 bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {scrapeError}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Tilbake
                </button>
                <button
                  onClick={handleScrape}
                  disabled={!websiteUrl || scraping}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scraping ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyserer...
                    </span>
                  ) : 'Analyser nettside'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Edit brand profile */}
          {step === 3 && brandProfile && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Din merkevare</h2>
              <p className="text-gray-500 mb-6">Vi fant dette. Juster som du vil.</p>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
                  <textarea
                    value={brandProfile.description || ''}
                    onChange={(e) => updateBrandField('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  />
                </div>

                {/* Tagline */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                  <input
                    value={brandProfile.tagline || ''}
                    onChange={(e) => updateBrandField('tagline', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  />
                </div>

                {/* Tone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                    <input
                      value={brandProfile.tone || ''}
                      onChange={(e) => updateBrandField('tone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Målgruppe</label>
                    <input
                      value={brandProfile.target_audience || ''}
                      onChange={(e) => updateBrandField('target_audience', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                    />
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farger</label>
                  <div className="flex flex-wrap gap-2">
                    {brandProfile.colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-6 h-6 rounded border" style={{ backgroundColor: c }} />
                        <input
                          value={c}
                          onChange={(e) => updateListItem('colors', i, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900"
                        />
                        <button onClick={() => removeListItem('colors', i)} className="text-red-400 hover:text-red-600 text-xs">×</button>
                      </div>
                    ))}
                    <button onClick={() => addListItem('colors')} className="text-blue-600 text-xs hover:underline">+ Farge</button>
                  </div>
                </div>

                {/* Fonts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fonter</label>
                  <div className="flex flex-wrap gap-2">
                    {brandProfile.fonts.map((f, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          value={f}
                          onChange={(e) => updateListItem('fonts', i, e.target.value)}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900"
                        />
                        <button onClick={() => removeListItem('fonts', i)} className="text-red-400 hover:text-red-600 text-xs">×</button>
                      </div>
                    ))}
                    <button onClick={() => addListItem('fonts')} className="text-blue-600 text-xs hover:underline">+ Font</button>
                  </div>
                </div>

                {/* Do's */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">✅ Gjør dette</label>
                  {brandProfile.do_list.map((item, i) => (
                    <div key={i} className="flex gap-1 mb-1">
                      <input
                        value={item}
                        onChange={(e) => updateListItem('do_list', i, e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                      />
                      <button onClick={() => removeListItem('do_list', i)} className="text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('do_list')} className="text-blue-600 text-xs hover:underline">+ Legg til</button>
                </div>

                {/* Don'ts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">❌ Unngå dette</label>
                  {brandProfile.dont_list.map((item, i) => (
                    <div key={i} className="flex gap-1 mb-1">
                      <input
                        value={item}
                        onChange={(e) => updateListItem('dont_list', i, e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                      />
                      <button onClick={() => removeListItem('dont_list', i)} className="text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('dont_list')} className="text-blue-600 text-xs hover:underline">+ Legg til</button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Tilbake
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Neste
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Alt klart!</h2>
              <p className="text-gray-500 mb-8">
                Merkevaren din er satt opp. Vi er klare til å lage innhold for{' '}
                {selectedPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Tilbake
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Lagrer...' : 'Gå til dashboard →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
