# CostGuard Demo Flow

End-to-end walkthrough from prompt to shareable risk report.

---

## Prerequisites

- CostGuard CLI installed: `npm install -g costguard`
- A CostGuard API key (from [costguardai.io/dashboard](https://costguardai.io/dashboard))
- GitHub repo with the CostGuard Action configured

---

## Step 1: Create a Prompt

Create `prompt.txt`:

```
You are a senior software engineer. Review the following pull request diff and:
1. Identify any security vulnerabilities
2. Flag performance regressions
3. Check for missing test coverage
4. Suggest improvements to code clarity

Diff:
{{diff}}

Provide a structured review with severity levels for each finding.
```

---

## Step 2: Run `costguard analyze`

```bash
costguard analyze prompt.txt
```

Sample output:

```
Safety Score:  38  (High)
Tokens:        87
Cost/request:  $0.0004
Context:       0.5%

Summary: High risk. Ambiguity Risk and Output Volatility Risk are elevated.

Top Risk Drivers:
  Ambiguity Risk       (impact: 45)
  Output Volatility    (impact: 38)

Mitigations:
  · Replace open-ended instruction "suggest improvements" with specific criteria
  · Define expected output format and length constraints
  · Add explicit stop conditions
```

---

## Step 3: Review the Safety Score

The Safety Score of 38 (High) indicates:
- Ambiguous instructions may cause inconsistent model outputs
- Open-ended output format increases cost unpredictability
- Prompt is safe from truncation but benefits from tightening

Revise the prompt to address the top drivers, then re-run `costguard analyze` to verify the Safety Score improves.

---

## Step 4: Push a PR

Commit the prompt (or the code that uses it) and open a pull request:

```bash
git add prompt.txt
git commit -m "feat: add code review prompt"
git push origin feature/code-review-prompt
gh pr create --title "Add code review prompt" --body "Adds structured PR review prompt"
```

---

## Step 5: See the CI Analysis Comment

The CostGuard GitHub Action triggers automatically on the PR.

Within ~30 seconds, a comment appears on the PR:

```
## CostGuard Analysis

**Safety Score: 38 (High)**

### Top Drivers
• Ambiguity Risk
• Output Volatility Risk
• Structural Risk

---
_Analyzed by CostGuard_
_Score Version: v1.0_

[View full report ↗](https://costguardai.io/report/abc123)
```

---

## Step 6: Open the Shareable Report

Click the report link in the PR comment or navigate directly to:

```
https://costguardai.io/report/<analysis_id>
```

The report shows:
- Full Safety Score with safety band
- Top risk drivers with impact scores
- Actionable mitigation suggestions
- Report integrity metadata (score version, analysis version)
- No raw prompt content (privacy-safe by default)

Share this URL with teammates, in Slack, or in code reviews.

---

## What the Flow Proves

| Step | Output |
|------|--------|
| `costguard analyze` | Immediate preflight score in terminal |
| CI Action | Automatic PR comment on every push |
| Shareable report | Permalink for async review |
| Observability dashboard | Aggregate trends over time |
