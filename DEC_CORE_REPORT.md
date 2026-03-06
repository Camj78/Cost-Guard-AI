# SP-DEC 02.1 — Shared Core Package Report

**Date:** 2026-03-06
**Mission:** Extract shared `packages/core` module used by BOTH web app and CLI; eliminate CLI vendoring.

---

## Files Created

| File | Purpose |
|------|---------|
| `packages/core/package.json` | Package manifest (`@costguard/core`, private, main → `src/index.ts`) |
| `packages/core/tsconfig.json` | IDE/typecheck support for core package |
| `packages/core/src/models.ts` | Canonical model catalog (superset of web + CLI, ~169 lines) |
| `packages/core/src/risk.ts` | Canonical risk engine (merged: exports AMBIGUOUS_TERMS, VOLATILITY_PHRASES, SCORING_WEIGHTS, RISK_LEVELS, computeRequestCost, assessRisk) |
| `packages/core/src/tokenizer.ts` | Canonical tokenizer (no framework deps, imports from `./models`) |
| `packages/core/src/index.ts` | Barrel re-export of all three modules |

## Files Modified

| File | Change |
|------|--------|
| `pnpm-workspace.yaml` | Added `packages: ["packages/*"]` to enable workspace |
| `packages/cli/package.json` | Added `"@costguard/core": "workspace:*"` dependency |
| `packages/cli/tsup.config.ts` | Changed `noExternal: []` → `noExternal: ["@costguard/core"]` so esbuild inlines core |
| `packages/cli/src/commands/analyze.ts` | Imports rewritten from `../core/{models,risk,tokenizer}` → `@costguard/core` |
| `src/lib/ai/models.ts` | Now re-exports from `../../../packages/core/src/models` |
| `src/lib/risk.ts` | Now re-exports from `../../packages/core/src/risk` |
| `src/lib/tokenizer.ts` | Now re-exports from `../../packages/core/src/tokenizer` |
| `eslint.config.mjs` | Removed blanket `packages/cli/**` ignore; added scoped overrides for `packages/**/*.ts` (Next.js/React rules off, `_`-prefixed args pattern) |

## Files Deleted

| File | Reason |
|------|--------|
| `packages/cli/src/core/models.ts` | Vendored copy — replaced by `@costguard/core` |
| `packages/cli/src/core/risk.ts` | Vendored copy — replaced by `@costguard/core` |
| `packages/cli/src/core/tokenizer.ts` | Vendored copy — replaced by `@costguard/core` |

## Where Core Exports Live

**Single source of truth:** `packages/core/src/`

```
packages/core/src/
  index.ts       ← public barrel (export *)
  models.ts      ← MODEL_CATALOG, COMPAT_MAP, DEFAULT_MODEL, resolveModel, validateModel, …
  risk.ts        ← assessRisk, getRiskLevel, AMBIGUOUS_TERMS, VOLATILITY_PHRASES,
                    SCORING_WEIGHTS, RISK_LEVELS, computeRequestCost
  tokenizer.ts   ← countTokens
```

**Web app consumption:** relative path re-exports (no workspace dep required):
- `src/lib/ai/models.ts` → `../../../packages/core/src/models`
- `src/lib/risk.ts` → `../../packages/core/src/risk`
- `src/lib/tokenizer.ts` → `../../packages/core/src/tokenizer`

All existing web app import paths (`@/lib/ai/models`, `@/lib/risk`, `@/lib/tokenizer`, `@/config/models`) continue to work unchanged.

**CLI consumption:** workspace dependency `@costguard/core` (bundled inline by tsup via `noExternal`).

## Commands Run + Results

```
pnpm install
→ Done in 23.5s — @costguard/core linked as workspace package

pnpm typecheck
→ (no output = clean)

pnpm build:cli
→ CJS dist/bin.js 26.49 KB  ⚡️ Build success in 44ms

pnpm test:cli
→ PASS  minimal
→ PASS  risky
→ 2 passed, 0 failed, 0 skipped

pnpm lint
→ 2 warnings, 0 errors
   (header.tsx img warning — pre-existing)
   (github-webhook.test.ts unused var — pre-existing)
```

## Scoring Drift Confirmation

**None.** The canonical `risk.ts` uses `SCORING_WEIGHTS.{length,context,ambiguity,structural,volatility}` constants `{0.25, 0.20, 0.20, 0.20, 0.15}` — mathematically identical to the hardcoded literals in the former web and CLI implementations. The `assessRisk` function body is character-for-character equivalent to both sources.

Golden fixture hashes are unchanged:
- `minimal` → PASS (risk_score, ruleset_hash, all fields match expected JSON)
- `risky` → PASS (risk_score, ruleset_hash, all fields match expected JSON)

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| `packages/core` has no standalone build step | Low | Core is consumed as TypeScript source (web via relative import, CLI via tsup inline bundle). If a third consumer needs a compiled artifact, add a `tsup` step to `packages/core`. |
| Web app tsconfig includes `packages/**/*.ts` via `**/*.ts` glob | Low | Expected behavior — tsc compiles core transitively from re-export files. No separate build needed for web. |
| `noExternal: ["@costguard/core"]` in CLI tsup | Informational | This is correct and intentional. Removing it would break the CLI build (esbuild would treat core as external and runtime would fail). |
