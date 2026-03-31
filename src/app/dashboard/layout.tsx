'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, TrendingUp, Calendar, FileText, Sparkles, Video, Palette, Settings, LogOut, Download, Layers, Image as ImageIcon, CheckCircle2, Shield, User, Snowflake, Film, VideoIcon, Users, Activity, Building2, X, BookOpen, Globe, Package } from 'lucide-react'
import { useEffect, useState } from 'react'

type NavItem = { href: string; label: string; icon: typeof BarChart3 }
type NavSection = { section: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    section: 'Oversikt',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/dashboard/calendar', label: 'Kalender', icon: Calendar },
      { href: '/dashboard/seasons', label: 'Sesonger', icon: Snowflake },
    ],
  },
  {
    section: 'Innlegg',
    items: [
      { href: '/dashboard/posts', label: 'Innlegg', icon: FileText },
      { href: '/dashboard/articles', label: 'Artikler', icon: BookOpen },
      { href: '/dashboard/approval', label: 'Godkjenning', icon: CheckCircle2 },
    ],
  },
  {
    section: 'Generer',
    items: [
      { href: '/dashboard/generate', label: 'Bilde', icon: Sparkles },
      { href: '/dashboard/digital-twin', label: 'Digital tvilling', icon: User },
      { href: '/dashboard/video', label: 'Video', icon: Video },
      { href: '/dashboard/video-editor-v2', label: 'Video Studio', icon: Film },
      { href: '/dashboard/product-placement', label: 'Produktplassering', icon: Package },
    ],
  },
  {
    section: 'Mediebibliotek',
    items: [
      { href: '/dashboard/media', label: 'Bilder', icon: ImageIcon },
      { href: '/dashboard/media?type=video', label: 'Videoer', icon: VideoIcon },
    ],
  },
  {
    section: 'Innstillinger',
    items: [
      { href: '/dashboard/brand', label: 'Merkevare', icon: Palette },
      { href: '/dashboard/imported-posts', label: 'Importerte poster', icon: Download },
      { href: '/dashboard/overlay-editor', label: 'Overlay-maler', icon: Layers },
      { href: '/dashboard/settings/website', label: 'Nettside', icon: Globe },
      { href: '/dashboard/settings', label: 'Innstillinger', icon: Settings },
    ],
  },
]

const ADMIN_NAV_SECTION: NavSection = {
  section: 'Admin',
  items: [
    { href: '/dashboard/admin/audit', label: 'Audit Trail', icon: Shield },
    { href: '/dashboard/admin/users', label: 'Brukere', icon: Users },
    { href: '/dashboard/admin/usage', label: 'API-forbruk', icon: Activity },
    { href: '/dashboard/admin/orgs', label: 'Organisasjoner', icon: Building2 },
  ],
}

// Flat list for mobile nav
const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [viewingOrgName, setViewingOrgName] = useState<string | null>(null)

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsSuperAdmin(profile?.role === 'aiagenten_admin')
    }
    checkRole()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for admin org switcher in localStorage
  useEffect(() => {
    const orgName = localStorage.getItem('admin_viewing_org_name')
    setViewingOrgName(orgName)
  }, [])

  const handleExitOrgView = async () => {
    localStorage.removeItem('admin_viewing_org_id')
    localStorage.removeItem('admin_viewing_org_name')
    await fetch('/api/admin/orgs/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: null }),
    })
    setViewingOrgName(null)
    window.location.reload()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const allSections = [...NAV_SECTIONS, ...(isSuperAdmin ? [ADMIN_NAV_SECTION] : [])]
  const allMobileItems = [...NAV_ITEMS, ...(isSuperAdmin ? ADMIN_NAV_SECTION.items : [])]

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200/60 fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            SoMe
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {allSections.map((section) => (
            <div key={section.section}>
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/dashboard' && !item.href.includes('?') && pathname.startsWith(item.href)) ||
                    (item.href.includes('?') && pathname + (typeof window !== 'undefined' ? window.location.search : '') === item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 w-1 h-6 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-r-full" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Logg ut
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="flex items-center justify-between h-14 px-4">
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            SoMe
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-hide">
          {allMobileItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && !item.href.includes('?') && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 lg:ml-64 pt-24 lg:pt-0">
        {/* Admin org switcher banner */}
        {viewingOrgName && (
          <div className="bg-amber-400 text-amber-900 px-4 py-2.5 flex items-center justify-between gap-4">
            <span className="text-sm font-medium">
              👁 Du ser plattformen som: <strong>{viewingOrgName}</strong>
            </span>
            <button
              onClick={handleExitOrgView}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 px-3 py-1 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Avslutt
            </button>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
