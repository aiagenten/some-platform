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
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

type SeasonalEvent = {
  id: string
  name: string
  date_pattern: string
  description: string | null
  default_enabled: boolean
  icon: string | null
  suggested_prompt: string | null
  is_custom?: boolean
  created_by?: string | null
  org_id?: string | null
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
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})
  // Custom season modal
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SeasonalEvent | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalDescription, setModalDescription] = useState('')
  const [modalIcon, setModalIcon] = useState('')
  const [modalPrompt, setModalPrompt] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) return
    setOrgId(profile.org_id)

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

    // Load seasonal events (include custom columns)
    const { data: eventsData } = await supabase
      .from('seasonal_events')
      .select('id, name, date_pattern, description, default_enabled, icon, suggested_prompt, is_custom, created_by, org_id')
      .order('date_pattern')

    setEvents(eventsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

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

  // --- Custom season CRUD ---

  const openCreateModal = () => {
    setEditingEvent(null)
    setModalName('')
    setModalDate('')
    setModalDescription('')
    setModalIcon('')
    setModalPrompt('')
    setShowModal(true)
  }

  const openEditModal = (event: SeasonalEvent) => {
    setEditingEvent(event)
    setModalName(event.name)
    setModalDate(event.date_pattern)
    setModalDescription(event.description || '')
    setModalIcon(event.icon || '')
    setModalPrompt(event.suggested_prompt || '')
    setShowModal(true)
  }

  const handleSaveCustomSeason = async () => {
    if (!modalName.trim() || !modalDate.trim() || !userId || !orgId) return
    // Validate date pattern MM-DD
    const dateMatch = modalDate.match(/^(\d{1,2})-(\d{1,2})$/)
    if (!dateMatch) {
      alert('Ugyldig datoformat. Bruk MM-DD, f.eks. 03-08')
      return
    }
    const month = parseInt(dateMatch[1], 10)
    const day = parseInt(dateMatch[2], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      alert('Ugyldig dato. Måneden må være 01-12 og dagen 01-31.')
      return
    }
    const datePattern = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    setModalSaving(true)

    if (editingEvent) {
      // Update existing custom event
      await supabase
        .from('seasonal_events')
        .update({
          name: modalName.trim(),
          date_pattern: datePattern,
          description: modalDescription.trim() || null,
          icon: modalIcon.trim() || null,
          suggested_prompt: modalPrompt.trim() || null,
        })
        .eq('id', editingEvent.id)
    } else {
      // Create new custom event
      await supabase
        .from('seasonal_events')
        .insert({
          name: modalName.trim(),
          date_pattern: datePattern,
          description: modalDescription.trim() || null,
          icon: modalIcon.trim() || null,
          suggested_prompt: modalPrompt.trim() || null,
          default_enabled: true,
          is_custom: true,
          created_by: userId,
          org_id: orgId,
        })
    }

    setModalSaving(false)
    setShowModal(false)
    await loadEvents()
  }

  const handleDeleteCustomSeason = async (eventId: string) => {
    setDeletingId(eventId)
    await supabase.from('seasonal_events').delete().eq('id', eventId)
    setDeletingId(null)
    setEvents(prev => prev.filter(e => e.id !== eventId))
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
        <div className="mb-8 animate-fade-in-up flex items-start justify-between">
          <div>
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
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Opprett egen sesong
          </button>
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
                          {event.is_custom && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">
                              Egen
                            </span>
                          )}
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

                    {/* Toggle + actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {event.is_custom && (
                        <>
                          <button
                            onClick={() => openEditModal(event)}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
                            title="Rediger"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomSeason(event.id)}
                            disabled={deletingId === event.id}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50"
                            title="Slett"
                          >
                            {deletingId === event.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
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

      {/* Create/Edit custom season modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingEvent ? 'Rediger sesong' : 'Opprett egen sesong'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Navn</label>
                <input
                  type="text"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="F.eks. Firmajubileum"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dato (MM-DD)</label>
                <input
                  type="text"
                  value={modalDate}
                  onChange={e => setModalDate(e.target.value)}
                  placeholder="F.eks. 03-08"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">Format: MM-DD, f.eks. 05-17 for 17. mai</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Beskrivelse</label>
                <input
                  type="text"
                  value={modalDescription}
                  onChange={e => setModalDescription(e.target.value)}
                  placeholder="Kort beskrivelse av sesongen..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ikon/emoji</label>
                <input
                  type="text"
                  value={modalIcon}
                  onChange={e => setModalIcon(e.target.value)}
                  placeholder="F.eks. 🎉"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">AI-prompt forslag</label>
                <textarea
                  value={modalPrompt}
                  onChange={e => setModalPrompt(e.target.value)}
                  placeholder="Lag et innlegg om..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveCustomSeason}
                disabled={modalSaving || !modalName.trim() || !modalDate.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {modalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingEvent ? 'Lagre endringer' : 'Opprett sesong'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
