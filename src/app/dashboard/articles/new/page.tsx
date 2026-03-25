'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function NewArticlePage() {
  const router = useRouter()

  useEffect(() => {
    async function create() {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Uten tittel' }),
      })
      const article = await res.json()
      if (article.id) {
        router.replace(`/dashboard/articles/${article.id}`)
      } else {
        router.replace('/dashboard/articles')
      }
    }
    create()
  }, [router])

  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      <span className="ml-3 text-sm text-slate-500">Oppretter artikkel...</span>
    </div>
  )
}
