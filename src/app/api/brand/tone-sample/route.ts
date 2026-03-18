import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY

// NOTE: tone_samples table must exist in Supabase:
// CREATE TABLE IF NOT EXISTS tone_samples (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
//   source_url text,
//   content_preview text,
//   source_type text DEFAULT 'text',
//   created_at timestamptz DEFAULT now()
// );

export async function POST(request: NextRequest) {
  const { org_id, text, url } = await request.json()
  if (!org_id || (!text && !url)) {
    return NextResponse.json({ error: "org_id og text eller url kreves" }, { status: 400 })
  }

  let content = text || ""

  // Scrape URL hvis gitt
  if (url && !text) {
    try {
      if (FIRECRAWL_API_KEY) {
        const FirecrawlApp = (await import("@mendable/firecrawl-js")).default
        const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY })
        const result = await app.scrape(url, { formats: ["markdown"] }) as Record<string, unknown>
        content = ((result.markdown as string) || "").slice(0, 5000)
      } else {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
        const html = await res.text()
        content = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 5000)
      }
    } catch {
      return NextResponse.json({ error: "Kunne ikke hente innhold fra URL" }, { status: 400 })
    }
  }

  // Analyser tone of voice med AI
  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [{
        role: "system",
        content: `Du er en merkevareanalytiker. Analyser teksten og trekk ut 3-5 konkrete skrivestilregler som beskriver tone of voice.
Returner KUN gyldig JSON: { "rules": [{ "rule": "...", "type": "tone" }] }
Reglene skal være konkrete og handlingsorienterte, f.eks.:
- "Bruk korte setninger og aktiv setningsbygning"
- "Unngå fagsjargong — skriv som du snakker"
- "Avslutt alltid med et spørsmål eller en oppfordring"
Skriv på norsk.`
      }, {
        role: "user",
        content: `Analyser denne teksten:\n\n${content}`
      }],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  })

  const aiData = await aiRes.json()
  const aiText = aiData.choices?.[0]?.message?.content || ""
  const jsonMatch = aiText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: "AI-analyse feilet" }, { status: 500 })

  const { rules } = JSON.parse(jsonMatch[0])
  const supabase = createAdminClient()

  // Lagre sample og learnings
  const { data: sample } = await supabase
    .from("tone_samples")
    .insert({ org_id, source_url: url || null, content_preview: content.slice(0, 300), source_type: url ? "url" : "text" })
    .select().single()

  const learningsToInsert = rules.map((r: { rule: string; type: string }) => ({
    org_id,
    learning_type: "tone",
    rule: r.rule,
    source: "tone_sample",
    source_post_id: null,
    confidence: 0.8,
    active: true,
    metadata: { sample_id: sample?.id, source_url: url || null }
  }))

  await supabase.from("brand_learnings").insert(learningsToInsert)

  return NextResponse.json({ success: true, rules_extracted: rules.length, rules })
}
