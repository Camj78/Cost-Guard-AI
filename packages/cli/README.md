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
# Analyze a single prompt file
costguardai analyze prompt.prompt

# Scan entire repo, fail CI if risk >= 70
costguardai ci --fail-on-risk 70

# Initialize config
costguardai init
```

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
- GitHub: https://github.com/costguardai/costguard
