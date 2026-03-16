'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, draft: 0, pending: 0, approved: 0, published: 0 })
  const [orgName, setOrgName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('org_id, name, organizations(name)')
        .eq('id', user.id)
        .single()

      if (!profile) return
      // @ts-expect-error - joined query
      setOrgName(profile.organizations?.name || '')

      const { data: posts } = await supabase
        .from('social_posts')
        .select('status')
        .eq('org_id', profile.org_id)

      if (posts) {
        setStats({
          total: posts.length,
          draft: posts.filter(p => p.status === 'draft').length,
          pending: posts.filter(p => p.status === 'pending_approval').length,
          approved: posts.filter(p => p.status === 'approved' || p.status === 'scheduled').length,
          published: posts.filter(p => p.status === 'published').length,
        })
      }
    }
    load()
  }, [])

  const cards = [
    { label: 'Totalt', value: stats.total, color: 'bg-gray-100 text-gray-800' },
    { label: 'Utkast', value: stats.draft, color: 'bg-gray-100 text-gray-600' },
    { label: 'Venter', value: stats.pending, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Godkjent', value: stats.approved, color: 'bg-green-50 text-green-700' },
    { label: 'Publisert', value: stats.published, color: 'bg-blue-50 text-blue-700' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 mb-8">{orgName}</p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl p-5 ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm mt-1 opacity-75">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
