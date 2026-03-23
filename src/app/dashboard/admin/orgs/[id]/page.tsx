'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Save, Eye, EyeOff, ChevronDown, AlertCircle } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgSettings = {
  features?: {
    image_generation?: boolean
    video?: boolean
    digital_twin?: boolean
    video_studio?: boolean
    music_generation?: boolean
    overlay_templates?: boolean
  }
  limits?: {
    image_generation?: number | null
    video_generation?: number | null
    text_generation?: number | null
    max_monthly_cost_nok?: number | null
  }
  api_keys?: {
    openai?: string
    fal_ai?: string
    openrouter?: string
  }
}

type OrgRow = {
  id: string
  name: string
  slug: string
  industry: string | null
  website_url: string | null
  created_at: string
  settings: OrgSettings | null
}

type UsageSummary = {
  total_calls: number
  total_cost: number
  by_type: Record<string, { count: number; cost: number }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'detaljer', label: 'Detaljer' },
  { id: 'innstillinger', label: 'Innstillinger' },
]

const INDUSTRIES = [
  'Teknologi', 'Retail', 'Restaurant', 'Helse', 'Eiendom',
  'Media', 'Finans', 'Sport', 'Utdanning', 'Annet',
]

const FEATURE_LIST = [
  { key: 'image_generation', label: 'Bildegenerering', description: 'Generer bilder med AI' },
  { key: 'video', label: 'Video', description: 'Videogenerering med fal.ai / Kling' },
  { key: 'digital_twin', label: 'Digital tvilling', description: 'AI-avatar trening og bruk' },
  { key: 'video_studio', label: 'Video Studio', description: 'Avansert videoredigering' },
  { key: 'music_generation', label: 'Musikk', description: 'AI-musikk til videoer' },
  { key: 'overlay_templates', label: 'Overlay-maler', description: 'Grafiske overlay-maler' },
] as const

const LIMIT_FIELDS = [
  { key: 'image_generation', label: 'Bilder per måned', unit: 'bilder', usageKey: 'image_generation' },
  { key: 'video_generation', label: 'Videoer per måned', unit: 'videoer', usageKey: 'video_generation' },
  { key: 'text_generation', label: 'Tekstgenerering per måned', unit: 'kall', usageKey: 'text_generation' },
] as const

const API_KEY_FIELDS = [
  { key: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
  { key: 'fal_ai', label: 'fal.ai API Key', placeholder: 'fal-...' },
  { key: 'openrouter', label: 'OpenRouter API Key', placeholder: 'sk-or-...' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskKey(val: string): string {
  if (!val || val.length < 8) return '••••••••'
  return '••••' + val.slice(-4)
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap w-24 text-right">
        {value} / {max} {label}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string

  const [org, setOrg] = useState<OrgRow | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('detaljer')

  // Detaljer form state
  const [detName, setDetName] = useState('')
  const [detSlug, setDetSlug] = useState('')
  const [detIndustry, setDetIndustry] = useState('')
  const [detWebsite, setDetWebsite] = useState('')
  const [detSaving, setDetSaving] = useState(false)
  const [detError, setDetError] = useState('')
  const [detSuccess, setDetSuccess] = useState('')

  // Feature toggles
  const [features, setFeatures] = useState<NonNullable<OrgSettings['features']>>({})
  // Limits
  const [limits, setLimits] = useState<NonNullable<OrgSettings['limits']>>({})
  const [maxCostNok, setMaxCostNok] = useState<string>('')
  // API keys (edit values — plain text while editing)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [editingKey, setEditingKey] = useState<Record<string, boolean>>({})
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')

  const loadOrg = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/orgs')
    const data = await res.json()
    const found: OrgRow | undefined = (data.orgs || []).find((o: OrgRow) => o.id === orgId)
    if (!found) { router.push('/dashboard/admin/orgs'); return }

    setOrg(found)
    setDetName(found.name)
    setDetSlug(found.slug)
    setDetIndustry(found.industry || '')
    setDetWebsite(found.website_url || '')

    const s = found.settings || {}
    setFeatures(s.features || {})
    setLimits(s.limits || {})
    setMaxCostNok(s.limits?.max_monthly_cost_nok != null ? String(s.limits.max_monthly_cost_nok) : '')
    // For API keys, store a placeholder so user can tell if a key exists
    const savedKeys = s.api_keys || {}
    const initKeys: Record<string, string> = {}
    for (const field of API_KEY_FIELDS) {
      initKeys[field.key] = savedKeys[field.key] || ''
    }
    setApiKeys(initKeys)
    setLoading(false)
  }, [orgId, router])

  const loadUsage = useCallback(async () => {
    const now = new Date()
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const res = await fetch(`/api/admin/usage?org_id=${orgId}&from=${from}`)
    const data = await res.json()
    setUsage(data)
  }, [orgId])

  useEffect(() => {
    loadOrg()
    loadUsage()
  }, [loadOrg, loadUsage])

  // ─── Save detaljer ──────────────────────────────────────────────────────────

  const saveDetaljer = async () => {
    setDetError('')
    setDetSuccess('')
    if (!detName || !detSlug) { setDetError('Navn og slug er påkrevd'); return }
    setDetSaving(true)

    const res = await fetch(`/api/admin/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: detName, slug: detSlug, industry: detIndustry, website_url: detWebsite }),
    })
    const data = await res.json()
    setDetSaving(false)

    if (!res.ok) setDetError(data.error || 'Noe gikk galt')
    else { setDetSuccess('Lagret!'); loadOrg() }
  }

  // ─── Save innstillinger ─────────────────────────────────────────────────────

  const saveInnstillinger = async () => {
    setSettingsError('')
    setSettingsSuccess('')
    setSettingsSaving(true)

    // Build settings object — merge with existing so we don't overwrite other keys
    const existingSettings = org?.settings || {}

    const newLimits: OrgSettings['limits'] = {}
    for (const f of LIMIT_FIELDS) {
      const v = limits[f.key]
      newLimits[f.key] = v != null && v !== 0 ? v : null
    }
    const costNok = parseFloat(maxCostNok)
    newLimits.max_monthly_cost_nok = isNaN(costNok) || maxCostNok === '' ? null : costNok

    // Only include API keys that are either set (non-empty) or were previously set
    const savedKeys = existingSettings.api_keys || {}
    const newApiKeys: Record<string, string> = {}
    for (const field of API_KEY_FIELDS) {
      const val = apiKeys[field.key]
      if (val && val.trim()) {
        newApiKeys[field.key] = val.trim()
      } else if (savedKeys[field.key] && !editingKey[field.key]) {
        // Keep old key if not editing
        newApiKeys[field.key] = savedKeys[field.key] as string
      }
    }

    const newSettings: OrgSettings = {
      ...existingSettings,
      features,
      limits: newLimits,
      api_keys: newApiKeys,
    }

    const res = await fetch(`/api/admin/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    })
    const data = await res.json()
    setSettingsSaving(false)

    if (!res.ok) setSettingsError(data.error || 'Noe gikk galt')
    else {
      setSettingsSuccess('Innstillinger lagret!')
      setEditingKey({})
      loadOrg()
    }
  }

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-400">Laster organisasjon...</div>
      </div>
    )
  }

  if (!org) return null

  return (
    <div className="max-w-3xl">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/admin/orgs"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{org.name}</h2>
          <p className="text-xs text-slate-400 font-mono">{org.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Detaljer ───────────────────────────────────────────────────── */}
      {activeTab === 'detaljer' && (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Navn *</label>
              <input
                type="text"
                value={detName}
                onChange={e => setDetName(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Slug *</label>
              <input
                type="text"
                value={detSlug}
                onChange={e => setDetSlug(autoSlug(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bransje</label>
              <div className="relative">
                <select
                  value={detIndustry}
                  onChange={e => setDetIndustry(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white appearance-none pr-8"
                >
                  <option value="">Velg bransje</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nettside</label>
              <input
                type="url"
                value={detWebsite}
                onChange={e => setDetWebsite(e.target.value)}
                placeholder="https://example.no"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {detError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{detError}</p>}
          {detSuccess && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">{detSuccess}</p>}

          <div className="flex justify-end pt-2">
            <button
              onClick={saveDetaljer}
              disabled={detSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              <Save className="w-4 h-4" />
              {detSaving ? 'Lagrer...' : 'Lagre detaljer'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Innstillinger ──────────────────────────────────────────────── */}
      {activeTab === 'innstillinger' && (
        <div className="space-y-5">

          {/* ── Feature toggles ────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Funksjoner</h3>
            <p className="text-xs text-slate-500 mb-5">Aktiver eller deaktiver tilgang til funksjoner for denne organisasjonen.</p>
            <div className="divide-y divide-slate-50">
              {FEATURE_LIST.map(feat => {
                const enabled = features[feat.key] !== false // default true if not set
                return (
                  <div key={feat.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{feat.label}</p>
                      <p className="text-xs text-slate-400">{feat.description}</p>
                    </div>
                    <button
                      onClick={() => setFeatures(prev => ({ ...prev, [feat.key]: !enabled }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${
                        enabled ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                      role="switch"
                      aria-checked={enabled}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 mt-0.5 ${
                          enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Usage limits ───────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Bruksgrenser</h3>
            <p className="text-xs text-slate-500 mb-5">
              Maks forbruk per måned. La feltet stå tomt for ubegrenset.
            </p>
            <div className="space-y-5">
              {LIMIT_FIELDS.map(field => {
                const currentVal = limits[field.key]
                const usageCount = usage?.by_type?.[field.usageKey]?.count ?? 0
                const hasLimit = currentVal != null && currentVal > 0
                return (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">{field.label}</label>
                      {hasLimit && (
                        <span className={`text-xs font-medium ${
                          usageCount >= currentVal! ? 'text-red-600' : 'text-slate-500'
                        }`}>
                          {usageCount} / {currentVal} brukt denne måneden
                        </span>
                      )}
                      {!hasLimit && usage && (
                        <span className="text-xs text-slate-400">{usageCount} brukt denne måneden</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ubegrenset"
                      value={currentVal ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : parseInt(e.target.value)
                        setLimits(prev => ({ ...prev, [field.key]: v }))
                      }}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                    {hasLimit && (
                      <div className="mt-2">
                        <ProgressBar value={usageCount} max={currentVal!} label={field.unit} />
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Cost limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Maks total kostnad per måned (NOK)</label>
                  {usage && (
                    <span className="text-xs text-slate-400">
                      ${usage.total_cost.toFixed(4)} brukt denne måneden
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">kr</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ubegrenset"
                    value={maxCostNok}
                    onChange={e => setMaxCostNok(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                {maxCostNok && !isNaN(parseFloat(maxCostNok)) && usage && (
                  <div className="mt-2">
                    <ProgressBar
                      value={Math.round(usage.total_cost * 10.5)} // rough USD→NOK
                      max={parseFloat(maxCostNok)}
                      label="NOK"
                    />
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">Omregning basert på estimert USD-kostnad × 10.5</p>
              </div>
            </div>
          </section>

          {/* ── API Keys ────────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Egne API-nøkler</h3>
            <p className="text-xs text-slate-500 mb-1">
              Valgfrie API-nøkler for denne organisasjonen. Overskriver plattformens standard-nøkler.
            </p>
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Nøklene lagres i databasen. Kryptering legges til i neste versjon.
              </p>
            </div>
            <div className="space-y-4">
              {API_KEY_FIELDS.map(field => {
                const storedVal = (org?.settings?.api_keys as Record<string, string> | undefined)?.[field.key] || ''
                const isEditing = editingKey[field.key]
                const editVal = apiKeys[field.key] || ''
                const hasStoredKey = storedVal.length > 0
                const isVisible = showKey[field.key]
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                    {!isEditing ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600">
                          {hasStoredKey
                            ? (isVisible ? storedVal : maskKey(storedVal))
                            : <span className="text-slate-400 not-italic font-sans text-xs">Ikke satt</span>
                          }
                        </div>
                        {hasStoredKey && (
                          <button
                            onClick={() => setShowKey(prev => ({ ...prev, [field.key]: !isVisible }))}
                            className="p-2.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                          >
                            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingKey(prev => ({ ...prev, [field.key]: true }))
                            setApiKeys(prev => ({ ...prev, [field.key]: '' }))
                          }}
                          className="px-3 py-2.5 text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors font-medium"
                        >
                          {hasStoredKey ? 'Endre' : 'Sett'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editVal}
                          onChange={e => setApiKeys(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          autoFocus
                          className="flex-1 text-sm border border-indigo-300 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                        />
                        <button
                          onClick={() => setEditingKey(prev => ({ ...prev, [field.key]: false }))}
                          className="px-3 py-2.5 text-sm text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          Avbryt
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Save button */}
          {settingsError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{settingsError}</p>
          )}
          {settingsSuccess && (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">{settingsSuccess}</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={saveInnstillinger}
              disabled={settingsSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              <Save className="w-4 h-4" />
              {settingsSaving ? 'Lagrer...' : 'Lagre innstillinger'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
