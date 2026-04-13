'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Instagram, Facebook, Linkedin, Music, Smartphone, ChevronLeft, ChevronRight, Target, Settings as SettingsIcon, Minus, Plus, GripVertical, BookOpen } from 'lucide-react'
import Link from 'next/link'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  status: string
  scheduled_for: string | null
  created_at: string
  content_image_url: string | null
}

type WeeklyGoal = {
  id: string
  org_id: string
  platform: string
  weekly_target: number
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_approval: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-emerald-50 text-emerald-700',
  published: 'bg-indigo-50 text-indigo-700',
  rejected: 'bg-red-50 text-red-700',
  publishing: 'bg-blue-50 text-blue-600',
  failed: 'bg-red-100 text-red-800',
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  tiktok: Music,
}

const PLATFORM_DOT_COLORS: Record<string, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  tiktok: 'bg-slate-700',
}

const PLATFORM_BAR_COLORS: Record<string, string> = {
  instagram: 'bg-gradient-to-r from-pink-500 to-purple-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-600',
  blog: 'bg-gradient-to-r from-emerald-500 to-teal-500',
}

const PLATFORMS_LIST = [
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'facebook', label: 'Facebook', icon: Facebook },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'blog', label: 'Artikler', icon: BookOpen },
]

const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS_NO = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const days: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

function getWeekDays(baseDate: Date) {
  const d = new Date(baseDate)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getWeekBounds(baseDate: Date) {
  const days = getWeekDays(baseDate)
  const monday = new Date(days[0])
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(days[6])
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [dragPost, setDragPost] = useState<string | null>(null)
  const [unscheduledPosts, setUnscheduledPosts] = useState<Post[]>([])
  const [goals, setGoals] = useState<WeeklyGoal[]>([])
  const [showGoalSettings, setShowGoalSettings] = useState(false)
  const [weekArticleCount, setWeekArticleCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function getOrg() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('org_id').eq('id', user.id).single()
      if (data) setOrgId(data.org_id)
    }
    getOrg()
  }, [])

  const loadPosts = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('social_posts')
      .select('id, content_text, caption, platform, status, scheduled_for, created_at, content_image_url')
      .eq('org_id', orgId)
      .in('status', ['approved', 'scheduled', 'published', 'draft', 'pending_approval'])
      .not('scheduled_for', 'is', null)
      .order('scheduled_for')
    if (data) setPosts(data)

    // Load unscheduled approved posts
    const { data: unscheduled } = await supabase
      .from('social_posts')
      .select('id, content_text, caption, platform, status, scheduled_for, created_at, content_image_url')
      .eq('org_id', orgId)
      .eq('status', 'approved')
      .is('scheduled_for', null)
      .order('created_at', { ascending: false })
    if (unscheduled) setUnscheduledPosts(unscheduled)

    // Also load all posts for weekly goal counting (approved/published/scheduled this week)
    const { monday, sunday } = getWeekBounds(currentDate)
    const { data: weekPosts } = await supabase
      .from('social_posts')
      .select('id, content_text, caption, platform, status, created_at, scheduled_for, content_image_url')
      .eq('org_id', orgId)
      .in('status', ['approved', 'scheduled', 'published'])
      .gte('created_at', monday.toISOString())
      .lte('created_at', sunday.toISOString())
    if (weekPosts) setAllPosts(weekPosts)

    // Count articles this week for blog goal
    const { data: weekArticles } = await supabase
      .from('articles')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .gte('created_at', monday.toISOString())
      .lte('created_at', sunday.toISOString())
    setWeekArticleCount(weekArticles?.length || 0)
  }, [orgId, currentDate])

  const loadGoals = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/weekly-goals?org_id=${orgId}`)
      if (res.ok) {
        const data = await res.json()
        setGoals(data)
      }
    } catch { /* ignore */ }
  }, [orgId])

  useEffect(() => { loadPosts() }, [loadPosts])
  useEffect(() => { loadGoals() }, [loadGoals])

  const postsByDate = posts.reduce<Record<string, Post[]>>((acc, post) => {
    if (!post.scheduled_for) return acc
    const key = post.scheduled_for.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(post)
    return acc
  }, {})

  const handleDrop = async (targetDate: string) => {
    if (!dragPost) return
    await supabase
      .from('social_posts')
      .update({ scheduled_for: targetDate + 'T12:00:00Z', status: 'scheduled' })
      .eq('id', dragPost)
    setDragPost(null)
    loadPosts()
  }

  const navigate = (dir: number) => {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir * 7)
    setCurrentDate(d)
  }

  const isToday = (d: Date) => dateKey(d) === dateKey(new Date())

  // Weekly goals progress
  const getGoalForPlatform = (platform: string) => goals.find(g => g.platform === platform)?.weekly_target || 0
  const getPostCountForPlatform = (platform: string) => {
    if (platform === 'blog') return weekArticleCount
    return allPosts.filter(p => p.platform === platform).length
  }

  const updateGoal = async (platform: string, target: number) => {
    if (!orgId || target < 0) return
    try {
      await fetch('/api/weekly-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, platform, weekly_target: target }),
      })
      loadGoals()
    } catch { /* ignore */ }
  }

  const renderDayCell = (day: Date | null, large: boolean) => {
    if (!day) return <div key={Math.random()} className={large ? 'min-h-[120px]' : ''} />
    const key = dateKey(day)
    const dayPosts = postsByDate[key] || []

    return (
      <div
        key={key}
        className={`border border-slate-100 rounded-xl p-2 cursor-pointer transition-all duration-200 hover:bg-slate-50 hover:shadow-sm ${
          isToday(day) ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white'
        } ${selectedDate === key ? 'ring-2 ring-indigo-400 shadow-md' : ''} ${
          large ? 'min-h-[120px]' : 'min-h-[80px]'
        }`}
        onClick={() => setSelectedDate(selectedDate === key ? null : key)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(key)}
      >
        <div className={`text-sm font-semibold mb-1.5 ${isToday(day) ? 'text-indigo-700' : 'text-slate-700'}`}>
          {day.getDate()}
        </div>
        <div className="space-y-1">
          {dayPosts.slice(0, large ? 3 : 2).map((post) => (
            <div
              key={post.id}
              draggable
              onDragStart={() => setDragPost(post.id)}
              className={`text-xs px-2 py-1 rounded-lg truncate cursor-move flex items-center gap-1.5 ${STATUS_COLORS[post.status] || 'bg-slate-100'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PLATFORM_DOT_COLORS[post.platform] || 'bg-slate-400'}`} />
              {(post.caption || post.content_text || '').slice(0, 25)}
            </div>
          ))}
          {dayPosts.length > (large ? 3 : 2) && (
            <div className="text-xs text-slate-400 font-medium">+{dayPosts.length - (large ? 3 : 2)} til</div>
          )}
        </div>
      </div>
    )
  }

  const monthDays = getMonthDays(currentDate.getFullYear(), currentDate.getMonth())
  const weekDays = getWeekDays(currentDate)

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Innholdskalender</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGoalSettings(!showGoalSettings)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1.5 border ${
              showGoalSettings ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Target className="w-4 h-4" /> Ukemål
          </button>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                view === 'week' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Uke
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                view === 'month' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Måned
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Goals Progress + Settings */}
      {(showGoalSettings || goals.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" /> Ukemål denne uken
            </h3>
            <button onClick={() => setShowGoalSettings(!showGoalSettings)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <SettingsIcon className="w-3.5 h-3.5" /> {showGoalSettings ? 'Skjul' : 'Rediger'}
            </button>
          </div>

          {/* Progress bars */}
          <div className="space-y-3">
            {PLATFORMS_LIST.map(({ key, label, icon: Icon }) => {
              const target = getGoalForPlatform(key)
              const count = getPostCountForPlatform(key)
              const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0

              if (!showGoalSettings && target === 0) return null

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {count} / {target || '—'}
                      </span>
                      {target > 0 && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${pct >= 100 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {target > 0 && (
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : PLATFORM_BAR_COLORS[key] || 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Settings: adjust target */}
                  {showGoalSettings && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Mål per uke:</span>
                      <button onClick={() => updateGoal(key, Math.max(0, target - 1))} className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold text-slate-800 w-6 text-center">{target}</span>
                      <button onClick={() => updateGoal(key, target + 1)} className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all duration-200 border border-transparent hover:border-slate-200">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800">
          {view === 'month'
            ? `${MONTHS_NO[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            : `Uke ${Math.ceil((weekDays[0].getDate() + new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), 1).getDay()) / 7)}, ${MONTHS_NO[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
          }
        </h2>
        <button onClick={() => navigate(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all duration-200 border border-transparent hover:border-slate-200">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {[
          { status: 'draft', label: 'Utkast' },
          { status: 'pending_approval', label: 'Venter' },
          { status: 'approved', label: 'Godkjent' },
          { status: 'published', label: 'Publisert' },
          { status: 'rejected', label: 'Avvist' },
        ].map(({ status, label }) => (
          <span key={status} className={`px-2.5 py-1 rounded-lg font-medium ${STATUS_COLORS[status]}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_NO.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {view === 'month' ? (
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day, i) => (
            <div key={i}>{renderDayCell(day, true)}</div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => renderDayCell(day, true))}
        </div>
      )}

      {/* Unscheduled approved posts */}
      {unscheduledPosts.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-1">Ikke planlagt</h3>
          <p className="text-sm text-slate-400 mb-4">Dra innlegg til en dato i kalenderen for å planlegge dem.</p>
          <div className="space-y-2">
            {unscheduledPosts.map((post) => {
              const PlatformIcon = PLATFORM_ICONS[post.platform] || Smartphone
              return (
                <div
                  key={post.id}
                  draggable
                  onDragStart={() => setDragPost(post.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:border-emerald-200 hover:shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-slate-100">
                    <PlatformIcon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate font-medium">
                      {post.caption || post.content_text || 'Ingen innhold'}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">{post.platform}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-emerald-50 text-emerald-700 flex-shrink-0">
                    Godkjent
                  </span>
                  <Link
                    href={`/dashboard/posts/${post.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Rediger
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected day detail */}
      {selectedDate && postsByDate[selectedDate] && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm animate-fade-in-up">
          <h3 className="font-semibold text-slate-900 mb-4">
            Poster for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {postsByDate[selectedDate].map((post) => {
              const PlatformIcon = PLATFORM_ICONS[post.platform] || Smartphone
              return (
                <a
                  key={post.id}
                  href={`/dashboard/posts/${post.id}`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${PLATFORM_DOT_COLORS[post.platform] || 'bg-slate-400'}`}>
                    <PlatformIcon className="w-4 h-4 text-white" />
                  </div>
                  {post.content_image_url ? (
                    <img
                      src={post.content_image_url}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-slate-100"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0">
                      <PlatformIcon className="w-5 h-5 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 truncate font-medium">
                      {post.caption || post.content_text || 'Ingen innhold'}
                    </div>
                    <div className="text-xs text-slate-400 capitalize">{post.platform}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${STATUS_COLORS[post.status]}`}>
                    {post.status.replace('_', ' ')}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
