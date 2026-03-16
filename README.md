# SoMe-plattform for AI Agentens kunder

> **Arbeidsnavn:** some.aiagenten.no
> **Type:** Intern kundeplattform (ikke SaaS)
> **Status:** Planlegging
> **Opprettet:** 2026-03-16

## Konsept

En kunde-facing SoMe-plattform der AI Agentens kunder kan:
- Se, godkjenne og administrere sitt sosiale medie-innhold
- Få AI-genererte innholdsforslag basert på sin merkevare
- Se statistikk og resultater
- Bestille mer innhold

**Ikke** en åpen SaaS — dette er et verktøy vi tilbyr som del av AI Agentens tjenester.

---

## Vibiz Research — Hva gjør de bra?

### Vibiz sin kjerneidé
Vibiz kaller seg "Vibe Business Platform" — AI-agent som eier hele marketing-funnelen.

### Vibiz sine beste funksjoner (det vi bør lære av):

**1. "Business DNA" — Merkevare-analyse fra URL**
- Scraper kundens nettside → trekker ut farger, fonter, logo, tone-of-voice, budskap
- Alt innhold genereres *on-brand* automatisk
- **Vår fordel:** Vi gjør dette allerede manuelt i portalen. Automatiser det.

**2. Multi-format innholdsgenerering**
- Samme budskap → tilpasset til Instagram, Stories, TikTok, Facebook, LinkedIn
- Riktige dimensjoner og formater per plattform
- Tekst-poster, bilde-poster, og video-demoer
- **Explore-side** med community-eksempler man kan remixe

**3. Full funnel-tenkning (TOFU/MOFU/BOFU)**
- Ikke bare SoMe-poster — også landingssider, annonser, lead capture
- Revenue-projeksjoner basert på budsjett
- **Vi trenger ikke alt dette i V1**, men det er en god retning

**4. Redigérbart output**
- Brukeren kan justere alt AI lager — ikke bare "take it or leave it"
- Forhåndsvisning av hvordan det ser ut på hver plattform

**5. Enkel onboarding**
- "Lim inn URL → ferdig" — magisk førsteopplevelse
- Ingen oppsett, ingen konfigurering
- Kunden ser resultat på sekunder

### Vibiz sine svakheter (vår mulighet):

- **Generisk** — bygget for alle, ikke spesialisert for noe
- **Ingen ekte relasjon** — du er alene med AI
- **Kvalitet?** — G2-anmeldelser mangler, mest markedsføring
- **Ingen byrå-støtte** — ingen godkjenningsflyt, ingen rådgiver i loopen

### Konkurrent-landskap (white-label SoMe):
- **Cloud Campaign** — white-label scheduling for byråer
- **SocialPilot** — dashboard per klient, branded rapporter
- **Apaya** — AI content creation + white-label
- **Centripe** — AI-drevet SoMe med ChatGPT/DALL-E

**Nøkkelinnsikt fra Apaya-artikkelen:**
> "Clients who see third-party branding start subtracting the tool cost from your invoice."
> "AI white-label platforms save production labor: moving margins from ~49% to ~81%."

---

## Vår posisjon — Hva gjør oss annerledes?

| Vibiz / SaaS-verktøy | some.aiagenten.no |
|---|---|
| Kunden er alene med AI | Kunden har AI Agenten som rådgiver |
| Generisk for alle bransjer | Skreddersydd per kunde |
| Self-service | Managed + self-service hybrid |
| Bare AI-output | AI + menneskelig kvalitetssikring (Silje) |
| Kunden må forstå marketing | Vi håndterer strategi, kunden godkjenner |

**Vår edge:** Vi er ikke et verktøy — vi er en tjeneste med et verktøy.

---

## Foreslått arkitektur

### Tech stack
- **Frontend:** Next.js (som de andre prosjektene)
- **Backend:** Supabase (nytt prosjekt)
- **AI:** OpenRouter (Gemini Flash for tekst, OpenAI for bilder)
- **Bildegenerering:** OpenAI Images API / Gemini
- **Web scraping:** Firecrawl (har abo)
- **Hosting:** Netlify
- **Domene:** some.aiagenten.no

### Database-struktur (Supabase)

```
organizations
├── id, name, slug, logo_url, website_url
├── brand_colors (jsonb), brand_fonts (jsonb)
├── tone_of_voice, industry
└── created_at, updated_at

users
├── id (= Supabase auth uid)
├── org_id → organizations
├── role: 'admin' | 'editor' | 'viewer' | 'aiagenten_admin'
├── name, email, avatar_url
└── created_at

brand_profiles (Business DNA)
├── id, org_id → organizations
├── source_url, scraped_data (jsonb)
├── colors (jsonb), fonts (jsonb)
├── logo_url, tagline, description
├── tone_keywords[], target_audience
└── last_scraped_at

posts
├── id, org_id → organizations
├── created_by → users
├── platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok'
├── format: 'feed' | 'story' | 'reel' | 'carousel'
├── content_text, content_image_url, content_video_url
├── hashtags[], caption
├── status: 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'rejected'
├── approved_by → users, approved_at
├── scheduled_for, published_at
├── ai_generated: boolean
└── created_at, updated_at

post_analytics
├── id, post_id → posts
├── impressions, reach, engagement
├── likes, comments, shares, saves, clicks
└── fetched_at

social_accounts
├── id, org_id → organizations
├── platform, account_name, account_id
├── access_token (encrypted), refresh_token
├── token_expires_at
└── connected_at

content_calendar
├── id, org_id → organizations
├── date, posts[] → posts
├── theme, notes
└── created_at

campaigns
├── id, org_id → organizations
├── name, description, goal
├── start_date, end_date
├── budget, status
└── posts[] → posts
```

**RLS-regler:**
- Kunder ser kun sin org
- `aiagenten_admin` rolle ser alt
- `viewer` kan ikke redigere/godkjenne

### Nøkkel-features per fase

#### Fase 1 — MVP (2-3 uker)
- [ ] Kunde-onboarding: opprett org → scrape nettside → generer brand profile
- [ ] Innholdskalender: vis planlagte poster per uke/måned
- [ ] AI innholdsgenerering: generer poster basert på brand profile
- [ ] Godkjenningsflyt: draft → pending → approved/rejected → scheduled
- [ ] Multi-plattform: Instagram + Facebook + LinkedIn
- [ ] Enkel dashboard: antall poster, neste publisering, status

#### Fase 2 — Utvidelse (3-4 uker etter MVP)
- [ ] Statistikk-dashboard: engagement, rekkevidde, vekst
- [ ] Bildegenerering: on-brand bilder med AI
- [ ] Hashtag-forslag basert på bransje/innhold
- [ ] Kunde kan redigere AI-forslag direkte
- [ ] Varslinger: e-post/push når nytt innhold venter godkjenning
- [ ] Explore/inspirasjon: se eksempler på godt innhold

#### Fase 3 — Avansert
- [ ] TikTok + Stories-formater
- [ ] A/B-testing av innhold
- [ ] Automatisk publisering via Meta/LinkedIn API
- [ ] Lead capture + landingssider (Vibiz-territory)
- [ ] Kampanje-styring med budsjett
- [ ] Rapporter (branded PDF med AI Agenten-logo)

---

## Prismodell (forslag)

**Ikke separat SaaS-pris — del av AI Agenten sitt tjenestetilbud:**

| Pakke | Innhold | Pris |
|-------|---------|------|
| Starter | 12 poster/mnd, 1 plattform | 3.000 kr/mnd |
| Vekst | 20 poster/mnd, 3 plattformer, statistikk | 6.000 kr/mnd |
| Premium | 30+ poster/mnd, alle plattformer, kampanjer, rapporter | 10.000 kr/mnd |

Plattform-tilgang er inkludert i pakken — kunden betaler for tjenesten, ikke verktøyet.

---

## Bars' Krav (16. mars 2026)

### Onboarding-flyt
1. Kunde logger inn
2. Velger plattformer: LinkedIn, Facebook, Instagram
3. Legger inn sin webadresse
4. System scraper nettsiden → henter brand-farger, fonter, logo, tone
5. Kunde kan justere brand-profil om ønskelig
6. System genererer automatisk "dos and don'ts" for merkevaren (som i portalen)

### Bildebibliotek-kobling
Kunden skal kunne koble på sitt eget bildebibliotek:
- **Google Drive** — via Google Picker API + OAuth2 (drive.file scope)
  - Google har ferdig "Picker" UI-komponent som lar brukeren bla i sine filer
  - Trenger: Google Cloud prosjekt, OAuth consent screen, Client ID
  - **Bars trenger:** Sette opp OAuth i Google Cloud Console (samme som MøteMette)
- **OneDrive** — via Microsoft Graph API + OAuth2
  - Trenger: Azure AD app registration, Files.Read scope
  - Microsoft har også ferdig file picker komponent
  - **Bars trenger:** Opprette app i Azure Portal

**Begge krever OAuth-oppsett** men selve integrasjonen er rett frem — bruker kobler kontoen sin, vi får tilgang til å bla i og hente bilder.

### Fotorealistisk bildegenerering
- Når AI lager bilder med personer → bruk den fotorealistiske prompten (Skandinavisk stil, naturlig lys, ekte settinger — ref SikkerKI bildestil-regler)
- Lagre prompt-preferanser per org i brand_profiles
- Bildegenerering via OpenAI Images API eller Gemini

### Selvlærende funksjon ("Learning Loop")
System som lærer hva som fungerer for hver kunde:

```
content_feedback
├── id, post_id → posts, org_id → organizations
├── action: 'approved' | 'rejected' | 'edited'
├── rejection_reason (text) — kundens kommentar ved avvisning
├── edit_diff (jsonb) — hva kunden endret
├── engagement_score (float) — beregnet fra analytics
└── created_at

brand_learnings
├── id, org_id → organizations
├── learning_type: 'style' | 'tone' | 'topic' | 'format' | 'timing'
├── rule (text) — f.eks. "Ikke bruk utropstegn i LinkedIn-poster"
├── source: 'rejection' | 'edit' | 'analytics' | 'manual'
├── confidence (float)
├── active: boolean
└── created_at
```

**Slik fungerer det:**
1. Kunde avviser post med kommentar "For uformell tone" → system lagrer som learning
2. Kunde redigerer alltid bort emoji → system lærer "unngå emoji for denne kunden"
3. Poster med høy engagement → system lærer "mer av dette"
4. Learnings mates inn i AI-prompten ved neste generering
5. Over tid blir innholdet mer og mer treffsikkert per kunde

### Embeddable arkitektur
Plattformen skal kunne **embeddes i kunders nettsider** — ikke bare stå som standalone.
- Bygg som **web components** eller **iframe-embed** med konfigurasjonsparametre
- Kunden legger inn en `<script>` tag eller `<iframe>` på sin nettside
- Nye funksjoner vi bygger rulles ut til alle kunder automatisk
- Mulige embed-moduler:
  - Innholdskalender (read-only for ansatte)
  - Godkjennings-widget
  - Analytics-dashboard
  - Video-editor
- **Teknisk:** React-komponenter eksportert som web components via Custom Elements API, eller mikrofrontend med Module Federation

### Video-editor (Remotion-basert)
Kunden skal kunne lage korte videoer for SoMe direkte i plattformen:
- **Last opp video** fra device eller bildebibliotek (Google Drive/OneDrive)
- **Trim/klipp** — velg start/slutt, klipp ut segmenter
- **Transitions** — fade, slide, zoom mellom klipp
- **Musikk** — legg til bakgrunnsmusikk fra bibliotek (royalty-free)
- **Tekst-overlay** — titler, undertekster, CTA-tekst med brand-fonter/farger
- **Eksport** i riktige formater: Instagram Reel (9:16), Feed (1:1), Stories (9:16), LinkedIn (16:9)

**Tech:**
- **Remotion Player** (`@remotion/player`) — React-komponent for live preview i browser
- **Remotion Lambda/Cloud** — serverside rendering av endelig video
- **designcombo/react-video-editor** — open source Remotion-basert editor (CapCut/Canva-klon) som utgangspunkt
- **Lisens:** Remotion er gratis for <3 ansatte. Company License: $100/mnd (Automators) for server-rendering. Verdt det.

**Brukerflyt:**
1. Kunde velger "Lag video"
2. Laster opp klipp / velger fra bildebibliotek
3. Drar klipp til timeline, trimmer
4. Legger på tekst (auto-foreslått fra AI basert på brand)
5. Velger musikk og transitions
6. Forhåndsvisning i browser (Remotion Player)
7. Trykker "Eksporter" → rendres server-side → klar for publisering

### Avvisning med kommentar
- Kunde trykker "Avvis" → kommentarfelt åpnes
- Kommentaren brukes til å:
  1. Regenerere innholdet automatisk med justeringer
  2. Lagre som learning for fremtidige genereringer
  3. Varsle AI Agenten-teamet om mønster (mange avvisninger = trenger manuell oppfølging)

---

## Lessons Learned fra Silje & Erik (SoMe-arbeidet hittil)

### Arkitektur & Infrastruktur
1. **Supabase pg_cron > agent-cron for publisering.** Erik flyttet auto-publisering fra agent-cron til Supabase pg_cron (`process-scheduled-posts`, kjører hvert minutt). Mer pålitelig, ingen avhengighet til Mac mini.
2. **Deno Edge Functions har begrensninger.** Facebook video-upload fungerer IKKE fra Deno Edge Runtime (multipart/binary). Løsning: Python-script på Mac mini (`fb-video-uploader.py`) som kjøres via cron hvert 5. minutt. Ny plattform må ha en robust server-side løsning for video-upload — ikke bare edge functions.
3. **UTC i DB, norsk tid i UI.** Erik fikset tidssone-bugs: `scheduled_date` lagres i UTC, men ALT vises i norsk tid (CET/CEST). Viktig å bake inn fra start.

### Brand Profiles & Innholdsgenerering
4. **Brand profiles er allerede modne.** Erik har bygget et rikt `brand_profiles`-skjema med: `visual_style` (jsonb), `design_guidelines` (Remotion-templates som JSON), `do_list`/`dont_list`, `tone`, `voice_description`, `target_audience`, `key_messages`. Mye av dette kan gjenbrukes direkte.
5. **Én bakgrunn per brand > per post.** Silje oppdaget at generering av bakgrunnsbilde per post var for tregt/dyrt. Løsning: Én `brand-background.png` per brand i Storage, gjenbrukes på alle videoer. Ny plattform bør ha et bildebibliotek per brand, ikke per-post generering.
6. **Remotion fungerer for video-stills og video.** Silje har et fungerende Remotion-oppsett (`some-studio/`) med BrandVideo-template. Kan være utgangspunkt for video-editoren.

### Publisering & Plattformer
7. **LinkedIn-konto-forvirring.** Erik oppdaget at poster havnet på feil LinkedIn-konto fordi `connection_id` ikke ble riktig satt. Ny plattform MÅ ha tydelig connection → org-mapping med validering.
8. **Facebook video vs bilde er separate API-kall.** `/photos` vs `/{page-id}/videos` — må håndteres eksplisitt. Bugget i produksjon.
9. **Connection IDs er kritiske.** Silje dokumenterte at ALLE poster MÅ ha `connection_id` satt. Uten dette havner poster i limbo eller på feil konto.

### Content Workflow
10. **Feedback loop fungerer.** Silje har en fungerende godkjenningsflyt: `pending_approval` → Bars godkjenner/avviser → `rejection_reason` → Silje regenererer → ny `pending_approval`. Cron sjekker hvert 30 min. Denne flyten bør automatiseres i ny plattform.
11. **Ikke overdriv tall.** Bars korrigerte at tekst om "tusenvis av brukere" var feil. Self-learning systemet må fange slike korrekturer.
12. **Maks 1 post per (tenant, dag, post_type).** Erik ryddet opp 166 → 44 poster pga klynge-posting. Ny plattform trenger smart scheduling som hindrer dobbel-booking.

### Skalering & Cron
13. **Splitt per brand, ikke én stor jobb.** Silje gikk fra én samlet cron-jobb (timet ut!) til 6 separate per brand med 15 min mellom. Ny plattform bør ha per-org køsystem.
14. **Storage-opprydding er viktig.** Silje måtte konsolidere duplikatmapper (`ai-agenten/` vs `aiagenten/`). Kanoniske slugs fra dag 1.

### Hva som allerede finnes (og kan gjenbrukes)
- **Supabase-prosjekt** `ldcxlsyjjfmqbbrefcrp` (aiagenten-portal) med: blog_posts, brand_profiles, social_media_connections, approval queue
- **Remotion-prosjekt** (`agents/silje/some-studio/`) med BrandVideo-templates
- **Edge functions:** post-to-linkedin, post-to-facebook, get-publishing-recommendations
- **Feedback loop** cron + workflow
- **5 brand profiles** med full config (SikkerKI, AI Agenten, Kryptohjelpen, Hvem er jeg, Er det Svindel, Andreas Personal)
- **Scripts:** fb-video-uploader.py, rerender-pending-fast.py, generate-brand-backgrounds.py

---

## Neste steg

1. ~~Bars godkjenner scope/retning~~ ✅
2. ~~Bars spesifiserer krav~~ ✅ (onboarding, bildebibliotek, video-editor, selvlærende, embed)
3. ~~Hent lessons learned fra Silje & Erik~~ ✅
4. **Beslutt: bygge nytt vs utvide aiagenten-portal** ← neste
5. Opprett Supabase-prosjekt (eller gjenbruk ldcxlsyjjfmqbbrefcrp)
6. Sett opp repo (aiagenten/some-platform)
7. Erik bygger MVP (fase 1)
8. Test med én kunde
9. Iterer basert på feedback

---

*Sist oppdatert: 2026-03-16*
