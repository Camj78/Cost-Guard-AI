# CostGuardAI CLI

> Preflight analysis for LLM prompts. Catch cost overruns and failure risk before they ship.

```sh
npm install -g @camj78/costguardai
costguardai ci --fail-on-risk 70
```

---

## Install

```sh
npm install -g @camj78/costguardai
```

## Usage

```sh
# Analyze a prompt
costguardai analyze my-prompt.txt

# Block unsafe prompts in CI
costguardai ci --fail-on-risk 70

# Initialize CostGuardAI in your repo
costguardai init
```

CostGuardAI CI will fail if the prompt's CostGuardAI Safety Score falls below your configured threshold.

## Automatic Prompt Hardening

```sh
costguardai fix prompt.txt
```

CostGuardAI can automatically harden prompts by adding injection protections,
system boundaries, and safety guards.

```
CostGuardAI Fix Mode
────────────────────────────────────────────────
Original Safety Score: 58
Issues Detected:
  • Structural Risk
  • Ambiguity Risk

Applying prompt hardening...
  ✔ Added system boundary protections
  ✔ Removed injection vulnerability
  ✔ Added explicit instruction scoping

New Safety Score: 92

Hardened prompt written to:
  prompt.hardened.txt
```

The hardened prompt is written to `<original-name>.hardened.<ext>` alongside the original file.

## GitHub Actions

```yaml
name: CostGuardAI
on: [pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @camj78/costguardai
      - run: costguardai ci --fail-on-risk 70
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All files below threshold |
| 1 | Runtime error |
| 2 | One or more files at or above threshold |

## Commands

| Command | Description |
|---------|-------------|
| `analyze <path>` | Analyze prompt files in a directory or single file |
| `fix <file>` | Harden a prompt and improve its safety score |
| `ci [path]` | CI-native scan with `--fail-on-risk <n>` |
| `init` | Create `costguard.config.json` with defaults |

## Options

```
--model <id>             gpt-4o-mini (default), gpt-4o, claude-sonnet-4-6, claude-haiku-4-5
--format text|md|json    Output format (default: text)
--json                   Shorthand for --format json
--fail-on-risk <n>       Exit 2 if any file risk_score >= n  [ci command]
--threshold <n>          Same as --fail-on-risk               [analyze command]
--ext <exts>             Comma-separated extensions (default: .txt,.md,.prompt)
--expected-output <n>    Expected output tokens (default: 512)
--config <path>          Config file path (default: costguard.config.json)
```

## Links

- Docs: https://costguardai.io/docs
- Web app: https://costguardai.io
- GitHub: https://github.com/Camj78/Cost-Guard-AI
