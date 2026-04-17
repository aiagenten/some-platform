'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient()

        // Check for errors in hash fragment (Supabase returns errors here)
        const hash = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        const hashError = hashParams.get('error')
        const hashErrorDesc = hashParams.get('error_description')
        if (hashError) {
          console.error('Auth hash error:', hashError, hashErrorDesc)
          setDebugInfo(`${hashError}: ${hashErrorDesc}`)
          setStatus('error')
          return
        }

        // Check for error in URL query params
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        if (error) {
          console.error('Auth error:', error, errorDescription)
          setDebugInfo(`${error}: ${errorDescription}`)
          setStatus('error')
          return
        }

        // Check for code (PKCE flow)
        const code = searchParams.get('code')
        const type = searchParams.get('type') || hashParams.get('type')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError)
            setDebugInfo(exchangeError.message)
            setStatus('error')
            return
          }
          // Password recovery: redirect to profile so user can set new password
          if (type === 'recovery') {
            router.replace('/dashboard/settings/profile?reset=1')
          } else {
            router.replace('/dashboard')
          }
          return
        }

        // Check hash fragment for access_token (implicit flow)
        if (hash && hash.includes('access_token')) {
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            // Manually set session from hash tokens (fixes iOS in-app browser issues)
            const { data: { session: manualSession }, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (setError) {
              console.error('Set session error:', setError)
              setDebugInfo(`setSession: ${setError.message}`)
              setStatus('error')
              return
            }

            if (manualSession) {
              const { data: profile } = await supabase
                .from('users')
                .select('org_id')
                .eq('id', manualSession.user.id)
                .single()

              if (profile?.org_id) {
                router.replace('/dashboard')
              } else {
                router.replace('/onboarding')
              }
              return
            }
          }
        }

        // Try getting the session (works if cookie exists)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          setDebugInfo(sessionError.message)
          setStatus('error')
          return
        }

        if (session) {
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
          return
        }

        // Listen for auth state change (hash fragment processing)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
              subscription.unsubscribe()
              router.replace('/dashboard')
            }
          }
        )

        // Timeout after 8 seconds
        setTimeout(() => {
          subscription.unsubscribe()
          setDebugInfo('Timeout - ingen sesjon funnet. Hash: ' + (window.location.hash ? 'ja' : 'nei'))
          setStatus('error')
        }, 8000)
      } catch (err) {
        console.error('Auth callback error:', err)
        setDebugInfo(String(err))
        setStatus('error')
      }
    }

    handleCallback()
  }, [router, searchParams])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center space-y-4 max-w-md px-4">
          <h1 className="text-xl font-semibold text-white">Noe gikk galt</h1>
          <p className="text-zinc-400">Invitasjonslenken kan ha utløpt, eller noe annet gikk galt.</p>
          {debugInfo && (
            <p className="text-xs text-zinc-600 bg-zinc-900 rounded p-2 break-all">{debugInfo}</p>
          )}
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

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  )
}
