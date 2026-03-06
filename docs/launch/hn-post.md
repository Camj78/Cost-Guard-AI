# Hacker News Launch Post

**Title:**
```
Show HN: CostGuard – RiskScore your LLM prompts before they ship
```

**Body:**
```
I've been building AI features for the past year and kept running into the same
problem: silent truncation, unpredictable costs, and ambiguous prompts that fail
in production but pass local testing.

CostGuard is a preflight analysis tool for LLM prompts. You run it before you
ship and it gives you:

- Exact token count (OpenAI) or estimate (Anthropic/Gemini)
- Cost per request + projected monthly cost
- A Failure Risk Score (0–100) based on heuristics: length, context saturation,
  ambiguity, structural quality, output volatility
- Specific mitigation suggestions per driver
- CI integration — fail builds when risk exceeds a threshold
- Shareable reports — permalink for async team review

The CLI is one command:

  costguard analyze prompt.txt

The GitHub Action posts a comment on every PR with the score and report link.

I'm not trying to replace prompt engineering judgment. I'm trying to make the
risk visible before deployment, not after the invoice.

Free tier: 25 analyses/month. Pro: unlimited + history + API.

Site: https://costguardai.io
Docs: https://costguardai.io/docs

Happy to answer questions about the scoring algorithm or architecture.
```

---

## Timing Notes

- Post on a weekday between 9–11am ET
- Respond to every comment in the first 2 hours
- Tag: `Show HN`
- Do not post on weekends or holidays
