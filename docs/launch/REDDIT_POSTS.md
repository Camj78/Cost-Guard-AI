# Reddit Launch Posts — CostGuardAI

---

## r/startups

**Title:** Built a preflight analysis tool for LLM prompts after getting surprised by a production cost spike — looking for feedback

**Body:**
Six months ago I was building an AI feature and a single ambiguous prompt in our pipeline was generating 3x the expected token output. We found out when the invoice arrived.

I built CostGuardAI to solve this. It analyzes your LLM prompts before deployment and gives you:

- A Safety Score (0–100) based on structural quality, ambiguity, context saturation, output volatility
- Exact token count and cost per request estimate
- Specific fixes for each risk driver
- A CLI that integrates with CI — fail builds when a prompt crosses your risk threshold

The CLI one-liner: `npx @camj78/costguardai analyze prompt.txt`

It installs into your GitHub repo in 30 seconds and posts a score on every PR automatically.

Free tier is live. Pro adds unlimited analyses, history, and API access.

Site: costguardai.io

What I'm looking for: has anyone else built tooling around prompt quality? What's your current workflow for catching prompt regressions before they hit production?

---

## r/SideProject

**Title:** I built a linter for AI prompts — catches risky patterns before you ship. Would love brutal feedback.

**Body:**
The problem: I kept shipping LLM prompts that worked fine in testing, then silently truncated or ran up costs in production. No warnings. Just a bigger invoice.

So I built CostGuardAI — a preflight analyzer for LLM prompts. You point it at a prompt file and it gives you a Safety Score, token count, cost estimate, and a list of specific things to fix.

CLI: `npx @camj78/costguardai analyze prompt.txt`

The GitHub Action auto-comments on every PR with the score and a report link. Took me about 30 seconds to set up.

Live at costguardai.io — free to start.

I'd really appreciate feedback on:
1. Is the Safety Score legible / useful or is it noise?
2. Is CI integration the right place for this, or would you prefer IDE integration?
3. What prompt quality problems are you running into that this doesn't address?

Not looking for upvotes, genuinely want to know what's broken or missing.

---

## r/Entrepreneur

**Title:** 6 months of building a developer tool for AI cost control — sharing what worked, asking what's missing

**Body:**
I've been quietly building CostGuardAI, a preflight analysis tool for LLM prompts. The core idea: treat prompts like code, lint them before you ship.

After 6 months, the thing that resonated most with early users wasn't the cost estimate. It was the Safety Score — a single number that tells you how likely a prompt is to fail or behave unexpectedly in production.

The CLI is one command. The GitHub Action installs in 30 seconds. The scoring is versioned and replayable.

It's live at costguardai.io with a free tier.

Two questions for this community:
1. If you're using LLM APIs in a product, is prompt quality analysis something your team would actually use?
2. What would make you pay for it vs. build something yourself?

I'm not looking to pitch, I'm trying to understand if I've built something people actually need or something I personally needed.

---

## r/MachineLearning

**Title:** Structured heuristic scoring for LLM prompt risk — methodology and benchmark fixtures (open for critique)

**Body:**
I've been working on a static analysis approach to LLM prompt safety scoring. The goal was to produce a deterministic, versioned Safety Score (0–100, higher = safer) for a prompt based on structural features alone — no model inference required.

The five components:
1. **Structural failure** — missing output format instruction, missing refusal boundary, missing error conditions
2. **Ambiguity density** — count of semantically vague qualifiers above a calibrated threshold
3. **Context saturation** — % of context window consumed by input + expected output tokens
4. **Output volatility** — instructions likely to produce high-variance outputs (e.g., "be creative", "generate options")
5. **Length penalty** — proximity to truncation threshold

Weights are calibrated against 5 canonical benchmark fixtures ranging from safe-structured to injection-vulnerable patterns. The scoring is versioned (ruleset hash) and replayable.

Full methodology: costguardai.io/methodology
Benchmark fixtures and changelog: costguardai.io/methodology/changes
Vulnerability registry: costguardai.io/vulnerabilities

Honest questions for this community:
- Is heuristic structural scoring a useful signal, or does it miss too much of the actual failure surface?
- Are there structural features you'd expect in a robust prompt risk model that aren't in these five components?
- Does the benchmark approach for calibration make sense, or is there a better validation methodology?

I'm more interested in whether the approach is sound than in traffic.

---

## r/programming

**Title:** I added a CI step that fails builds when a prompt's CostGuardAI Safety Score is too low — here's how it works

**Body:**
I got tired of shipping AI prompts with no visibility into whether they'd behave predictably in production. So I built a static analyzer for LLM prompts and wired it into CI.

The tool (CostGuardAI) runs a preflight analysis on every prompt file and outputs:
- Token count + cost estimate
- A Safety Score (0–100) based on five heuristics: structural quality, ambiguity, context saturation, output volatility, length
- Specific mitigations for each risk driver

The CI integration:
```
# .github/workflows/costguard-pr.yml
- name: CostGuard preflight
  run: npx @camj78/costguardai ci --fail-on-risk 70 ./prompts/
```

Exit codes: 0 = pass, 1 = Safety Score below threshold, 2 = runtime error.

It also posts a comment on PRs with the score and a shareable report link.

One-command install: `npx @camj78/costguardai install`

The scoring is deterministic — same input, same ruleset hash, same score. Every result is stamped for reproducibility.

Site and docs: costguardai.io

Question for the thread: does treating prompts as build artifacts (lint them, gate on quality) make sense as a workflow, or is it solving the wrong layer of the problem?
