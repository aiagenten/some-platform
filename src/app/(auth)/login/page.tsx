'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Skriv inn e-postadressen din')
      return
    }
    setResetLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })

    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {resetMode ? 'Tilbakestill passord' : 'Logg inn'}
          </h1>
          <p className="text-gray-500 mt-2">
            {resetMode
              ? 'Skriv inn e-posten din — vi sender en lenke for å sette nytt passord'
              : 'Velkommen tilbake til SoMe-plattformen'}
          </p>
        </div>

        {resetMode ? (
          resetSent ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 text-emerald-700 text-sm p-4 rounded-lg text-center">
                <p className="font-medium mb-1">E-post sendt!</p>
                <p>Sjekk innboksen din for en lenke til å tilbakestille passordet. Sjekk også søppelpost/spam.</p>
              </div>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
                className="w-full text-sm text-blue-600 hover:underline font-medium"
              >
                Tilbake til innlogging
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-post
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
                  placeholder="din@epost.no"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? 'Sender...' : 'Send tilbakestillingslenke'}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(false); setError('') }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Tilbake til innlogging
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-post
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
                  placeholder="din@epost.no"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Passord
                  </label>
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setError('') }}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Glemt passord?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 placeholder:text-gray-400"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logger inn...' : 'Logg inn'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Har du ikke konto?{' '}
              <Link href="/signup" className="text-blue-600 hover:underline font-medium">
                Registrer deg
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
