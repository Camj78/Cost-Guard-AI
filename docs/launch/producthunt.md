# Product Hunt Listing

## Tagline (max 60 chars)
```
RiskScore your LLM prompts before they ship
```

## Description (max 260 chars)
```
CostGuard analyzes your LLM prompts before deployment. Get a CostGuardAI Safety Score,
exact token count, cost estimate, and actionable mitigations. Integrates with
your CI pipeline — fail builds on risky prompts before they hit production.
```

## Topics
- Developer Tools
- Artificial Intelligence
- Productivity

## First Comment (founder post — post immediately after launch goes live)

```
Hi PH!

I built CostGuard after discovering that a single ambiguous prompt in our
production pipeline was costing ~$400/month more than necessary — and we only
found out when the invoice arrived.

The core idea: run a preflight check on your LLM prompts the same way you'd run
a linter on your code. CostGuard computes a RiskScore (0–100) based on five
heuristics — length, context saturation, ambiguity, structural quality, and
output volatility — and gives you specific fixes.

Key features:
→ CLI: `costguard analyze prompt.txt`
→ CI integration: fail builds above a risk threshold
→ GitHub PR comments with score + shareable report link
→ Observability dashboard: cost and risk trends over time
→ Reproducible scoring: version-stamped, replayable

Free to start. No credit card required.

Would love to hear what prompts you're building with.
```

## Screenshots (required at launch)
- `screenshots/risk-report-page.png` — public report page
- `screenshots/ci-pr-comment.png` — GitHub PR comment
- `screenshots/observability-dashboard.png` — observability view

## Gallery Order
1. Risk report page (hero)
2. CI PR comment
3. Observability dashboard

## Gallery Descriptions
1. "RiskScore with top drivers and mitigations — shareable via permalink"
2. "Automatic PR comment on every push — score, drivers, report link"
3. "Track token volume, cost, and risk trends across all models"
