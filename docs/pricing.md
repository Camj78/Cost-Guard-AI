# CostGuardAI Pricing

CostGuardAI prevents unsafe and expensive AI prompts from reaching production.
The pricing model reflects three stages of adoption: individual evaluation,
developer workflow integration, and team-wide enforcement.

---

## Tier Overview

### Free — $0

For developers evaluating CostGuardAI or running lightweight audits.

- CLI analysis (`costguard analyze`)
- RiskScore + explainability output
- Shareable reports (`/s/<id>`)
- 25 analyses per month
- Basic CI usage (output only, no enforcement)

**Limit:** 25 analyses/month resets on the first of each calendar month.
Analyses are counted per API call, whether from the CLI, the web app, or direct API.

---

### Pro — $29 / developer / month

For developers integrating CostGuard into their daily workflow and CI pipelines.

- Everything in Free
- **Unlimited analyses**
- **CI guardrails** — `--fail-on-risk <threshold>` exits non-zero to block merges
- **PR comments** — automatic risk summaries posted to GitHub pull requests
- **Observability dashboard** — per-model cost trends, risk distribution, latency percentiles
- **Replay support** — deterministic re-analysis of any prior prompt with trust verification

One subscription covers one developer's API key and CLI usage.
Teams of developers each need their own Pro subscription, or use the Team tier.

---

### Team — $99 / organization / month

For engineering teams enforcing consistent risk policies across repositories.

- Everything in Pro
- **Organization dashboard** — aggregate risk and cost across all members and repos
- **Team risk policies** — define org-wide score thresholds enforced in CI
- **Repo-level thresholds** — different pass/fail limits per repository
- **Cross-project cost tracking** — unified spend view across multiple projects
- **Audit logs** — full record of who ran what analysis, when, and what the result was

One subscription covers the entire organization regardless of developer count.

---

## Feature Comparison

| Feature | Free | Pro | Team |
|---|:---:|:---:|:---:|
| CLI analysis | ✓ | ✓ | ✓ |
| RiskScore (0–100) | ✓ | ✓ | ✓ |
| Explainability output | ✓ | ✓ | ✓ |
| Shareable reports | ✓ | ✓ | ✓ |
| Analyses per month | 25 | Unlimited | Unlimited |
| Basic CI output | ✓ | ✓ | ✓ |
| CI guardrails (`--fail-on-risk`) | — | ✓ | ✓ |
| PR comments | — | ✓ | ✓ |
| Observability dashboard | — | ✓ | ✓ |
| Replay + trust verification | — | ✓ | ✓ |
| Organization dashboard | — | — | ✓ |
| Team risk policies | — | — | ✓ |
| Repo-level thresholds | — | — | ✓ |
| Cross-project cost tracking | — | — | ✓ |
| Audit logs | — | — | ✓ |

---

## Upgrade Path

```
Free → Pro
  When: you hit the 25/month limit, or need CI enforcement
  How:  Dashboard → Settings → Upgrade → Pro

Pro → Team
  When: multiple developers need a shared policy layer
  How:  Dashboard → Settings → Upgrade → Team
```

Downgrading takes effect at the end of the current billing period.
Analysis history is preserved on downgrade.

---

## Why CI Guardrails Are Worth $29/month

The average LLM production incident caused by an over-long or ambiguous prompt
costs hours of engineering time plus unexpected API spend. CostGuard's CI
guardrail (`--fail-on-risk 75`) blocks the merge before that happens.

One blocked incident recovers the cost of a year's Pro subscription.

The guardrail is a single line in any CI config:

```yaml
- run: costguard analyze prompts/ --fail-on-risk 75 --json
```

Exit code `1` fails the pipeline. Exit code `0` passes. No guesswork.

---

## Why Team Policies Matter

Without shared policies, every developer sets their own bar.
One team member ships a prompt with a risk score of 90 because their local
threshold was never aligned with the team's.

Team tier enforces one policy file committed to the repo:

```json
{
  "defaultThreshold": 70,
  "perRepo": {
    "payments-service": 50,
    "internal-tools": 85
  }
}
```

Every CI run in every repo reads the policy. No drift. No exceptions.

---

## What CostGuard Prevents

- **Runaway token costs** — prompts that consume 95%+ of context window silently
- **Silent truncation** — model drops instructions without warning
- **Ambiguous prompts** — high ambiguity score predicts inconsistent outputs
- **Unsafe production prompts** — risk score > threshold blocks deployment

---

## Questions

Contact: team@costguardai.io
