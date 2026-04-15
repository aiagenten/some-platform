'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Image, HardDrive, Bell, Brain, Globe, Palette } from 'lucide-react'

const SETTINGS_TABS = [
  { href: '/dashboard/settings', label: 'Kontoer', icon: Users },
  { href: '/dashboard/settings/brand-profiles', label: 'Brand-profiler', icon: Palette },
  { href: '/dashboard/settings/image-generation', label: 'Bildegenerering', icon: Image },
  { href: '/dashboard/settings/storage', label: 'Lagring', icon: HardDrive },
  { href: '/dashboard/settings/notifications', label: 'Varslinger', icon: Bell },
  { href: '/dashboard/settings/learnings', label: 'AI-læring', icon: Brain },
  { href: '/dashboard/settings/website', label: 'Nettside', icon: Globe },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Innstillinger</h1>
      <p className="text-slate-500 mb-6">Administrer kontoen og innstillingene dine</p>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1 scrollbar-hide">
        {SETTINGS_TABS.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
