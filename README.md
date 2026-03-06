# CostGuardAI

**Know before you send.**

Single-screen AI prompt preflight tool. Paste a prompt, select a model, and instantly see: token count, cost estimate, context usage, truncation risk, and a Failure Risk Score (0–100) — all running locally in your browser.

---

## What it does

| Feature | Detail |
|---|---|
| Token count | Exact for OpenAI (js-tiktoken); Estimated ±5–8% for others |
| Cost estimate | Input + output cost per call, based on configurable pricing table |
| Context usage | Visual progress bar, color-coded by risk level |
| Truncation warning | Separate signal: Safe / Warning / Danger |
| **Failure Risk Score (heuristic)** | 0–100 score from 5 weighted factors (context pressure, output collision, output cap, verbosity, estimation uncertainty) |
| Prompt compression | 1-click rule-based compression — no API calls, instant |
| Model assumptions | Read-only modal showing every model's config values |

**All analysis is client-side. Prompts never leave your browser.**

---

## Models (V1)

| Model | Provider | Context | Strategy |
|---|---|---|---|
| GPT-4o | OpenAI | 128K | Exact |
| GPT-4o Mini | OpenAI | 128K | Exact |
| Claude Sonnet 4 | Anthropic | 200K | Estimated |
| Claude 3.5 Haiku | Anthropic | 200K | Estimated |
| Gemini 1.5 Pro | Google | 1M | Estimated |
| Llama 3.1 70B | Meta | 128K | Estimated |

---

## Getting started

```bash
# 1. Clone and install
pnpm install

# 2. Copy env template (no changes needed for V1)
cp .env.example .env

# 3. Run dev server
pnpm dev
# → http://localhost:3000
```

---

## Configuration

**Model pricing and limits** are in a single file:

```
src/config/models.ts
```

To update a price or add a model, edit that file. The `pricingLastUpdated` string is shown in the footer. No other files need to change.

---

## Deployment (Vercel)

```bash
# Push to GitHub, then:
vercel --prod
```

Or connect the repo in the Vercel dashboard. Zero configuration needed — it's a static Next.js app.

Set `NEXT_PUBLIC_APP_URL` to your production URL in Vercel's environment variables for correct OpenGraph metadata.

---

## Stack

- **Next.js 15** (App Router, static output)
- **Tailwind CSS v4** + **shadcn/ui** (new-york)
- **js-tiktoken** for OpenAI token counting
- **pnpm** package manager

---

## Project structure

```
src/
  config/models.ts          ← Single source of truth (edit here to update pricing)
  lib/
    tokenizer.ts            ← Token counting (js-tiktoken wrapper)
    risk.ts                 ← Failure Risk Score engine
    compressor.ts           ← Rule-based prompt compression
    formatters.ts           ← Number/currency formatting
  hooks/
    use-preflight.ts        ← Main hook (debounce, perf guard, model-switch clamping)
  components/
    risk-score.tsx          ← Score + badge + deterministic explanation
    compression-panel.tsx   ← Compression preview and apply
    model-assumptions.tsx   ← Read-only model config modal
    results-panel.tsx       ← Composes all result cards
    ...
  app/
    page.tsx                ← The single page
    layout.tsx              ← Root layout + metadata
```

---

## CLI Usage

Run preflight analysis directly from your terminal — no browser required.

```bash
npx costguard analyze prompt.txt --api-key $COSTGUARD_API_KEY
```

**Options**

| Flag | Description | Default |
|---|---|---|
| `--api-key` | Your CostGuardAI API key (or set `COSTGUARD_API_KEY`) | — |
| `--host` | API base URL | `https://costguardai.io` |
| `--model` | Model ID to analyze against | `gpt-4o-mini` |
| `--requests` | Requests/month for monthly cost estimate | `1000` |

**Example output**

```
CostGuardAI Report

Risk:                HIGH
Estimated Cost:      $24.80
Truncation Risk:     37%

Recommended Model:   gpt-4o-mini

Share: https://costguardai.io/s/<uuid>
```

**Generate an API key** in your dashboard under Settings → API Keys.

---

## V2 ideas

- User accounts + prompt history
- Live pricing sync from provider APIs
- Browser extension
- Team/workspace sharing
- API endpoint for CI/CD prompt validation
- Dark mode

---

*Prices configurable. Verify with provider before purchase decisions.*
