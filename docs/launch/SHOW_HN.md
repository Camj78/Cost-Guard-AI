# Show HN — CostGuardAI

## Headline Options

**Option A:**
```
Show HN: CostGuardAI – Safety Score your LLM prompts before they ship to production
```

**Option B:**
```
Show HN: CostGuardAI – A preflight analyzer for LLM prompts (token cost + failure risk)
```

**Option C:**
```
Show HN: I built a linter for LLM prompts – scores risk before deployment, runs in CI
```

## Recommended Title
```
Show HN: CostGuardAI – Preflight your LLM prompts before they hit production
```

## Launch Post Body

```
I've been building AI features for the past 18 months and kept running into the
same class of bugs: prompts that worked perfectly in testing, then silently
truncated, ballooned in cost, or failed unpredictably once real data hit them.

CostGuardAI is a preflight analysis tool for LLM prompts. The idea is simple:
treat prompts like code, and lint them before you ship.

You give it a prompt file, it gives you:

- Exact token count (OpenAI BPE encoder) or calibrated estimate (Anthropic/Gemini)
- Cost per request + projected monthly cost at production volume
- A Safety Score (0–100) based on five weighted heuristics:
  - Structural quality (missing output format, missing refusal boundary, etc.)
  - Ambiguity density (vague qualifiers, undefined scope references)
  - Context saturation (% of context window consumed)
  - Output volatility (instructions that produce high-variance outputs)
  - Length penalty (prompts approaching truncation threshold)
- Top risk drivers with specific mitigation suggestions
- CI integration: fail builds when Safety Score falls below your configured threshold
- GitHub Action: auto-comment on every PR with score + shareable report link

The CLI is one command:

  npx @camj78/costguardai analyze prompt.txt

The scoring is deterministic and versioned. Every result includes a ruleset hash
so you can reproduce the same score on the same prompt at any future date.
Benchmark fixtures are public: https://costguardai.io/methodology

I'm not trying to replace prompt engineering judgment. I'm trying to make risk
visible before deployment — the same way a compiler makes type errors visible
before runtime.

Free tier: 25 analyses/month. Pro: unlimited + history + API access.

Site: https://costguardai.io
Docs: https://costguardai.io/docs
CLI: npx @camj78/costguardai --help

Happy to answer anything about the scoring algorithm, architecture, or use cases.
```

## Prepared Comment Replies

### "How is this different from just counting tokens yourself?"
```
Token count alone doesn't tell you whether the prompt will fail or produce
garbage output. The interesting signal is the combination: a 2,000-token prompt
at 98% context saturation with ambiguous instructions and no output format
constraint is a different risk profile from the same token count with tight
structural guidance.

The Safety Score surfaces that difference before deployment. Token counting is
one input. Structural analysis is the actual value.
```

### "Is there a CLI?"
```
Yes. npx @camj78/costguardai analyze prompt.txt (or pipe stdin).

CI usage: costguardai ci --fail-on-risk 70 ./prompts/  # blocks if Safety Score < 30

The GitHub Action runs on every PR, posts a comment with the score, and links
to a shareable report. Install takes about 30 seconds: npx @camj78/costguardai install
```

### "How do you score risk? Can you share the methodology?"
```
Five weighted components:
  1. Structural failure (missing output format, refusal boundary, error conditions)
  2. Ambiguity density (count of vague qualifiers, undefined scope terms)
  3. Context saturation (% of context window used by input + expected output)
  4. Output volatility (instructions likely to produce high-variance responses)
  5. Length penalty (proximity to truncation threshold)

Full spec with component weights: https://costguardai.io/methodology

The scoring is versioned (every result has a ruleset hash) and benchmark-validated
against 5 canonical fixture prompts. The benchmarks are public.
```

## Timing Notes
- Post Tuesday–Thursday, 9–11am ET
- Respond to every comment within 30 minutes for the first 4 hours
- Upvote carefully — HN is sensitive to coordinated voting
- Tag: `Show HN`
