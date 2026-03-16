'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Post = {
  id: string
  content_text: string
  caption: string
  platform: string
  status: string
  scheduled_for: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  pending_approval: 'bg-yellow-200 text-yellow-800',
  approved: 'bg-green-200 text-green-800',
  scheduled: 'bg-green-200 text-green-800',
  published: 'bg-blue-200 text-blue-800',
  rejected: 'bg-red-200 text-red-800',
  publishing: 'bg-blue-100 text-blue-600',
  failed: 'bg-red-300 text-red-900',
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  linkedin: '💼',
  tiktok: '🎵',
}

const DAYS_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS_NO = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday = 0, Sunday = 6
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

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [dragPost, setDragPost] = useState<string | null>(null)
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
      .select('id, content_text, caption, platform, status, scheduled_for')
      .eq('org_id', orgId)
      .not('scheduled_for', 'is', null)
      .order('scheduled_for')
    if (data) setPosts(data)
  }, [orgId])

  useEffect(() => { loadPosts() }, [loadPosts])

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
      .update({ scheduled_for: targetDate + 'T12:00:00Z' })
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

  const renderDayCell = (day: Date | null, large: boolean) => {
    if (!day) return <div key={Math.random()} className={large ? 'min-h-[120px]' : ''} />
    const key = dateKey(day)
    const dayPosts = postsByDate[key] || []

    return (
      <div
        key={key}
        className={`border border-gray-100 rounded-lg p-2 cursor-pointer transition hover:bg-gray-50 ${
          isToday(day) ? 'bg-blue-50 border-blue-200' : 'bg-white'
        } ${selectedDate === key ? 'ring-2 ring-blue-400' : ''} ${
          large ? 'min-h-[120px]' : 'min-h-[80px]'
        }`}
        onClick={() => setSelectedDate(selectedDate === key ? null : key)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(key)}
      >
        <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-blue-700' : 'text-gray-700'}`}>
          {day.getDate()}
        </div>
        <div className="space-y-1">
          {dayPosts.slice(0, large ? 4 : 2).map((post) => (
            <div
              key={post.id}
              draggable
              onDragStart={() => setDragPost(post.id)}
              className={`text-xs px-1.5 py-0.5 rounded truncate cursor-move ${STATUS_COLORS[post.status] || 'bg-gray-100'}`}
            >
              {PLATFORM_ICONS[post.platform] || '📱'}{' '}
              {(post.caption || post.content_text || '').slice(0, 30)}
            </div>
          ))}
          {dayPosts.length > (large ? 4 : 2) && (
            <div className="text-xs text-gray-400">+{dayPosts.length - (large ? 4 : 2)} til</div>
          )}
        </div>
      </div>
    )
  }

  const monthDays = getMonthDays(currentDate.getFullYear(), currentDate.getMonth())
  const weekDays = getWeekDays(currentDate)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Innholdskalender</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              Uke
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              Måned
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          {view === 'month'
            ? `${MONTHS_NO[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            : `Uke ${Math.ceil((weekDays[0].getDate() + new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), 1).getDay()) / 7)}, ${MONTHS_NO[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
          }
        </h2>
        <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-lg transition">
          →
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
          <span key={status} className={`px-2 py-0.5 rounded ${STATUS_COLORS[status]}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_NO.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
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

      {/* Selected day detail */}
      {selectedDate && postsByDate[selectedDate] && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            Poster for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {postsByDate[selectedDate].map((post) => (
              <a
                key={post.id}
                href={`/dashboard/posts/${post.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
              >
                <span className="text-xl">{PLATFORM_ICONS[post.platform] || '📱'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {post.caption || post.content_text || 'Ingen innhold'}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[post.status]}`}>
                  {post.status.replace('_', ' ')}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
