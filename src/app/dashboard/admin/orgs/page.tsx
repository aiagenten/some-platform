'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Building2, Users, FileText, DollarSign, Plus, Edit2, Eye, Settings, X, ChevronDown } from 'lucide-react'

type OrgRow = {
  id: string
  name: string
  slug: string
  industry: string | null
  website_url: string | null
  created_at: string
  user_count: number
  post_count: number
  usage_cost_30d: number
  usage_calls_30d: number
}

const INDUSTRIES = [
  'Teknologi', 'Retail', 'Restaurant', 'Helse', 'Eiendom',
  'Media', 'Finans', 'Sport', 'Utdanning', 'Annet',
]

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)

  // Create org modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newIndustry, setNewIndustry] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit org modal
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const loadOrgs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/orgs')
    const data = await res.json()
    setOrgs(data.orgs || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadOrgs() }, [loadOrgs])

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const handleCreate = async () => {
    setCreateError('')
    if (!newName || !newSlug) { setCreateError('Navn og slug er påkrevd'); return }
    setCreateLoading(true)

    const res = await fetch('/api/admin/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, slug: newSlug, industry: newIndustry, website_url: newWebsite }),
    })
    const data = await res.json()
    setCreateLoading(false)

    if (!res.ok) {
      setCreateError(data.error || 'Noe gikk galt')
    } else {
      setShowCreateModal(false)
      setNewName(''); setNewSlug(''); setNewIndustry(''); setNewWebsite('')
      loadOrgs()
    }
  }

  const handleEdit = async () => {
    if (!editOrg) return
    setEditError('')
    if (!editName || !editSlug) { setEditError('Navn og slug er påkrevd'); return }
    setEditLoading(true)

    const res = await fetch(`/api/admin/orgs/${editOrg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, slug: editSlug, industry: editIndustry, website_url: editWebsite }),
    })
    const data = await res.json()
    setEditLoading(false)

    if (!res.ok) {
      setEditError(data.error || 'Noe gikk galt')
    } else {
      setEditOrg(null)
      loadOrgs()
    }
  }

  const handleSwitchOrg = async (org: OrgRow) => {
    setSwitchingOrgId(org.id)
    // Set in localStorage for client-side reading
    localStorage.setItem('admin_viewing_org_id', org.id)
    localStorage.setItem('admin_viewing_org_name', org.name)
    // Also set via API (cookie)
    await fetch('/api/admin/orgs/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: org.id }),
    })
    setSwitchingOrgId(null)
    window.location.href = '/dashboard'
  }

  const openEdit = (org: OrgRow) => {
    setEditOrg(org)
    setEditName(org.name)
    setEditSlug(org.slug)
    setEditIndustry(org.industry || '')
    setEditWebsite(org.website_url || '')
    setEditError('')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{orgs.length} organisasjoner</p>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ny organisasjon
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-slate-400">Laster organisasjoner...</div>
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Building2 className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Ingen organisasjoner funnet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Navn</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Bransje</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Brukere</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Innlegg</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Bruk (30d)</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => (
                  <tr key={org.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{org.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{org.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {org.industry || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {org.user_count}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-600">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {org.post_count}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-slate-600">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">${org.usage_cost_30d.toFixed(3)}</span>
                        <span className="text-slate-400 text-xs">({org.usage_calls_30d} kall)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/admin/orgs/${org.id}`}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Innstillinger"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => openEdit(org)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Hurtigredigering"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSwitchOrg(org)}
                          disabled={switchingOrgId === org.id}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Se som denne org"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* Create org modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Ny organisasjon</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Navn *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); if (!newSlug) setNewSlug(autoSlug(e.target.value)) }}
                  placeholder="Bedrift AS"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={e => setNewSlug(autoSlug(e.target.value))}
                  placeholder="bedrift-as"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bransje</label>
                <div className="relative">
                  <select
                    value={newIndustry}
                    onChange={e => setNewIndustry(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white appearance-none pr-8"
                  >
                    <option value="">Velg bransje</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nettside</label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={e => setNewWebsite(e.target.value)}
                  placeholder="https://example.no"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            {createError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleCreate}
                disabled={createLoading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {createLoading ? 'Oppretter...' : 'Opprett'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit org modal */}
      {editOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Rediger {editOrg.name}</h2>
              <button onClick={() => setEditOrg(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Navn *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug *</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={e => setEditSlug(autoSlug(e.target.value))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bransje</label>
                <div className="relative">
                  <select
                    value={editIndustry}
                    onChange={e => setEditIndustry(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white appearance-none pr-8"
                  >
                    <option value="">Velg bransje</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nettside</label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={e => setEditWebsite(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            {editError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditOrg(null)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleEdit}
                disabled={editLoading}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {editLoading ? 'Lagrer...' : 'Lagre endringer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
