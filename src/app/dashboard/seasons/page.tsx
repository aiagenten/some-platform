'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays,
  Loader2,
  CheckCircle2,
  Sparkles,
  Clock,
  ChevronLeft,
  Save,
} from 'lucide-react'

type SeasonalEvent = {
  id: string
  name: string
  date_pattern: string
  description: string | null
  default_enabled: boolean
  icon: string | null
  suggested_prompt: string | null
}

type BrandSeasonalSetting = {
  brand_id: string
  seasonal_event_id: string
  enabled: boolean
  custom_prompt: string | null
}

const MONTH_NAMES_NO: Record<number, string> = {
  1: 'januar',
  2: 'februar',
  3: 'mars',
  4: 'april',
  5: 'mai',
  6: 'juni',
  7: 'juli',
  8: 'august',
  9: 'september',
  10: 'oktober',
  11: 'november',
  12: 'desember',
}

function formatDatePattern(pattern: string): string {
  const parts = pattern.split('-')
  if (parts.length < 2) return pattern
  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  if (isNaN(month) || isNaN(day)) return pattern
  return `${day}. ${MONTH_NAMES_NO[month] || ''}`
}

function daysUntilNext(pattern: string): number {
  const parts = pattern.split('-')
  if (parts.length < 2) return 999
  const month = parseInt(parts[0], 10)
  const day = parseInt(parts[1], 10)
  if (isNaN(month) || isNaN(day)) return 999

  const now = new Date()
  const currentYear = now.getFullYear()
  let next = new Date(currentYear, month - 1, day)

  // Reset time to start of day for accurate comparison
  const today = new Date(currentYear, now.getMonth(), now.getDate())

  if (next < today) {
    next = new Date(currentYear + 1, month - 1, day)
  }

  const diff = next.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDaysLabel(days: number): string {
  if (days === 0) return 'I dag!'
  if (days === 1) return 'I morgen'
  return `${days} dager`
}

export default function SeasonsPage() {
  const [events, setEvents] = useState<SeasonalEvent[]>([])
  const [settings, setSettings] = useState<Record<string, BrandSeasonalSetting>>({})
  const [brandId, setBrandId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

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

      // Load brand profile
      const { data: brands } = await supabase
        .from('brand_profiles')
        .select('id, org_id')
        .eq('org_id', profile.org_id)
        .limit(1)

      const brand = brands?.[0]
      if (brand) {
        setBrandId(brand.id)

        // Load brand seasonal settings
        const { data: settingsData } = await supabase
          .from('brand_seasonal_settings')
          .select('brand_id, seasonal_event_id, enabled, custom_prompt')
          .eq('brand_id', brand.id)

        const settingsMap: Record<string, BrandSeasonalSetting> = {}
        const promptsMap: Record<string, string> = {}
        ;(settingsData || []).forEach((s: BrandSeasonalSetting) => {
          settingsMap[s.seasonal_event_id] = s
          if (s.custom_prompt) {
            promptsMap[s.seasonal_event_id] = s.custom_prompt
          }
        })
        setSettings(settingsMap)
        setCustomPrompts(promptsMap)
      }

      // Load seasonal events
      const { data: eventsData } = await supabase
        .from('seasonal_events')
        .select('id, name, date_pattern, description, default_enabled, icon, suggested_prompt')
        .order('date_pattern')

      setEvents(eventsData || [])
      setLoading(false)
    }
    load()
  }, [])

  const isEnabled = useCallback((eventId: string, defaultEnabled: boolean): boolean => {
    const setting = settings[eventId]
    if (setting) return setting.enabled
    return defaultEnabled
  }, [settings])

  const handleToggle = async (event: SeasonalEvent) => {
    if (!brandId) return
    const currentEnabled = isEnabled(event.id, event.default_enabled)
    const newEnabled = !currentEnabled

    const newSettings = { ...settings }
    newSettings[event.id] = {
      brand_id: brandId,
      seasonal_event_id: event.id,
      enabled: newEnabled,
      custom_prompt: customPrompts[event.id] || null,
    }
    setSettings(newSettings)

    await supabase
      .from('brand_seasonal_settings')
      .upsert({
        brand_id: brandId,
        seasonal_event_id: event.id,
        enabled: newEnabled,
        custom_prompt: customPrompts[event.id] || null,
      }, {
        onConflict: 'brand_id,seasonal_event_id',
      })
  }

  const handleSavePrompt = async (eventId: string) => {
    if (!brandId) return
    setSaving(eventId)

    const currentEnabled = isEnabled(eventId, events.find(e => e.id === eventId)?.default_enabled ?? false)

    await supabase
      .from('brand_seasonal_settings')
      .upsert({
        brand_id: brandId,
        seasonal_event_id: eventId,
        enabled: currentEnabled,
        custom_prompt: customPrompts[eventId] || null,
      }, {
        onConflict: 'brand_id,seasonal_event_id',
      })

    const newSettings = { ...settings }
    newSettings[eventId] = {
      brand_id: brandId,
      seasonal_event_id: eventId,
      enabled: currentEnabled,
      custom_prompt: customPrompts[eventId] || null,
    }
    setSettings(newSettings)

    setSaving(null)
    setSaved(eventId)
    setTimeout(() => setSaved(null), 2000)
  }

  const upcomingEvents = events
    .filter(e => {
      const days = daysUntilNext(e.date_pattern)
      return days <= 30 && isEnabled(e.id, e.default_enabled)
    })
    .sort((a, b) => daysUntilNext(a.date_pattern) - daysUntilNext(b.date_pattern))

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Laster sesonger...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            Sesonger
          </h1>
          <p className="text-slate-500 mt-2 ml-[52px]">
            Planlegg innhold for kommende sesonger og høytider
          </p>
        </div>

        {/* Upcoming seasons */}
        {upcomingEvents.length > 0 && (
          <div className="mb-8 animate-fade-in-up">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Kommende sesonger
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map(event => {
                const days = daysUntilNext(event.date_pattern)
                const prompt = customPrompts[event.id] || event.suggested_prompt || event.name
                return (
                  <div
                    key={event.id}
                    className="bg-white rounded-2xl border border-indigo-200/60 shadow-sm p-5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-[3rem] -z-0" />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{event.icon || '📅'}</span>
                          <div>
                            <h3 className="font-semibold text-slate-900">{event.name}</h3>
                            <p className="text-xs text-slate-500">{formatDatePattern(event.date_pattern)}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                          days <= 7
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {getDaysLabel(days)}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/generate?topic=${encodeURIComponent(prompt)}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all w-full justify-center mt-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Lag innlegg
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All seasonal events */}
        <div className="animate-fade-in-up">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Alle sesonger
          </h2>
          <div className="space-y-4">
            {events.map(event => {
              const days = daysUntilNext(event.date_pattern)
              const enabled = isEnabled(event.id, event.default_enabled)

              return (
                <div
                  key={event.id}
                  className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 transition-opacity ${
                    !enabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Icon & Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-3xl flex-shrink-0 mt-0.5">{event.icon || '📅'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{event.name}</h3>
                          <span className="text-sm text-slate-500">{formatDatePattern(event.date_pattern)}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                            days <= 7
                              ? 'bg-red-50 text-red-700'
                              : days <= 30
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {getDaysLabel(days)}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-slate-500 mt-1">{event.description}</p>
                        )}

                        {/* Custom prompt */}
                        {enabled && (
                          <div className="mt-3">
                            <label className="text-xs font-medium text-slate-500 mb-1 block">
                              Tilpasset prompt
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customPrompts[event.id] ?? event.suggested_prompt ?? ''}
                                onChange={e => setCustomPrompts(prev => ({ ...prev, [event.id]: e.target.value }))}
                                placeholder={event.suggested_prompt || 'Skriv en tilpasset prompt...'}
                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                              />
                              <button
                                onClick={() => handleSavePrompt(event.id)}
                                disabled={saving === event.id}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                              >
                                {saving === event.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : saved === event.id ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                {saved === event.id ? 'Lagret' : 'Lagre'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {enabled && days <= 30 && (
                        <Link
                          href={`/dashboard/generate?topic=${encodeURIComponent(customPrompts[event.id] || event.suggested_prompt || event.name)}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all"
                        >
                          <Sparkles className="w-4 h-4" />
                          Lag innlegg
                        </Link>
                      )}
                      <button
                        onClick={() => handleToggle(event)}
                        className={`relative w-12 h-7 rounded-full transition-colors ${
                          enabled
                            ? 'bg-indigo-600'
                            : 'bg-slate-200'
                        }`}
                        aria-label={enabled ? 'Deaktiver' : 'Aktiver'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
                            enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {events.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Ingen sesonger funnet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
