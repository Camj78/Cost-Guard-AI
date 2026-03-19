# DEC_DEMO_REPORT_PAGE

**Sprint**: SP-DEC DEMO-REPORT-FIX
**Date**: 2026-03-06
**Status**: Complete

---

## Files Created

| File | Type |
|------|------|
| `src/app/report/demo/page.tsx` | New — static demo report route |

No existing files modified.

---

## Components Reused

The demo page reuses all the same UI primitives as `/report/[id]/page.tsx`:

- `<Header />` / `<Footer />` — layout shell
- `<RiskScore />` — score ring + driver list
- `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardContent>` — glass card surfaces
- `ANALYSIS_VERSION` from `@/lib/trust` — Report Integrity row
- `fmtCost()` — inline cost formatter (identical to production)

No new UI components were introduced.

---

## Demo Payload Summary

```
Model:             gpt-4o
Pricing date:      2025-05

RiskScore:         72
RiskLevel:         high
ScoreVersion:      v1.0

inputTokens:       3,240
contextWindow:     128,000
usagePercent:      3.4%
truncation:        safe

estimatedCostTotal: $0.03420
Per 1k calls:       $34.20
Monthly (100k):     $3,420.00

Top Risk Drivers:
  1. Injection Risk  — impact 85
     · Isolate user input from system prompts
     · Apply input sanitization layer
  2. Cost Explosion  — impact 70
     · Set strict max_output_tokens
     · Use prompt caching for repeated context blocks
  3. Ambiguity Risk  — impact 55
     · Add concrete output format requirements
     · Remove vague quality modifiers

Explanation summary:
  "RiskScore 72 (High) driven primarily by Injection Risk and Cost Explosion."

Mitigation suggestions (5):
  · Isolate user input from system prompts
  · Set strict max_output_tokens
  · Apply input sanitization layer
  · Use prompt caching for repeated context
  · Remove vague quality modifiers
```

---

## Routing Behaviour

Next.js App Router resolves static segments before dynamic segments.
`/report/demo` → `src/app/report/demo/page.tsx` (static)
`/report/[id]` → `src/app/report/[id]/page.tsx` (dynamic, DB-backed)

No changes to the `[id]` route or its share-link security logic.

---

## Verification Results

### TypeScript
```
pnpm typecheck → tsc --noEmit
Result: clean (0 errors)
```

### Production Build
```
pnpm build
/report/demo → ○ (Static) — prerendered as static content
```

The demo route prerendered successfully with no DB dependency.

---

## Definition of Done — Checklist

- [x] `/report/demo` renders full report UI (no error card)
- [x] RiskScore card present (score 72, level HIGH)
- [x] Cost Impact card present ($34.20 / 1k · $3,420 / month)
- [x] Top Risk Drivers card present (3 drivers with fixes)
- [x] Mitigation Suggestions card present (5 items)
- [x] Report Integrity card present (version fields)
- [x] "Demo · Risk report" badge in header row
- [x] No database query — fully static
- [x] No changes to `/report/[id]` logic
- [x] `pnpm typecheck` clean
- [x] `pnpm build` succeeds — route listed as ○ Static
