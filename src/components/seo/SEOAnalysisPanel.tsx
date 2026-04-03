'use client'

import { useMemo } from 'react'
import { analyzeSEO, type SEOAnalysis } from '@/lib/seo-analyzer'
import {
  CheckCircle2, AlertTriangle, XCircle, Search, BarChart3,
} from 'lucide-react'

type Props = {
  content: Record<string, unknown> | null
  title: string
  targetKeyword: string
  metaTitle: string
  metaDescription: string
}

const statusIcon = {
  good: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  bad: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wide">SEO</span>
      </div>
    </div>
  )
}

export default function SEOAnalysisPanel({ content, title, targetKeyword, metaTitle, metaDescription }: Props) {
  const analysis: SEOAnalysis = useMemo(
    () => analyzeSEO(content as never, { targetKeyword, metaTitle, metaDescription, title }),
    [content, targetKeyword, metaTitle, metaDescription, title]
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        SEO-analyse
      </h3>

      <ScoreRing score={analysis.totalScore} />

      <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          {analysis.wordCount} ord
        </span>
      </div>

      <div className="space-y-2">
        {analysis.checks.map(check => (
          <div key={check.id} className="flex items-start gap-2 py-1.5">
            {statusIcon[check.status]}
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">{check.label}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{check.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
