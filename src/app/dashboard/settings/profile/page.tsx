'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, Mail, Lock, Save, Loader2, CheckCircle2, AlertCircle, Building2, Shield, Calendar } from 'lucide-react'

type UserProfile = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: string
  org_id: string
  created_at: string
}

type OrgInfo = {
  name: string
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [loading, setLoading] = useState(true)

  // Edit states
  const [name, setName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI states
  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; section: string } | null>(null)

  const [showResetBanner, setShowResetBanner] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reset') === '1') setShowResetBanner(true)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setAuthEmail(user.email || '')

      const { data: profileData } = await supabase
        .from('users')
        .select('id, name, email, avatar_url, role, org_id, created_at')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setName(profileData.name || '')
        setNewEmail(profileData.email || user.email || '')

        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profileData.org_id)
          .single()
        if (orgData) setOrg(orgData)
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showMessage = (type: 'success' | 'error', text: string, section: string) => {
    setMessage({ type, text, section })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSaveName = async () => {
    if (!profile || !name.trim()) return
    setSavingName(true)
    const { error } = await supabase
      .from('users')
      .update({ name: name.trim() })
      .eq('id', profile.id)

    if (error) {
      showMessage('error', 'Kunne ikke oppdatere navn: ' + error.message, 'name')
    } else {
      setProfile({ ...profile, name: name.trim() })
      showMessage('success', 'Navnet ditt er oppdatert', 'name')
    }
    setSavingName(false)
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || newEmail === authEmail) return
    setSavingEmail(true)

    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })

    if (error) {
      showMessage('error', 'Kunne ikke endre e-post: ' + error.message, 'email')
    } else {
      showMessage('success', 'Bekreftelseslenke er sendt til din nye e-postadresse. Sjekk innboksen.', 'email')
    }
    setSavingEmail(false)
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showMessage('error', 'Fyll inn begge passordfeltene', 'password')
      return
    }
    if (newPassword.length < 8) {
      showMessage('error', 'Passordet må være minst 8 tegn', 'password')
      return
    }
    if (newPassword !== confirmPassword) {
      showMessage('error', 'Passordene er ikke like', 'password')
      return
    }
    setSavingPassword(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      showMessage('error', 'Kunne ikke endre passord: ' + error.message, 'password')
    } else {
      showMessage('success', 'Passordet ditt er oppdatert', 'password')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    editor: 'Redaktør',
    viewer: 'Leser',
    aiagenten_admin: 'Plattformadministrator',
    member: 'Medlem',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-slate-500">Profil ikke funnet</div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {showResetBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Sett nytt passord</p>
            <p className="text-xs text-amber-700 mt-1">
              Du er logget inn via tilbakestillingslenken. Sett et nytt passord nedenfor.
            </p>
          </div>
        </div>
      )}

      {/* Profile info header */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <User className="w-8 h-8 text-indigo-600" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{profile.name || 'Uten navn'}</h2>
            <p className="text-sm text-slate-500">{authEmail}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Shield className="w-4 h-4 text-slate-400" />
            <span>{roleLabels[profile.role] || profile.role}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>{org?.name || 'Ukjent organisasjon'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 col-span-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Medlem siden {new Date(profile.created_at).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          Navn
        </h3>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ditt fulle navn"
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || name === profile.name}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lagre
          </button>
        </div>
        {message?.section === 'name' && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>

      {/* Email */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400" />
          E-postadresse
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          En bekreftelseslenke sendes til din nye e-post. Gammel e-post forblir aktiv til du bekrefter.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="ny@epost.no"
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300"
          />
          <button
            onClick={handleChangeEmail}
            disabled={savingEmail || !newEmail.trim() || newEmail === authEmail}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Endre e-post
          </button>
        </div>
        {message?.section === 'email' && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" />
          Endre passord
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Passordet må være minst 8 tegn.
        </p>
        <div className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nytt passord"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Bekreft nytt passord"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-slate-300"
          />
          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Oppdater passord
          </button>
        </div>
        {message?.section === 'password' && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
