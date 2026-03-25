'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient()
        
        // Supabase client auto-detects hash fragments and sets the session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          setStatus('error')
          return
        }

        if (session) {
          // Check if user has completed onboarding
          const { data: profile } = await supabase
            .from('users')
            .select('org_id')
            .eq('id', session.user.id)
            .single()

          if (profile?.org_id) {
            router.replace('/dashboard')
          } else {
            router.replace('/onboarding')
          }
        } else {
          // No session yet — wait for Supabase to pick up the hash
          // Listen for auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
              if (event === 'SIGNED_IN' && session) {
                subscription.unsubscribe()
                router.replace('/dashboard')
              }
            }
          )

          // Timeout after 5 seconds
          setTimeout(() => {
            subscription.unsubscribe()
            setStatus('error')
          }, 5000)
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setStatus('error')
      }
    }

    handleCallback()
  }, [router])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-white">Noe gikk galt</h1>
          <p className="text-zinc-400">Invitasjonslenken kan ha utløpt.</p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-white text-zinc-900 rounded-lg font-medium hover:bg-zinc-100 transition"
          >
            Gå til innlogging
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
        <p className="text-zinc-400">Logger deg inn...</p>
      </div>
    </div>
  )
}
