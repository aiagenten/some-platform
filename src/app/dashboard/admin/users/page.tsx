'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Search, Plus, Building2, Mail, Trash2, Edit2, X, ChevronDown, RefreshCw } from 'lucide-react'

type OrgInfo = { id: string; name: string; slug: string }

type UserRow = {
  id: string
  name: string | null
  email: string | null
  role: string
  avatar_url: string | null
  created_at: string
  org_id: string | null
  organizations: OrgInfo | null
}

type Org = {
  id: string
  name: string
  slug: string
  industry: string | null
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Medlem' },
  { value: 'admin', label: 'Admin' },
  { value: 'aiagenten_admin', label: 'Super Admin' },
]

const ROLE_COLORS: Record<string, string> = {
  member: 'bg-slate-100 text-slate-600',
  admin: 'bg-blue-50 text-blue-700',
  aiagenten_admin: 'bg-purple-50 text-purple-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteOrgId, setInviteOrgId] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Create org + invite modal
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgSlug, setNewOrgSlug] = useState('')
  const [newOrgIndustry, setNewOrgIndustry] = useState('')
  const [newOrgEmail, setNewOrgEmail] = useState('')
  const [newOrgUserName, setNewOrgUserName] = useState('')
  const [createOrgLoading, setCreateOrgLoading] = useState(false)
  const [createOrgError, setCreateOrgError] = useState('')

  // Resend invite
  const [resendingUserId, setResendingUserId] = useState<string | null>(null)

  // Edit role
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (orgFilter) params.set('org_id', orgFilter)

    const [usersRes, orgsRes] = await Promise.all([
      fetch(`/api/admin/users?${params}`),
      fetch('/api/admin/orgs'),
    ])

    const usersData = await usersRes.json()
    const orgsData = await orgsRes.json()

    setUsers(usersData.users || [])
    setOrgs(orgsData.orgs || [])
    setLoading(false)
  }, [search, orgFilter])

  useEffect(() => {
    const timer = setTimeout(loadData, 300)
    return () => clearTimeout(timer)
  }, [loadData])

  const handleInvite = async () => {
    setInviteError('')
    setInviteSuccess('')
    if (!inviteEmail || !inviteOrgId) {
      setInviteError('E-post og organisasjon er påkrevd')
      return
    }
    setInviteLoading(true)

    const res = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, org_id: inviteOrgId, role: inviteRole }),
    })
    const data = await res.json()
    setInviteLoading(false)

    if (!res.ok) {
      setInviteError(data.error || 'Noe gikk galt')
    } else {
      setInviteSuccess(data.message || 'Invitasjon sendt!')
      setInviteEmail('')
      setInviteName('')
      setInviteOrgId('')
      setInviteRole('member')
      loadData()
    }
  }

  const handleCreateOrgAndInvite = async () => {
    setCreateOrgError('')
    if (!newOrgName || !newOrgSlug || !newOrgEmail) {
      setCreateOrgError('Navn, slug og e-post er påkrevd')
      return
    }
    setCreateOrgLoading(true)

    // Create org
    const orgRes = await fetch('/api/admin/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName, slug: newOrgSlug, industry: newOrgIndustry }),
    })
    const orgData = await orgRes.json()

    if (!orgRes.ok) {
      setCreateOrgError(orgData.error || 'Kunne ikke opprette org')
      setCreateOrgLoading(false)
      return
    }

    // Invite user
    const inviteRes = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newOrgEmail,
        name: newOrgUserName || newOrgEmail.split('@')[0],
        org_id: orgData.org.id,
        role: 'admin',
      }),
    })
    const inviteData = await inviteRes.json()
    setCreateOrgLoading(false)

    if (!inviteRes.ok) {
      setCreateOrgError(inviteData.error || 'Org opprettet men invitasjon feilet')
    } else {
      setShowCreateOrgModal(false)
      setNewOrgName('')
      setNewOrgSlug('')
      setNewOrgIndustry('')
      setNewOrgEmail('')
      setNewOrgUserName('')
      loadData()
    }
  }

  const handleUpdateRole = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: editRole }),
    })
    setEditingUserId(null)
    loadData()
  }

  const handleResendInvite = async (user: UserRow) => {
    if (!user.email) return
    setResendingUserId(user.id)
    try {
      const res = await fetch('/api/admin/users/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, org_id: user.org_id, role: user.role }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Invitasjon sendt!')
      } else {
        alert(data.error || 'Kunne ikke sende invitasjon')
      }
    } catch {
      alert('Noe gikk galt')
    }
    setResendingUserId(null)
  }

  const handleDeleteUser = async (userId: string, userEmail: string | null) => {
    if (!confirm(`Fjern ${userEmail || userId} fra plattformen?`)) return
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    loadData()
  }

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Søk etter navn eller e-post..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
          />
        </div>
        <select
          value={orgFilter}
          onChange={e => setOrgFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white min-w-[180px]"
        >
          <option value="">Alle organisasjoner</option>
          {orgs.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button
          onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess('') }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          <Mail className="w-4 h-4" />
          Inviter bruker
        </button>
        <button
          onClick={() => { setShowCreateOrgModal(true); setCreateOrgError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Ny org
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-slate-400">Laster brukere...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Users className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Ingen brukere funnet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Bruker</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Organisasjon</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Rolle</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Registrert</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.name || '—'}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.organizations ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700">{u.organizations.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Ingen org</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                          >
                            {ROLE_OPTIONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUpdateRole(u.id)}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          >
                            Lagre
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('nb-NO')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleResendInvite(u)}
                          disabled={resendingUserId === u.id}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                          title="Send invitasjon på nytt"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${resendingUserId === u.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => { setEditingUserId(u.id); setEditRole(u.role) }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Endre rolle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Fjern bruker"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-2">{users.length} brukere totalt</p>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Inviter bruker</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-post *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="bruker@example.com"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Navn</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Ola Nordmann"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organisasjon *</label>
                <div className="relative">
                  <select
                    value={inviteOrgId}
                    onChange={e => setInviteOrgId(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white appearance-none pr-8"
                  >
                    <option value="">Velg organisasjon</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rolle</label>
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white appearance-none pr-8"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {inviteError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{inviteSuccess}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteLoading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {inviteLoading ? 'Sender...' : 'Send invitasjon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Org + Invite Modal */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Ny organisasjon + bruker</h2>
              <button onClick={() => setShowCreateOrgModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Organisasjon</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Navn *</label>
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={e => {
                        setNewOrgName(e.target.value)
                        if (!newOrgSlug) setNewOrgSlug(autoSlug(e.target.value))
                      }}
                      placeholder="Bedrift AS"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
                    <input
                      type="text"
                      value={newOrgSlug}
                      onChange={e => setNewOrgSlug(autoSlug(e.target.value))}
                      placeholder="bedrift-as"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bransje</label>
                    <input
                      type="text"
                      value={newOrgIndustry}
                      onChange={e => setNewOrgIndustry(e.target.value)}
                      placeholder="f.eks. Teknologi, Retail..."
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Første bruker</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-post *</label>
                    <input
                      type="email"
                      value={newOrgEmail}
                      onChange={e => setNewOrgEmail(e.target.value)}
                      placeholder="admin@bedrift.no"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Navn</label>
                    <input
                      type="text"
                      value={newOrgUserName}
                      onChange={e => setNewOrgUserName(e.target.value)}
                      placeholder="Ola Nordmann"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {createOrgError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createOrgError}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateOrgModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleCreateOrgAndInvite}
                disabled={createOrgLoading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {createOrgLoading ? 'Oppretter...' : 'Opprett og inviter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
