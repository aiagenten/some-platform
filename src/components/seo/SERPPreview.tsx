'use client'

import { useState } from 'react'
import { Eye, Globe, Bot } from 'lucide-react'

type Props = {
  metaTitle: string
  metaDescription: string
  slug: string
  siteUrl?: string
}

export default function SERPPreview({ metaTitle, metaDescription, slug, siteUrl = 'example.com' }: Props) {
  const [tab, setTab] = useState<'google' | 'ai'>('google')

  const displayTitle = metaTitle || 'Legg til en meta-tittel...'
  const displayDesc = metaDescription || 'Legg til en meta-beskrivelse...'
  const displayUrl = `${siteUrl}/${slug || 'artikkel-slug'}`

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Eye className="w-4 h-4 text-slate-400" />
        Forhåndsvisning
      </h3>

      {/* Tab switch */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
        <button
          onClick={() => setTab('google')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'google' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <Globe className="w-3 h-3" />
          Google
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'ai' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <Bot className="w-3 h-3" />
          AI-svar
        </button>
      </div>

      {tab === 'google' ? (
        /* Google SERP preview */
        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
              <Globe className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-xs text-slate-500 truncate">{displayUrl}</div>
          </div>
          <h4 className={`text-lg leading-snug ${metaTitle ? 'text-blue-700 hover:underline cursor-pointer' : 'text-slate-300 italic'}`}>
            {displayTitle}
          </h4>
          <p className={`text-sm leading-relaxed ${metaDescription ? 'text-slate-600' : 'text-slate-300 italic'}`}>
            {displayDesc}
          </p>
        </div>
      ) : (
        /* AI citation preview */
        <div className="border border-violet-200 rounded-xl p-4 bg-violet-50/30 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-medium text-violet-600">AI-generert svar</span>
          </div>
          <p className={`text-sm leading-relaxed ${metaDescription ? 'text-slate-700' : 'text-slate-300 italic'}`}>
            {displayDesc}
          </p>
          {metaTitle && (
            <div className="flex items-center gap-2 pt-2 border-t border-violet-200/50">
              <div className="w-4 h-4 rounded bg-slate-200 flex items-center justify-center">
                <Globe className="w-2.5 h-2.5 text-slate-400" />
              </div>
              <span className="text-xs text-violet-600 font-medium truncate">{displayTitle}</span>
              <span className="text-[10px] text-slate-400 truncate">{displayUrl}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
