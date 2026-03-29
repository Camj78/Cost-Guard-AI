## 🚨 A prompt that looked fine cost $6,500 in production

CostGuardAI detects:
- token explosion risk
- cost at scale
- unstable outputs

Run in seconds:

```bash
npx @camj78/costguardai analyze prompt.txt
```

---

## Use cases

- estimate OpenAI / Claude / LLM cost before deployment
- detect token explosion in prompts
- sanity check prompts before running experiments
- prevent expensive prompt mistakes in production

---

## Why this matters

Small prompt changes can:
- 10x token usage
- silently increase API costs
- break outputs at scale

CostGuardAI flags this before it happens.

---

# CostGuardAI

⭐ If this saves you a bad deploy, star the repo — it helps others find it.

[![GitHub stars](https://img.shields.io/github/stars/Camj78/Cost-Guard-AI?style=social)](https://github.com/Camj78/Cost-Guard-AI)
[![npm version](https://img.shields.io/npm/v/@camj78/costguardai)](https://www.npmjs.com/package/@camj78/costguardai)
[![License](https://img.shields.io/github/license/Camj78/Cost-Guard-AI)](LICENSE)

Run in 5 seconds → `costguardai analyze prompt.txt`

Prevent unsafe and expensive AI prompts from reaching production.

CostGuardAI is a CLI for **AI prompt testing, LLM cost optimization, and prompt validation**.

Detect:
- token explosions
- unstable outputs
- hidden OpenAI / Anthropic costs
- prompt failures before production

Built for:
- AI CI pipelines
- prompt safety enforcement
- production-grade LLM workflows

`npm install -g @camj78/costguardai`

---

## ⚠️ Why this exists

A single prompt can:
- silently explode token costs in production
- fail unpredictably in real usage
- behave differently than in testing

CostGuardAI catches these issues **before they hit production**.

---

## Why developers use CostGuardAI

If you've ever thought:

- "Why is my OpenAI bill suddenly so high?"
- "Why did this prompt explode in tokens?"
- "Why is my LLM output inconsistent?"
- "How do I test prompts before production?"
- "How do I prevent prompt issues in CI?"

CostGuardAI helps catch these issues before they hit production:

- Detects token explosion risk
- Flags ambiguous or unstable prompts
- Estimates real usage cost
- Surfaces output variability issues
- Works in CI to block risky prompts

---

## 🔍 Example

Input prompt:

> "Summarize customer conversations with full context"

CostGuardAI output:

```
CostGuardAI Safety Score: 78 (HIGH)
⚠️ Potential token explosion due to unbounded context
⚠️ Output variability risk
⚠️ Cost estimate: $420/month at scale
→ Fix suggestions available in Pro
```

---

### Real CLI output

Example output when a risky production prompt is analyzed.

```text
$ costguardai analyze ./prompts/checkout-flow.txt

CostGuardAI Safety Score: 78 (HIGH)
⚠️ Potential token explosion due to unbounded context
⚠️ Output variability risk
⚠️ Cost estimate: $420/month at scale

Free includes → basic analysis only
🔒 Fix suggestions: Pro
🔒 CI enforcement: Pro

Upgrade → https://costguardai.io/upgrade
Pro unlocks → fix suggestions, CI enforcement, safer prompt reviews

Next step → run this on a real prompt from your codebase
Example: costguardai analyze ./prompts/checkout-flow.txt
```

---

**CostGuardAI** is a CLI + web tool that analyzes AI prompts _before_ they hit production.
Scan for prompt injection, token explosion, cost overruns, and truncation risk — locally, in CI, or in your browser.
Supports prompt cost estimation for OpenAI cost, Claude cost, and LLM cost across all major providers.

---

## What it catches

| Risk | Example |
|---|---|
| 🔴 Prompt injection | User input overriding system instructions |
| 💸 Token explosion | Prompts that will cost 10x what you expect |
| ✂️ Truncation risk | Context window overflow mid-response |
| ⚠️ Output collision | Conflicting instructions producing unstable output |
| 🔒 Missing guardrails | No output constraints = unpredictable behavior |

**CostGuardAI Safety Score: 0–100.** Know your risk before you ship.

---

## 30-second quickstart

```bash
# Install
npm install -g @camj78/costguardai

# Analyze a prompt
costguardai analyze my-prompt.txt

# Example output:
# CostGuardAI Safety Score: 72/100
# Detected issues:
# • prompt injection risk
# • token explosion risk
# • unstable output structure

# Auto-fix issues
costguardai fix my-prompt.txt

# Block risky prompts in CI
costguardai ci --fail-on-risk 70
```

**All analysis runs locally. Your prompts never leave your machine.**

---

## Try it now

Paste any prompt into a file and run:

```bash
npx @camj78/costguardai analyze prompt.txt
```

No setup required.

Or try with a demo prompt:

`npx @camj78/costguardai analyze examples/demo-prompt.txt`

---

## Why I built this

I kept shipping AI features and discovering problems in production — runaway token costs,
prompts that got injected, responses that truncated mid-sentence. There was no `eslint`
for prompts. So I built one.

CostGuardAI is the preflight check I wish I'd had from day one.

— [@Camj78](https://github.com/Camj78)

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
# .github/workflows/costguardai.yml
name: CostGuardAI Prompt Safety
on:
  pull_request:
    paths:
      - "**/*.prompt"
      - "**/prompts/**"
jobs:
  costguardai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @camj78/costguardai
      - run: costguardai ci --fail-on-risk 75
```

**Step 4 — Commit**
```bash
git add .
git commit -m "Add CostGuardAI preflight checks"
```

> Add the safety badge to your repo:
> `[![CostGuardAI Safety](https://costguardai.io/badge.svg)](https://costguardai.io)`

---

## CLI Reference

| Command | Description |
|---|---|
| `costguardai analyze <file>` | Analyze a prompt file |
| `costguardai fix <file>` | Auto-fix detected issues |
| `costguardai ci --fail-on-risk <n>` | CI gate — exit 1 if risk score ≥ n |
| `costguardai init` | Initialize config in current repo |

**Options**

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | Model to analyze against | `gpt-4o-mini` |
| `--format text\|md\|json` | Output format | `text` |
| `--threshold <n>` | Exit 1 if any file risk_score ≥ n | — |
| `--ext <exts>` | File extensions to scan | `.txt,.md,.prompt` |
| `--expected-output <n>` | Expected output tokens | `512` |

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

## Contributing

Issues, PRs, and feedback welcome.

If this saves you from a bad prompt in production, consider ⭐ starring — it helps
other developers find it.

→ [costguardai.io](https://costguardai.io) · [npm](https://www.npmjs.com/package/@camj78/costguardai) · [team@costguardai.io](mailto:team@costguardai.io)
