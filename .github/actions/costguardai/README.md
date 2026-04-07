# CostGuardAI — GitHub Action

**Catch expensive AI prompts before they ship.**

Without a preflight check, LLM prompts silently cause:
- Token explosions that spike your API bill overnight
- Hidden costs from bloated context windows
- Unstable outputs from high-risk prompt structures

CostGuardAI catches these in CI — before they reach production.

---

## Install

Add to any workflow:

```yaml
- uses: Camj78/Cost-Guard-AI/.github/actions/costguardai@main
```

That's it. Zero configuration required.

---

## Example

```yaml
name: CostGuardAI Preflight

on: [push, pull_request]

jobs:
  costguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Camj78/Cost-Guard-AI/.github/actions/costguardai@main
        with:
          fail-on-risk: 70
```

---

## Inputs

| Input | Default | Description |
|---|---|---|
| `fail-on-risk` | `70` | Fail the workflow if Safety Score falls below this threshold |

---

## What is the Safety Score?

CostGuardAI assigns every prompt a **Safety Score (0–100)**. Higher is safer.

| Score | Band |
|---|---|
| 85–100 | Safe |
| 70–84 | Low Risk |
| 40–69 | Warning |
| 0–39 | High Risk |

The score is computed from token load, context usage, structural ambiguity, instruction quality, and a live CVE registry of known prompt failure patterns.

---

## How it works

1. CostGuardAI scans prompts in your repo
2. Scores each one against the Safety Score engine
3. Fails the workflow if any score falls below your threshold
4. Posts a summary directly to the PR

No API key required for basic CI use.

---

## Links

- [CostGuardAI](https://costguardai.io)
- [Safety Score Methodology](https://costguardai.io/methodology)
- [Prompt Vulnerability Registry](https://costguardai.io/vulnerabilities)
