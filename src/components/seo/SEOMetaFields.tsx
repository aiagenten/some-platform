'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Search, Type, FileText, Link as LinkIcon } from 'lucide-react'

type Props = {
  targetKeyword: string
  metaTitle: string
  metaDescription: string
  slug: string
  title: string
  onChangeKeyword: (v: string) => void
  onChangeMetaTitle: (v: string) => void
  onChangeMetaDescription: (v: string) => void
  onChangeSlug: (v: string) => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function SEOMetaFields({
  targetKeyword, metaTitle, metaDescription, slug, title,
  onChangeKeyword, onChangeMetaTitle, onChangeMetaDescription, onChangeSlug,
}: Props) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          SEO &amp; Meta
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {/* Target keyword */}
          <div>
            <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
              <Type className="w-3 h-3" />
              Mål-nøkkelord
            </label>
            <input
              type="text"
              value={targetKeyword}
              onChange={e => onChangeKeyword(e.target.value)}
              placeholder="f.eks. digital markedsføring"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>

          {/* Meta title */}
          <div>
            <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Meta-tittel
              </span>
              <span className={`tabular-nums ${metaTitle.length > 60 ? 'text-red-500' : metaTitle.length >= 50 ? 'text-emerald-500' : ''}`}>
                {metaTitle.length}/60
              </span>
            </label>
            <input
              type="text"
              value={metaTitle}
              onChange={e => onChangeMetaTitle(e.target.value)}
              placeholder="Tittel som vises i søkeresultater"
              maxLength={70}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>

          {/* Meta description */}
          <div>
            <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Meta-beskrivelse
              </span>
              <span className={`tabular-nums ${metaDescription.length > 160 ? 'text-red-500' : metaDescription.length >= 120 ? 'text-emerald-500' : ''}`}>
                {metaDescription.length}/160
              </span>
            </label>
            <textarea
              value={metaDescription}
              onChange={e => onChangeMetaDescription(e.target.value)}
              placeholder="Kort beskrivelse for søkemotorer..."
              rows={3}
              maxLength={200}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
              <LinkIcon className="w-3 h-3" />
              URL-slug
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={slug}
                onChange={e => onChangeSlug(e.target.value)}
                placeholder="artikkel-url-sti"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
              <button
                onClick={() => onChangeSlug(slugify(title))}
                className="px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
                title="Generer fra tittel"
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
