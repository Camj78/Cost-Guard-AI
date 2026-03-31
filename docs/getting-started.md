# Getting Started with CostGuard

Full setup in under 5 minutes.

---

## 1. Install the CLI

```bash
npm install -g costguard
```

Verify:

```bash
costguard --version
```

---

## 2. Run Your First Analysis

Create a prompt file:

```bash
echo "You are a helpful assistant. The user asks: {{question}}" > prompt.txt
```

Run the analysis:

```bash
costguard analyze prompt.txt
```

Output:

```
Safety Score:  72  (Low)
Tokens:        18
Cost/request:  $0.0001
Context:       0.1%

Summary: Low risk. Prompt is concise with minimal ambiguity.
```

---

## 3. Run the CI Guardrail

Fail the build if the CostGuardAI Safety Score falls below your threshold:

```bash
costguard ci prompt.txt --fail-on-risk 70
```

Exit codes:
- `0` — Safety Score is above threshold (pass)
- `1` — Safety Score falls below threshold (fail)
- `2` — runtime error

For JSON output (useful for CI parsing):

```bash
costguard ci prompt.txt --fail-on-risk 70 --json
```

---

## 4. Enable the GitHub Action

Create `.github/workflows/costguard.yml` in your repo:

```yaml
name: CostGuard Analysis

on:
  pull_request:
    branches: [main, master]

jobs:
  costguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install CostGuard
        run: npm install -g costguard

      - name: Run analysis
        id: analysis
        run: |
          costguard ci prompt.txt --fail-on-risk 70 --json > costguard-result.json || true

      - name: Post PR comment
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: npx tsx scripts/post-pr-comment.ts costguard-result.json
```

The action posts an analysis comment on every PR, including:
- Safety Score and safety band
- Top risk drivers
- Link to the full shareable report
- Attribution footer with score version

---

## 5. View the Observability Dashboard

After running analyses through the API or dashboard:

1. Log in at [costguardai.io](https://costguardai.io)
2. Navigate to **Dashboard → Observability**
3. View token volume, cost trends, and CostGuardAI Safety Score distribution over time

---

## Next Steps

- [API Reference](https://costguardai.io/docs/api) — integrate CostGuard into your build pipeline
- [Demo Flow](./demo-flow.md) — end-to-end walkthrough
- [Shareable Reports](https://costguardai.io/report/) — send risk reports to teammates
