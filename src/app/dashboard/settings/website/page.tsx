'use client'

import { useEffect, useState } from 'react'
import { Globe, Loader2, CheckCircle2, XCircle, Info, ExternalLink } from 'lucide-react'

type Integration = {
  id: string
  platform: string
  wordpress_url: string
  wordpress_username: string
  settings: Record<string, unknown>
} | null

export default function WebsiteSettingsPage() {
  const [, setIntegration] = useState<Integration>(null)
  const [platform, setPlatform] = useState<'wordpress' | 'other'>('wordpress')
  const [wpUrl, setWpUrl] = useState('')
  const [wpUsername, setWpUsername] = useState('')
  const [wpPassword, setWpPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/integrations/website')
      const data = await res.json()
      if (data?.platform) {
        setIntegration(data)
        setPlatform(data.platform)
        setWpUrl(data.wordpress_url || '')
        setWpUsername(data.wordpress_username || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/integrations/website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        wordpress_url: wpUrl || null,
        wordpress_username: wpUsername || null,
        wordpress_app_password: wpPassword || null,
      }),
    })
    const data = await res.json()
    if (data.id) setIntegration(data)
    setSaving(false)
    setTestResult(null)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/integrations/website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'wordpress',
        wordpress_url: wpUrl,
        wordpress_username: wpUsername,
        wordpress_app_password: wpPassword,
        test: true,
      }),
    })
    const data = await res.json()
    setTesting(false)
    if (data.success) {
      setTestResult({ success: true, message: `Tilkoblet som ${data.user}` })
    } else {
      setTestResult({ success: false, message: data.error || 'Tilkobling feilet' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nettside-integrasjon</h1>
        <p className="text-sm text-slate-500 mt-1">Koble til WordPress eller annen plattform for å publisere artikler</p>
      </div>

      {/* Platform selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-400" />
          Plattform
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPlatform('wordpress')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              platform === 'wordpress'
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-semibold text-slate-900">WordPress</div>
            <div className="text-xs text-slate-500 mt-1">Publiser direkte via REST API</div>
          </button>
          <button
            onClick={() => setPlatform('other')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              platform === 'other'
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-semibold text-slate-900">Annen plattform</div>
            <div className="text-xs text-slate-500 mt-1">Eksporter HTML manuelt</div>
          </button>
        </div>

        {platform === 'wordpress' && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">WordPress URL</label>
              <input
                type="url"
                value={wpUrl}
                onChange={e => setWpUrl(e.target.value)}
                placeholder="https://dinside.no"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Brukernavn</label>
              <input
                type="text"
                value={wpUsername}
                onChange={e => setWpUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Application Password</label>
              <input
                type="password"
                value={wpPassword}
                onChange={e => setWpPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {testResult.message}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleTest}
                disabled={testing || !wpUrl || !wpUsername || !wpPassword}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Tester...</span>
                ) : 'Test tilkobling'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lagrer...</span>
                ) : 'Lagre innstillinger'}
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Slik lager du Application Password i WordPress
              </h4>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Logg inn på WordPress-admin (wp-admin)</li>
                <li>Gå til <strong>Brukere → Profil</strong></li>
                <li>Scroll ned til <strong>Application Passwords</strong></li>
                <li>Skriv inn et navn (f.eks. &quot;SoMe-plattform&quot;) og klikk &quot;Legg til nytt Application Password&quot;</li>
                <li>Kopier passordet som vises og lim det inn her</li>
              </ol>
              <a
                href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
              >
                Les mer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {platform === 'other' && (
          <div className="space-y-4 pt-2">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-600">
                Du kan bruke artikkel-editoren til å skrive innhold og eksportere det som HTML.
                Kopier HTML-koden og lim den inn i din CMS.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lagrer...</span>
              ) : 'Lagre innstillinger'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
