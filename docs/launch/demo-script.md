# CostGuard 60-Second Demo Script

Target: screencast, live demo, or conference talk intro.

---

## Setup (before recording)

- Terminal open with `prompt.txt` ready
- CostGuard CLI installed
- Browser open on costguardai.io dashboard
- GitHub PR open with CostGuard Action installed

---

## Script (60 seconds)

**[0:00 — 0:08] The Problem**

> "Every LLM API call you ship has hidden cost risk. Tokens you didn't count,
> prompts that will silently truncate, ambiguous instructions that waste money
> at scale. Most teams find out after the bill arrives."

---

**[0:08 — 0:20] Run Preflight**

Switch to terminal. Run:

```bash
costguard analyze prompt.txt
```

> "CostGuard gives you a Safety Score in under a second. This prompt scores 38 —
> High. Two risk drivers flagged: Ambiguity Risk and Output Volatility."

Point to the mitigation list.

> "Not just a number — specific fixes."

---

**[0:20 — 0:35] CI Integration**

Switch to GitHub PR.

> "We also run this in CI. Every pull request gets an automatic analysis comment.
> Score, top drivers, and a shareable report link — before the code ships."

Point to the PR comment showing Safety Score and the footer.

---

**[0:35 — 0:50] Shareable Report**

Click the report link.

> "Click the link. Public, privacy-safe report. No raw prompts — just the risk
> intelligence your team needs to make a decision."

Point to: Safety Score, drivers, mitigations, integrity metadata.

---

**[0:50 — 1:00] Close**

Switch to dashboard observability view.

> "Over time, CostGuard tracks your risk and cost trends across every model and
> endpoint. This is the linting layer your LLM stack is missing."

> "costguardai.io — free to start."

---

## Key Phrases (use verbatim)

- "Safety Score"
- "preflight analysis"
- "the linting layer for LLM prompts"
- "before it ships"
- "free to start"
