# CostGuardAI

[![GitHub stars](https://img.shields.io/github/stars/Camj78/Cost-Guard-AI?style=social)](https://github.com/Camj78/Cost-Guard-AI)
[![npm version](https://img.shields.io/npm/v/@camj78/costguardai)](https://www.npmjs.com/package/@camj78/costguardai)
[![License](https://img.shields.io/github/license/Camj78/Cost-Guard-AI)](LICENSE)

Prevent unsafe and expensive AI prompts from reaching production.

---

## Quickstart

**Step 1 — Demo**

```bash
npm install -g @camj78/costguardai
costguardai demo
```

```text
CostGuardAI Preflight Analysis
────────────────────────────────────────
  WARNING  (score: 48)

  Model:          gpt-4o-mini
  Tokens:         244
  Cost/req:       $0.0001
  Safety Score:   48 (Warning)
  Context:        1.5%

  Risk Notes:
    - token amplification risk detected from repeated context
    - ambiguous instructions may increase output variance
    - high output volatility — response length unpredictable

  fix before shipping — this prompt is likely to increase token usage significantly in production
────────────────────────────────────────
1 file(s) analyzed. Lowest Safety Score: 48.

Next: run on your own prompt file

  costguardai analyze path/to/your-prompt.txt
```

**Step 2 — Analyze your own prompt**

```bash
costguardai analyze path/to/your-prompt.txt --api-key <key>
```

Get an API key at [costguardai.io](https://costguardai.io). Analysis calls the API — your prompt text is not stored.

**Step 3 — Add to CI**

```bash
costguardai ci path/to/your-prompt.txt --api-key <key> --fail-on-risk 70
```

Blocks risky prompts before merge. See [Add to CI in 60 seconds](#add-to-ci-in-60-seconds) below for the full GitHub Actions setup.

---

## What it catches

| Risk | Example |
|---|---|
| 🔴 Prompt injection | User input overriding system instructions |
| 💸 Token explosion | Prompts that will cost 10x what you expect |
| ✂️ Truncation risk | Context window overflow mid-response |
| ⚠️ Output collision | Conflicting instructions producing unstable output |
| 🔒 Missing guardrails | No output constraints = unpredictable behavior |

**CostGuardAI Safety Score: 0–100.** Higher score = safer. Know your score before you ship.

---

## Why this exists

A single prompt can:
- silently explode token costs in production
- fail unpredictably in real usage
- behave differently than in testing

CostGuardAI catches these issues **before they hit production**.

---

## CLI Reference

| Command | Description |
|---|---|
| `costguardai demo` | Run analysis on a built-in demo prompt |
| `costguardai analyze <file>` | Analyze a prompt file |
| `costguardai fix <file>` | Auto-fix detected issues |
| `costguardai ci --fail-on-risk <n>` | CI gate — exit 1 if Safety Score < n |
| `costguardai init` | Initialize config in current repo |

**Options**

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | Model to analyze against | `gpt-4o-mini` |
| `--format text\|md\|json` | Output format | `text` |
| `--threshold <n>` | Exit 1 if any file Safety Score < n | — |
| `--ext <exts>` | File extensions to scan | `.txt,.md,.prompt` |
| `--expected-output <n>` | Expected output tokens | `512` |

---

## Add to CI in 60 seconds

**Step 1 — Install**
```bash
npm install -g @camj78/costguardai
```

**Step 2 — Initialize**
```bash
costguardai init
```

**Step 3 — Add CI gate**

```yaml
name: CostGuardAI

on: [pull_request]

jobs:
  costguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run CostGuardAI
        run: npx @camj78/costguardai@latest ci --fail-on-risk 70
```

CI blocks risky prompts before merge:

```text
CostGuardAI Preflight Analysis
────────────────────────────────────────
  ❌ FAILED  (score: 49)

  File:           prompts/risky.prompt
  CostGuardAI Safety Score: 49 (Warning)

  Risk Notes:
    • ambiguous instructions may increase output variance
    • high output volatility — response length unpredictable

❌ CI FAILED — blocked from deploy
Safety Score: 49 — below threshold of 70

Suggested fix: costguardai fix prompts/risky.prompt
────────────────────────────────────────
```

threshold behavior (Safety Score):
- Safety Score > 70  →  pass
- Safety Score 40–70 →  warning
- Safety Score < 40  →  exit 1 (fail)

**Step 4 — Commit**
```bash
git add .
git commit -m "Add CostGuardAI preflight checks"
```

> Add the safety badge to your repo:
> `[![CostGuardAI Safety](https://costguardai.io/badge.svg)](https://costguardai.io)`

---

## Web UI

**[costguardai.io](https://costguardai.io)** — Paste a prompt, select a model, and instantly see:

- Token count (exact for OpenAI via js-tiktoken; ±5–8% estimated for others)
- Cost estimate (input + output per call)
- Context usage bar (color-coded by risk level)
- Truncation warning
- CostGuardAI Safety Score with full explainability

All client-side. Nothing sent to a server.

---

## Supported Models (V1)

| Model | Provider | Context | Token Strategy |
|---|---|---|---|
| GPT-4o | OpenAI | 128K | Exact |
| GPT-4o Mini | OpenAI | 128K | Exact |
| Claude Sonnet 4 | Anthropic | 200K | Estimated |
| Claude 3.5 Haiku | Anthropic | 200K | Estimated |
| Gemini 1.5 Pro | Google | 1M | Estimated |
| Llama 3.1 70B | Meta | 128K | Estimated |

---

## Pricing

| | Free | Pro | Team |
|---|---|---|---|
| **Price** | $0 | $29/mo | $99/mo |
| CLI analysis | ✓ | ✓ | ✓ |
| Safety Score + explainability | ✓ | ✓ | ✓ |
| Shareable reports | ✓ | ✓ | ✓ |
| Analyses / month | 25 | Unlimited | Unlimited |
| CI guardrails (`--fail-on-risk`) | — | ✓ | ✓ |
| PR comments | — | ✓ | ✓ |
| Observability dashboard | — | ✓ | ✓ |
| Team risk policies | — | — | ✓ |
| Cross-project cost tracking | — | — | ✓ |
| Audit logs | — | — | ✓ |

---

## Stack

- **Next.js 15** (App Router) · **TypeScript**
- **Supabase** (auth + Postgres)
- **Tailwind CSS v4** + **shadcn/ui**
- **js-tiktoken** (OpenAI token counting)
- **Stripe** · **Sentry** · **PostHog**

---

## Roadmap

- [ ] Live pricing sync from provider APIs
- [ ] VSCode extension
- [ ] Chrome extension
- [ ] Team risk policies (self-serve)
- [ ] More model support

---

## Why I built this

I kept shipping AI features and discovering problems in production — runaway token costs,
prompts that got injected, responses that truncated mid-sentence. There was no `eslint`
for prompts. So I built one.

CostGuardAI is the preflight check I wish I'd had from day one.

— [@Camj78](https://github.com/Camj78)

---

## Contributing

Issues, PRs, and feedback welcome.

If this saves you from a bad prompt in production, consider ⭐ starring — it helps
other developers find it.

→ [costguardai.io](https://costguardai.io) · [npm](https://www.npmjs.com/package/@camj78/costguardai) · [team@costguardai.io](mailto:team@costguardai.io)
