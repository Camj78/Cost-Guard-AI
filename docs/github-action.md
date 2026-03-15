# GitHub Action — CostGuard Prompt Scan

Block deployments when AI prompts exceed your risk threshold.

```yaml
- uses: costguardai/prompt-scan@v1
  with:
    api_key: ${{ secrets.COSTGUARD_API_KEY }}
```

---

## How It Works

1. Scans your repository for prompt files (`*.prompt`, `*.txt`, `*.md`, `*.ts`, `*.js`).
2. Extracts prompt strings — full file content for text files, embedded template literals for source files.
3. Calls the CostGuard API to score each prompt for cost and failure risk.
4. Posts a summary comment to the pull request.
5. Fails the build (`exit 1`) if any prompt's CostGuardAI Safety Score falls below the configured threshold.

Completes in under 10 seconds on typical repositories.

---

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api_key` | Yes | — | CostGuard API key. Store as a repository secret. Get one at [costguardai.io](https://costguardai.io). |
| `path` | No | `.` | Directory to scan, relative to the repository root. Useful for monorepos. |
| `risk_threshold` | No | `70` | Risk score 0–100. Build fails if any prompt exceeds this value. |

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `highest_risk_score` | string | Highest risk score found across all scanned prompts. |
| `scanned_files` | string | Total number of files scanned. |
| `blocked` | string | `"true"` if threshold was exceeded, `"false"` otherwise. |

---

## Install

### Step 1 — Add secret

In your repository: **Settings → Secrets and variables → Actions → New repository secret**

```
Name:   COSTGUARD_API_KEY
Value:  <your CostGuard API key>
```

### Step 2 — Create workflow

Create `.github/workflows/costguard.yml`:

```yaml
name: CostGuard Prompt Scan

on:
  pull_request:
    branches:
      - main
      - master

jobs:
  prompt-scan:
    name: Prompt Risk Check
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: costguardai/prompt-scan@v1
        with:
          api_key: ${{ secrets.COSTGUARD_API_KEY }}
          risk_threshold: 70
```

---

## Scanning a specific directory

Useful for monorepos or projects that store prompts in a dedicated folder:

```yaml
- uses: costguardai/prompt-scan@v1
  with:
    api_key: ${{ secrets.COSTGUARD_API_KEY }}
    path: prompts/
    risk_threshold: 60
```

---

## Reading the PR comment

The action posts a comment to every pull request with:

- Pass/fail status per file
- Risk score and risk band (LOW / MEDIUM / HIGH / CRITICAL)
- Estimated cost per 1k API calls
- Top risk drivers
- Link to the full CostGuard report

The comment is updated in place on subsequent pushes — it does not create duplicates.

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All prompts passed (or no prompts found). Build continues. |
| `1` | One or more prompts exceeded the risk threshold. Build blocked. |
| `2` | Runtime error (invalid API key, network failure). Build blocked. |

---

## File type behavior

| Extension | Extraction method |
|-----------|------------------|
| `.prompt` | Entire file content treated as the prompt. |
| `.txt` | Entire file content treated as the prompt. |
| `.md` | Entire file content treated as the prompt. |
| `.ts` | Template literals assigned to prompt-like variable names (`prompt`, `system`, `instruction`, `message`, `context`, `template`) are extracted. Long standalone template literals (120+ chars, >55% alphabetic) are also captured. |
| `.js` | Same as `.ts`. |

Files larger than 100KB and directories (`node_modules`, `.git`, `.next`, `dist`, `build`) are skipped automatically. A maximum of 50 files are scanned per run to keep execution time under 10 seconds.

---

## Using outputs in downstream steps

```yaml
- uses: costguardai/prompt-scan@v1
  id: scan
  with:
    api_key: ${{ secrets.COSTGUARD_API_KEY }}

- name: Print scan summary
  run: |
    echo "Highest risk score: ${{ steps.scan.outputs.highest_risk_score }}"
    echo "Files scanned: ${{ steps.scan.outputs.scanned_files }}"
    echo "Blocked: ${{ steps.scan.outputs.blocked }}"
```

---

## Soft mode (report only, never block)

Set `risk_threshold` to `100` to post the PR comment without ever failing the build:

```yaml
- uses: costguardai/prompt-scan@v1
  with:
    api_key: ${{ secrets.COSTGUARD_API_KEY }}
    risk_threshold: 100
```

---

## Troubleshooting

### Exit code 2 — runtime errors

| Error message | Root cause | Fix |
|---|---|---|
| `api_key input is required` | Secret not set | Add `COSTGUARD_API_KEY` in **Settings → Secrets → Actions** |
| `Invalid API key (401)` | Wrong or revoked key | Re-generate your key at costguardai.io → API Keys |
| `Free tier limit reached (429)` | Monthly analysis quota exceeded | Upgrade to Pro at costguardai.io/pricing |
| `API request timed out (30s)` | Network unreachable from runner | Check runner network policies; verify costguardai.io is reachable |
| `CostGuard server error (5xx)` | Upstream outage | Check costguardai.io/status; re-run the workflow |
| `All N API request(s) failed` | Every scan failed (key, network, or quota) | Resolve the underlying error shown in the log |

### Exit code 1 — threshold exceeded

The build is intentionally blocked. Improve your prompt's CostGuardAI Safety Score by addressing the **Top Risks** listed in the PR comment, then push again.

To unblock temporarily: set `risk_threshold: 100` (soft mode) while you iterate, then restore the threshold before merging.

### No prompts found

If the action reports `No extractable prompts found`, your prompt files may be in a non-standard location. Use the `path` input to point at the right directory:

```yaml
- uses: costguardai/prompt-scan@v1
  with:
    api_key: ${{ secrets.COSTGUARD_API_KEY }}
    path: src/prompts/
```

For source files (`.ts`, `.js`), prompts are only extracted from template literals assigned to variables named `prompt`, `system`, `instruction`, `message`, `context`, or `template`.

### PR comment not appearing

The action requires `pull-requests: write` permission and `GITHUB_TOKEN`. Verify your workflow includes:

```yaml
permissions:
  pull-requests: write
  contents: read
```

If running in a fork's pull request, `GITHUB_TOKEN` from the fork does not have write access to the base repo. This is a GitHub security boundary — the PR comment step is silently skipped rather than failing the build.

### Duplicate PR comments

Duplicate comments indicate that the `<!-- costguard-prompt-scan -->` marker is being stripped or modified. Do not edit CostGuard comments manually — the action searches for this marker to find and update the existing comment.

---

## Publishing the action

The action source lives in `github-action/` within the CostGuard monorepo.
To publish as `costguardai/prompt-scan`:

1. Create a new repository named `prompt-scan` under the `costguardai` GitHub org.
2. Copy `github-action/action.yml` → `action.yml` (root of the new repo).
3. Copy `github-action/scan.js` → `scan.js` (root of the new repo).
4. Tag the commit `v1` and create a GitHub release.

Users can then reference it with `uses: costguardai/prompt-scan@v1`.
