# Lessons Learned — Input fra teamet

## Fra Silje (Innhold & SoMe)

### Hva fungerer godt
- Structured prompts med brand voice guide — plattformen bør KREVE dette ved onboarding
- Pakkebasert produksjon (faste formater/frekvenser) gjør AI forutsigbar
- Fotorealistiske bilder i skandinavisk stil — norske kunder reagerer negativt på "AI-kunst"
- Godkjenningsflyt med pending_approval → approved/rejected fungerer
- Remotion for 15-sek promo-videoer som repeatable templates

### Hva fungerer IKKE
- Tekst PÅ bilder i AI-genererte bilder — ALDRI. Legg på overlay etterpå
- AI-video uten menneske-review — krever 5-8 iterasjoner
- Auto-posting uten godkjenning — ~20-30% blir "off" (tone-of-voice)
- Generisk innhold ("5 tips for...") — spesifikt > generelt
- Amerikanske referanser i norsk kontekst

### Generelle SoMe-regler (cross-brand)
1. KI, ikke AI på norsk innhold
2. Maks 2-3 setninger per slide/scene
3. CTA alltid i siste slide
4. Bildeformat tilpasset plattform (1:1, 9:16, 16:9)
5. Ingen markdown-tabeller — bullet points
6. Autentisitet > polert
7. Aldri publiser fredag etter 14:00
8. Hashtags: max 5, relevante

### Vanligste avvisningsgrunner
1. Feil tone of voice (40%)
2. Feilaktige påstander/fakta (20%)
3. Dårlige bilder (15%)
4. Feil vinkling/budskap (15%)
5. Formateringsfeil (10%)

### Formater — best engagement
1. Korte videoer (Reels/Stories) 15-30 sek
2. Karusell-poster
3. Behind-the-scenes bilder
4. LinkedIn-artikler med spesifikke tall
5. Enkeltbilde med kort tekst (lavest)

### Plattform-prioritering (norsk B2B)
- LinkedIn — desidert viktigst
- Instagram — B2C og visuelt sterke brands
- Facebook — lokal targeting
- TikTok — kun hvis brandet passer

### Video-erfaringer
- 15 sek er sweet spot
- Fade ut FØR neste scene
- Tekst-slides trenger 4-5 sek (ikke 2-3)
- Rolig musikk > dramatisk for B2B
- Hold video-editor ENKEL: template-maskin med 5-10 formater, ikke full editor
- Rendering tar 30-60 sek — vis progress bar

### Bonusanbefalinger
- Godkjenn tekst og bilde SEPARAT
- Batch-generer 1 uke om gangen
- Multi-plattform preview FØR publisering
- Analytics feedback-loop til neste batch

---

## Fra Erik (Teknisk)

### Portalen — gjenbruk vs annerledes
**Gjenbruk:**
- Multi-tenant modell (tenants → memberships → profiles)
- AuthContext med membership-lookup
- Hook-struktur (useSocialMediaConnections etc)
- Brand profiles koblet til customers
- Approval flow

**Gjøre annerledes:**
- IKKE bruk blog_posts som catch-all — lag dedikert `social_posts` med platform-spesifikke felter
- Gjennomtenkt initial schema (portalen hadde 30+ migrasjoner på 2 mnd)
- Flytt tokens ut av ren tekst — bruk Supabase Vault eller pgcrypto
- Bytt React-Quill til Tiptap eller Lexical

### Facebook/Instagram API gotchas
- Token refresh: long-lived tokens = 60 dager, refresh ved 50
- Facebook Page ≠ Instagram Business Account — modeller hierarkisk
- Publisering: Page Access Token, IKKE User Access Token
- IG carousel og reels har ulike endpoints — bygg abstraksjonsklasse
- Rate limit: 200 calls/user/hour
- Publiser via Edge Functions, ikke frontend
- Sett opp Facebook Webhooks for status

### Embeddable arkitektur
- Web Component med Shadow DOM > ren iframe
- Embed token-system (ikke Supabase auth for embeds)
- Dedikert `/embed`-route uten nav/sidebar
- postMessage API for kommunikasjon
- CORS + origin-validering server-side
- Content Security Policy med dynamisk frame-ancestors

### Remotion
- Bra for programmatiske templates, men ikke tradisjonell editor
- Start med templates, ikke freeform (lagre som JSON i DB)
- Remotion Player for preview, Lambda for render
- For enkel trim/overlay: FFmpeg via Edge Function kan være lettere
- Lisens: ~$100/mnd for Automators

### Supabase RLS tips
- Bruk helper-funksjon `get_user_tenant_id()` — ikke repeter subqueries
- Rolle-spesifikke policies fra dag 1
- For embeds: service_role + custom auth via header-token
- Test med SET ROLE
- Indekser på tenant_id er kritiske

### Generelle learnings
- Edge Functions for alt asynkront (publisering, token-refresh, AI)
- Webhook-first for integrasjoner
- Audit log fra dag 1
- Bildehåndtering: Supabase Storage med buckets per kunde
- Framer Motion hakker på mobil — bruk CSS transitions
- Preview deploys for PRs

### Eriks prioritering for MVP
1. Schema med RLS fra start
2. Facebook/Instagram OAuth + publisering via Edge Functions
3. Approval flow
4. Embed-widget med token-auth
5. AI-generering
6. Remotion video-templates (v2)
