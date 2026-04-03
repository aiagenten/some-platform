// ── Client-side SEO analysis for TipTap JSON content ────────────────────────

export type SEOCheckResult = {
  id: string
  label: string
  status: 'good' | 'warning' | 'bad'
  message: string
  score: number // 0-10 contribution to total
}

export type SEOAnalysis = {
  checks: SEOCheckResult[]
  totalScore: number // 0-100
  wordCount: number
}

type TipTapNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractText(node: TipTapNode): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(extractText).join('')
}

function extractParagraphs(doc: TipTapNode): string[] {
  if (!doc.content) return []
  return doc.content
    .filter(n => n.type === 'paragraph')
    .map(extractText)
    .filter(Boolean)
}

function extractHeadings(doc: TipTapNode): { level: number; text: string }[] {
  if (!doc.content) return []
  return doc.content
    .filter(n => n.type === 'heading')
    .map(n => ({
      level: (n.attrs?.level as number) || 1,
      text: extractText(n),
    }))
}

function extractImages(doc: TipTapNode): { src: string; alt: string }[] {
  const images: { src: string; alt: string }[] = []
  function walk(node: TipTapNode) {
    if (node.type === 'image') {
      images.push({
        src: (node.attrs?.src as string) || '',
        alt: (node.attrs?.alt as string) || '',
      })
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return images
}

function extractLinks(doc: TipTapNode): { href: string; internal: boolean }[] {
  const links: { href: string; internal: boolean }[] = []
  function walk(node: TipTapNode) {
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'link' && mark.attrs?.href) {
          const href = mark.attrs.href as string
          links.push({
            href,
            internal: href.startsWith('/') || href.includes('aiagenten.no'),
          })
        }
      }
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return links
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}

/** Norsk LIX-beregning (Lesbarhetsindeks) */
function calculateLix(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (sentences.length === 0 || words.length === 0) return 0

  const longWords = words.filter(w => w.length > 6).length
  const avgWordsPerSentence = words.length / sentences.length
  const longWordPercentage = (longWords / words.length) * 100

  return Math.round(avgWordsPerSentence + longWordPercentage)
}

// ── Main analysis function ──────────────────────────────────────────────────

export function analyzeSEO(
  doc: TipTapNode | null,
  options: {
    targetKeyword?: string
    metaTitle?: string
    metaDescription?: string
    title?: string
  }
): SEOAnalysis {
  if (!doc) {
    return { checks: [], totalScore: 0, wordCount: 0 }
  }

  const checks: SEOCheckResult[] = []
  const fullText = extractText(doc)
  const wordCount = countWords(fullText)
  const paragraphs = extractParagraphs(doc)
  const headings = extractHeadings(doc)
  const images = extractImages(doc)
  const links = extractLinks(doc)
  const keyword = (options.targetKeyword || '').toLowerCase().trim()
  const title = (options.title || '').toLowerCase()

  // a) Target keyword i tittel
  if (keyword) {
    const inTitle = title.includes(keyword)
    checks.push({
      id: 'keyword-title',
      label: 'Nøkkelord i tittel',
      status: inTitle ? 'good' : 'bad',
      message: inTitle
        ? `Nøkkelordet "${options.targetKeyword}" finnes i tittelen`
        : `Legg til "${options.targetKeyword}" i tittelen`,
      score: inTitle ? 10 : 0,
    })
  } else {
    checks.push({
      id: 'keyword-title',
      label: 'Nøkkelord i tittel',
      status: 'warning',
      message: 'Sett et mål-nøkkelord for å analysere',
      score: 0,
    })
  }

  // b) Target keyword i første avsnitt
  if (keyword && paragraphs.length > 0) {
    const inFirst = paragraphs[0].toLowerCase().includes(keyword)
    checks.push({
      id: 'keyword-intro',
      label: 'Nøkkelord i første avsnitt',
      status: inFirst ? 'good' : 'bad',
      message: inFirst
        ? 'Nøkkelordet finnes i introduksjonen'
        : 'Legg til nøkkelordet i første avsnitt',
      score: inFirst ? 10 : 0,
    })
  } else if (keyword) {
    checks.push({
      id: 'keyword-intro',
      label: 'Nøkkelord i første avsnitt',
      status: 'bad',
      message: 'Ingen avsnitt funnet',
      score: 0,
    })
  }

  // c) Keyword-tetthet
  if (keyword && wordCount > 0) {
    const kwWords = keyword.split(/\s+/).length
    const fullLower = fullText.toLowerCase()
    let kwCount = 0
    let startIdx = 0
    while ((startIdx = fullLower.indexOf(keyword, startIdx)) !== -1) {
      kwCount++
      startIdx += keyword.length
    }
    const density = (kwCount * kwWords / wordCount) * 100
    const optimal = density >= 1 && density <= 3
    const tooHigh = density > 3
    checks.push({
      id: 'keyword-density',
      label: 'Nøkkelord-tetthet',
      status: optimal ? 'good' : tooHigh ? 'bad' : 'warning',
      message: `${density.toFixed(1)}% (optimalt: 1-3%). Nøkkelordet brukt ${kwCount} ganger.`,
      score: optimal ? 10 : tooHigh ? 2 : 5,
    })
  }

  // d) Meta title lengde
  const metaTitle = options.metaTitle || ''
  const mtLen = metaTitle.length
  if (mtLen === 0) {
    checks.push({
      id: 'meta-title',
      label: 'Meta-tittel',
      status: 'bad',
      message: 'Mangler meta-tittel. Legg til en på 50-60 tegn.',
      score: 0,
    })
  } else {
    const optimal = mtLen >= 50 && mtLen <= 60
    const ok = mtLen >= 30 && mtLen <= 70
    checks.push({
      id: 'meta-title',
      label: 'Meta-tittel',
      status: optimal ? 'good' : ok ? 'warning' : 'bad',
      message: `${mtLen} tegn (optimalt: 50-60)`,
      score: optimal ? 10 : ok ? 6 : 2,
    })
  }

  // e) Meta description lengde
  const metaDesc = options.metaDescription || ''
  const mdLen = metaDesc.length
  if (mdLen === 0) {
    checks.push({
      id: 'meta-description',
      label: 'Meta-beskrivelse',
      status: 'bad',
      message: 'Mangler meta-beskrivelse. Legg til en på 120-160 tegn.',
      score: 0,
    })
  } else {
    const optimal = mdLen >= 120 && mdLen <= 160
    const ok = mdLen >= 80 && mdLen <= 200
    checks.push({
      id: 'meta-description',
      label: 'Meta-beskrivelse',
      status: optimal ? 'good' : ok ? 'warning' : 'bad',
      message: `${mdLen} tegn (optimalt: 120-160)`,
      score: optimal ? 10 : ok ? 6 : 2,
    })
  }

  // f) Overskriftsstruktur
  const h1s = headings.filter(h => h.level === 1)
  const levels = headings.map(h => h.level)
  let hierarchyOk = true
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      hierarchyOk = false
      break
    }
  }
  const headingOk = h1s.length <= 1 && hierarchyOk && headings.length >= 2
  checks.push({
    id: 'heading-structure',
    label: 'Overskriftsstruktur',
    status: headingOk ? 'good' : h1s.length > 1 ? 'bad' : 'warning',
    message: h1s.length > 1
      ? `${h1s.length} H1-overskrifter funnet (bør kun ha 1)`
      : !hierarchyOk
        ? 'Overskriftshierarkiet hopper over nivåer'
        : headings.length < 2
          ? 'Legg til flere overskrifter for bedre struktur'
          : `${headings.length} overskrifter med riktig hierarki`,
    score: headingOk ? 10 : h1s.length > 1 ? 2 : 5,
  })

  // g) Intern/ekstern link-telling
  const internalLinks = links.filter(l => l.internal).length
  const externalLinks = links.filter(l => !l.internal).length
  const hasLinks = internalLinks > 0 || externalLinks > 0
  checks.push({
    id: 'links',
    label: 'Lenker',
    status: hasLinks ? 'good' : 'warning',
    message: `${internalLinks} interne, ${externalLinks} eksterne lenker${!hasLinks ? ' — legg til relevante lenker' : ''}`,
    score: hasLinks ? 10 : 3,
  })

  // h) Bilder alt-tekst
  if (images.length === 0) {
    checks.push({
      id: 'image-alt',
      label: 'Bilder og alt-tekst',
      status: 'warning',
      message: 'Ingen bilder funnet. Bilder kan forbedre engasjement.',
      score: 5,
    })
  } else {
    const withAlt = images.filter(img => img.alt.trim().length > 0).length
    const allHaveAlt = withAlt === images.length
    checks.push({
      id: 'image-alt',
      label: 'Bilder og alt-tekst',
      status: allHaveAlt ? 'good' : 'bad',
      message: allHaveAlt
        ? `${images.length} bilder, alle med alt-tekst`
        : `${withAlt}/${images.length} bilder har alt-tekst`,
      score: allHaveAlt ? 10 : Math.round((withAlt / images.length) * 5),
    })
  }

  // i) Ordtelling
  const wordOk = wordCount >= 800
  const wordWarning = wordCount >= 400
  checks.push({
    id: 'word-count',
    label: 'Ordtelling',
    status: wordOk ? 'good' : wordWarning ? 'warning' : 'bad',
    message: `${wordCount} ord${wordOk ? '' : ` (anbefalt: minst 800 for SEO)`}`,
    score: wordOk ? 10 : wordWarning ? 5 : 2,
  })

  // j) Lesbarhet (LIX)
  const lix = calculateLix(fullText)
  // LIX scale: <25 very easy, 25-35 easy, 35-45 medium, 45-55 hard, >55 very hard
  const readabilityGood = lix > 0 && lix <= 45
  const readabilityOk = lix > 0 && lix <= 55
  checks.push({
    id: 'readability',
    label: 'Lesbarhet (LIX)',
    status: lix === 0 ? 'warning' : readabilityGood ? 'good' : readabilityOk ? 'warning' : 'bad',
    message: lix === 0
      ? 'For lite tekst å analysere'
      : `LIX ${lix} — ${lix <= 25 ? 'Svært lettlest' : lix <= 35 ? 'Lettlest' : lix <= 45 ? 'Middels' : lix <= 55 ? 'Vanskelig' : 'Svært vanskelig'}`,
    score: lix === 0 ? 0 : readabilityGood ? 10 : readabilityOk ? 5 : 2,
  })

  // Calculate total score (0-100)
  const maxPossible = checks.length * 10
  const rawScore = checks.reduce((sum, c) => sum + c.score, 0)
  const totalScore = maxPossible > 0 ? Math.round((rawScore / maxPossible) * 100) : 0

  return { checks, totalScore, wordCount }
}
