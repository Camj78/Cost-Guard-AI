# Systematic Debugging Skill

## IRON LAW
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

## Mode Contract
When Systematic Debug Mode is active:
- You MAY NOT propose fixes, refactors, optimizations, or "try X" suggestions.
- You MAY NOT output code changes of any kind.
- You MAY NOT use "likely/probably" cause→action language before Section F is written.
- Evidence Collected (Section E) must be filled with observed outputs, not planned steps.
- You MUST complete Phase 1 and output a root cause statement BEFORE any fix is considered.
- If the user asks for a fix early, respond with:
  "We are in Systematic Debug Mode. I can't propose fixes until root cause is identified. Next evidence step is: ___."

---

## Required Output Format

Every debug session MUST produce sections in this order:

**A) Symptoms** — Restate exactly what is failing (observable behavior, not assumed cause)
**B) Repro** — Exact reproduction steps; minimal reproducible case
**C) Top 3 Failure Boundaries** — Ranked by likelihood (e.g., data layer, API contract, rendering)
**D) Evidence Plan** — Specific logs, commands, or files to inspect next
**E) Evidence Collected** — What was observed from running the evidence plan
**F) Root Cause Statement** — Single sentence: "Root cause is ___ because ___"
**G) Hypothesis → Test → Fix → Verify** — Only after F is written

---

## 4 Phases

### Phase 1 — Root Cause Investigation
- Restate symptoms (no interpretation yet)
- Identify top 3 failure boundaries (ranked)
- Build evidence plan (logs, commands, files)
- Collect evidence
- Output root cause statement

### Phase 2 — Pattern Analysis
- Identify whether this is a systemic pattern or isolated bug
- Check for related failures or prior occurrences
- Confirm root cause holds against collected evidence

### Phase 3 — Hypothesis & Test
- One hypothesis at a time
- One variable at a time
- Require a failing test or minimal repro BEFORE writing any fix

### Phase 4 — Implementation & Verify
- Write minimal fix targeting the stated root cause
- Verify fix resolves the repro
- Confirm no regression

---

## Escalation Rules

- If 2 fixes attempted and still failing: STOP → return to Phase 1, rebuild evidence plan from scratch
- If 3+ fixes failed: STOP → output "ARCHITECTURE REVIEW REQUIRED" section with:
  - What assumptions have been invalidated
  - What architectural boundaries may be wrong
  - 3–5 questions that challenge the current architecture

---

## Red Flags (Auto-Violation)

If any of the following occur, stop and self-correct:
- Guessing at root cause without evidence
- Making multiple changes simultaneously
- "Quick fix first, investigate later"
- Proposing solutions before evidence is collected
- "One more try" after 2+ failed fixes

---

## Refusal Clause

If user asks for a fix before Phase 1 is complete:

> "We are in Systematic Debug Mode. I can't propose fixes until root cause is identified. Next evidence step is: ___."

No exceptions.
