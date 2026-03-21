'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { BookOpen, X, Pencil, TrendingUp, User, FileText } from 'lucide-react'

type BrandLearning = {
  id: string
  learning_type: string
  rule: string
  source: string
  confidence: number
  active: boolean
  created_at: string
}

export default function LearningsSettings() {
  const [learnings, setLearnings] = useState<BrandLearning[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
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

      const res = await fetch(`/api/posts/learn?org_id=${profile.org_id}`)
      if (res.ok) {
        const json = await res.json()
        setLearnings(json.learnings || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleToggle = async (learningId: string, currentActive: boolean) => {
    setToggling(learningId)
    const res = await fetch('/api/posts/learn', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learning_id: learningId, active: !currentActive }),
    })
    if (res.ok) {
      setLearnings(prev => prev.map(l => l.id === learningId ? { ...l, active: !currentActive } : l))
    }
    setToggling(null)
  }

  const sourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    rejection: X,
    edit: Pencil,
    analytics: TrendingUp,
    manual: User,
  }
  const typeColors: Record<string, string> = {
    style: 'bg-purple-50 text-purple-700 border-purple-100',
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
    topic: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    format: 'bg-orange-50 text-orange-700 border-orange-100',
    timing: 'bg-amber-50 text-amber-700 border-amber-100',
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Laster...</div>

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Hva AI-en har lært</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Regler basert på avvisninger, redigeringer og engasjement
          </p>
        </div>
        <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium border border-indigo-100">
          {learnings.filter(l => l.active).length} aktive
        </span>
      </div>

      {learnings.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Ingen learnings enda</p>
          <p className="text-slate-400 text-xs mt-1">
            Learnings genereres automatisk når innlegg avvises, redigeres eller presterer bra
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {learnings.map((learning) => {
            const SourceIcon = sourceIcons[learning.source] || FileText
            return (
              <div
                key={learning.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                  learning.active ? 'border-slate-200 bg-white hover:shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <SourceIcon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${learning.active ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                    {learning.rule}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-lg border ${typeColors[learning.learning_type] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                      {learning.learning_type}
                    </span>
                    <span className="text-xs text-slate-400">{Math.round(learning.confidence * 100)}%</span>
                    <span className="text-xs text-slate-400">· {new Date(learning.created_at).toLocaleDateString('nb-NO')}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(learning.id, learning.active)}
                  disabled={toggling === learning.id}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    learning.active ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
                    learning.active ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
