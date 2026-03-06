# DEC_GROWTH_REPORT — SP-DEC 08: Growth Engine

**Date:** 2026-03-06
**Sprint:** SP-DEC 08 — Viral Loop + Launch Kit
**Status:** Complete
**Typecheck:** Clean (0 errors)

---

## Gate A — Viral Hook (PR Footer)

**File:** `scripts/post-pr-comment.ts`

**Changes:**
- Added `FOOTER` constant: `_Analyzed by [CostGuard](https://costguardai.io)_  \n_Score Version: v1.0_`
- Footer now appears in **both** the success case and the error case
- Success case uses `versionedFooter` with dynamic `score_version` from CI output
- Error case previously had no footer — now includes the same attribution format

**Footer format (success):**
```
---
_Analyzed by [CostGuard](https://costguardai.io)_
_Score Version: v1.0_

[View full report ↗](https://costguardai.io/s/<shareId>)
```

**Footer format (error):**
```
---
_Analyzed by [CostGuard](https://costguardai.io)_
_Score Version: v1.0_
```

**Deterministic:** Yes — footer is a compile-time string with only the score_version injected from the CI JSON output.

---

## Gate B — Shareable Risk Report

**Route:** `/report/[id]`
**File:** `src/app/report/[id]/page.tsx`

**Behavior:**
- Queries `share_links` table by ID (same underlying data as `/s/[id]`)
- `dynamic = "force-dynamic"` — no stale cache
- RLS enforces `revoked=false` automatically — no extra server-side filtering needed
- Renders without authentication (public route)

**Sections displayed:**
1. Risk Score card (uses `<RiskScore>` component)
2. Top Risk Drivers with impact scores and fixes
3. Mitigation Suggestions (up to 5, from `explanation.mitigation_suggestions`)
4. Report Integrity card: `analysis_version`, `score_version`, `promptDisplay`

**Trust metadata:**
- `analysis_version`: sourced from `ANALYSIS_VERSION` constant (`"1.0.0"`)
- `score_version`: sourced from `snapshot.analysis.score_version` (`"v1.0"`)

**Report URL example:**
```
https://costguardai.io/report/abc12345-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## Gate C — Sanitization Layer

**File:** `src/lib/reports/sanitize-report.ts`

**Exported:** `sanitizeReport(snapshot: ShareSnapshot): SanitizedReport`

**Policy resolution (`COSTGUARD_PROMPT_STORAGE` env var):**
| Value | Prompt Display |
|-------|----------------|
| `hash` (default) | `[hashed — not displayed]` |
| `redacted` | `[redacted]` |
| `full` | `[Prompt not stored in public snapshots]` |

**Safety guarantee:**
`ShareSnapshot` never contains raw prompt text by design (enforced at the DB insert layer via `share-schema.ts` allowlist). `sanitizeReport` formalizes this invariant as a typed module boundary. The `/report/[id]` page passes all data through `sanitizeReport` before rendering.

---

## Gate D — Getting Started Doc

**File:** `docs/getting-started.md`

**Sections:**
1. Install CLI (`npm install -g costguard`)
2. Run first analysis (`costguard analyze prompt.txt`)
3. Run CI guardrail (`costguard ci prompt.txt --fail-on-risk 70`)
4. Enable GitHub Action (YAML template)
5. View observability dashboard

**Estimated setup time:** < 5 minutes.

---

## Gate E — Demo Flow

**File:** `docs/demo-flow.md`

**Steps:**
1. Create prompt
2. Run `costguard analyze` → observe RiskScore
3. Understand top drivers and mitigations
4. Push PR → CI Action triggers automatically
5. See PR comment with score + report link
6. Open shareable report at `/report/<analysis_id>`

**Result table** included showing what each step produces.

---

## Gate F — Launch Assets

| File | Purpose |
|------|---------|
| `docs/launch/demo-script.md` | 60-second screencap script with timestamps |
| `docs/launch/hn-post.md` | HN Show HN post with title, body, timing notes |
| `docs/launch/producthunt.md` | PH listing: tagline, description, topics, founder comment, gallery |

**Key phrases locked in across all assets:**
- "RiskScore"
- "preflight analysis"
- "the linting layer for LLM prompts"
- "before it ships"

---

## Gate G — Screenshots

**Directory:** `screenshots/`
**File:** `screenshots/README.md`

**Required images (pending capture):**
- `screenshots/observability-dashboard.png`
- `screenshots/risk-report-page.png`
- `screenshots/ci-pr-comment.png`

Capture instructions documented. Automated capture available via `pnpm shot:once`.

---

## Remaining Risks

| Risk | Mitigation |
|------|-----------|
| `analysis_id` in API response ≠ share link ID | Report page uses `share_links.id` directly; `analysis_id` in API is a separate trust identifier. CI output must use `share_url` for the report link, not `analysis_id`. No change needed in current flow. |
| Screenshots are placeholders | Must be captured against real UI before Product Hunt launch |
| Report page uses `ANALYSIS_VERSION` constant | Will need update if version is bumped — this is intentional |
| `/report/[id]` and `/s/[id]` serve same data | `/s/[id]` includes revoke button for owners; `/report/[id]` is public-only. Both are intentional. |

---

## Files Created / Modified

**Created:**
- `src/app/report/[id]/page.tsx`
- `src/lib/reports/sanitize-report.ts`
- `docs/getting-started.md`
- `docs/demo-flow.md`
- `docs/launch/demo-script.md`
- `docs/launch/hn-post.md`
- `docs/launch/producthunt.md`
- `screenshots/README.md`
- `DEC_GROWTH_REPORT.md`

**Modified:**
- `scripts/post-pr-comment.ts` (footer added to error case; success footer standardized)
