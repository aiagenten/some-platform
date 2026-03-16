# 📦 Content Templates — SoMe-plattform

Standardiserte maler og prompts for AI Agentens SoMe-plattform.

## Filer

| Fil | Beskrivelse |
|-----|-------------|
| `s1-brand-voice-guide.json` | **Brand Voice Guide** — JSON-template for kundens merkevareidentitet. Fylles ut ved onboarding. |
| `s2-some-prompt-bibliotek.json` | **Prompt-bibliotek** — Ferdige prompts for Instagram, LinkedIn og Facebook med variabler fra S1. |
| `s3-dos-and-donts.json` | **Dos & Don'ts** — Universelle regler + bransjespesifikke for B2B/SaaS, E-commerce, Lokal bedrift, Kreativ. |
| `s4-image-prompts.json` | **Bilde-prompts** — Fotorealistiske prompts med skandinavisk stil for 5 scenetyper × 3 varianter. |

## Hvordan det henger sammen

```
┌─────────────────────────┐
│  S1: Brand Voice Guide  │ ← Fylles ut ved onboarding
│  (per kunde)            │
└──────────┬──────────────┘
           │ variabler
           ▼
┌─────────────────────────┐     ┌──────────────────────┐
│  S2: Prompt-bibliotek   │ ←── │  S3: Dos & Don'ts    │
│  (genererer innhold)    │     │  (regler per bransje)│
└──────────┬──────────────┘     └──────────────────────┘
           │
           ▼
┌─────────────────────────┐
│  S4: Bilde-prompts      │ ← Genererer bilder til innlegg
│  (fotorealistisk)       │
└─────────────────────────┘
```

## Bruk

1. **Onboarding:** Fyll ut `s1-brand-voice-guide.json` med kunden
2. **Innhold:** Bruk prompts fra `s2` med variabler fra `s1` + regler fra `s3`
3. **Bilder:** Bygg bilde-prompts fra `s4` med kundens farger og bransje
4. **Iterasjon:** Oppdater `learnings` i S2-variablene basert på engagement-data

## Variabler

Alle prompts bruker disse variablene (hentes fra S1):

- `{brand_name}` — Merkevarenavn
- `{tone}` — Tone of voice
- `{topic}` — Tema for posten (settes per innlegg)
- `{target_audience}` — Målgruppe
- `{dos}` — Ting brandet SKAL gjøre
- `{donts}` — Ting brandet IKKE skal gjøre
- `{learnings}` — Akkumulerte innsikter fra tidligere poster
- `{brand_colors}` — Fargepalett (for bilder)
- `{industry}` — Bransje (for bilder og kontekst)
