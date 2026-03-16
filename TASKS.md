# SoMe-plattform — Oppgavefordeling

## Fase 1: MVP (Uke 1-3)

### Buddy — Prosjektledelse & Oppsett
- [ ] Opprett Supabase-prosjekt (some.aiagenten.no)
- [ ] Opprett GitHub repo (aiagenten/some-platform)
- [ ] Initial schema-migrasjon med RLS fra start
- [ ] Koordinere mellom Erik og Silje
- [ ] Dashboard-tracking av alle tasks

### Erik — Backend & Frontend
- [ ] **E1: Prosjekt-scaffold** — Next.js + Supabase + auth setup
- [ ] **E2: Database schema** — social_posts, brand_profiles, social_accounts, organizations, users, content_feedback, brand_learnings, embed_tokens
- [ ] **E3: RLS policies** — multi-tenant med `get_user_tenant_id()` helper
- [ ] **E4: Brand scraper** — Firecrawl scrape av kundens nettside → farger, fonter, logo, tone
- [ ] **E5: Auth + onboarding-flyt** — registrer, velg plattformer, legg inn URL, juster brand
- [ ] **E6: Innholdskalender-UI** — uke/måned-visning av planlagte poster
- [ ] **E7: Godkjenningsflyt** — draft → pending → approved/rejected med kommentar
- [ ] **E8: AI innholdsgenerering** — OpenRouter API, brand-aware prompts
- [ ] **E9: Multi-plattform preview** — vis hvordan post ser ut på IG/FB/LinkedIn
- [ ] **E10: Facebook/Instagram OAuth** — gjenbruk lærdom fra portalen
- [ ] **E11: Publisering via Edge Functions** — ikke frontend, med retry-logikk

### Silje — Innhold & Prompts
- [ ] **S1: Brand Voice Guide template** — standardmal for onboarding
- [ ] **S2: SoMe prompt-bibliotek** — prompts per plattform/format med brand-variabler
- [ ] **S3: Dos and Don'ts maler** — generelle + per bransje
- [ ] **S4: Fotorealistisk bilde-prompt** — skandinavisk stil, norske settinger
- [ ] **S5: Video-templates** — 5-10 Remotion-maler (promo, tips, BTS, testimonial, CTA)
- [ ] **S6: Avvisnings-kategorier** — definere faste kategorier med auto-fix prompts
- [ ] **S7: Test-innhold** — generere testdata for CoverHeads som pilot

## Fase 2: Utvidelse (Uke 4-6)

### Erik
- [ ] **E12: Embeddable widget** — Web Component med Shadow DOM + embed tokens
- [ ] **E13: Video-editor (Remotion)** — template-basert, ikke freeform
- [ ] **E14: Google Drive / OneDrive integration** — OAuth + file picker
- [ ] **E15: Analytics dashboard** — engagement, rekkevidde per post
- [ ] **E16: Selvlærende feedback-loop** — content_feedback → brand_learnings → prompts
- [ ] **E17: Varslinger** — e-post når innhold venter godkjenning

### Silje
- [ ] **S8: Innholdsplan-maler** — ukentlige/månedlige templates per bransje
- [ ] **S9: Hashtag-bibliotek** — per bransje, norsk marked
- [ ] **S10: Analytics-tolkning** — regler for hva som er "godt" engagement per plattform

## Fase 3: Avansert (Uke 7+)
- [ ] TikTok-støtte
- [ ] A/B-testing
- [ ] Kampanjestyring med budsjett
- [ ] Branded PDF-rapporter
- [ ] LinkedIn-publisering via API
- [ ] Batch-generering (1 uke om gangen)
