# CostGuardAI — Launch Readiness Checklist

**Version:** 1.0
**Status:** Pre-launch
**Updated:** 2026-03-09

Run this checklist before each public launch or major release.

---

## Infrastructure

- [ ] **Environment variables configured**
  - `NEXT_PUBLIC_SUPABASE_URL` set in production environment
  - `SUPABASE_SERVICE_ROLE_KEY` set in production environment
  - `SUPABASE_ANON_KEY` set in production environment
  - Stripe keys set (if billing enabled)
  - `CRON_SECRET` set (for weekly intelligence job)
  - `NEXT_PUBLIC_SENTRY_DSN` set (if Sentry enabled)

- [ ] **Database migrations applied**
  - `create_billing_accounts.sql`
  - `create_prompt_threat_intelligence.sql`
  - `create_ai_usage_events.sql`
  - `add_trust_fields_to_analysis_history.sql`
  - `add_analysis_version_to_prompt_incidents.sql`

---

## Scoring Engine

- [ ] **Benchmarks passing**
  - Run: `pnpm benchmark`
  - All 5/5 fixtures must pass
  - Artifacts persisted to `artifacts/benchmarks/`

- [ ] **Example score verification**
  - Run: `pnpm tsx scripts/run-benchmarks.ts --verify-examples`
  - All examples must pass within ±15 tolerance
  - Confirms documentation is consistent with the engine

- [ ] **Score changelog current**
  - `docs/score-changelog/` reflects current `analysis_version`
  - `ANALYSIS_VERSION` in `packages/core/src/version.ts` is up to date

---

## Trust & Transparency

- [ ] **CVE Explorer operational**
  - `/vulnerabilities` page loads
  - Most Observed Vulnerabilities section renders
  - Recent Vulnerabilities section renders
  - Individual CVE detail pages accessible

- [ ] **Methodology page public**
  - `/methodology` accessible without authentication
  - Scoring formula and component weights documented

- [ ] **Calibration history visible**
  - `/methodology/calibration` or equivalent accessible
  - Benchmark artifact history present in `artifacts/benchmarks/`

- [ ] **Score changelog visible**
  - `/methodology/changes` page accessible
  - Current version entry present in changelog

- [ ] **Example library accessible**
  - `/examples` page loads
  - All 5 canonical examples render correctly

---

## Privacy & Security

- [ ] **Prompt storage audit complete**
  - No raw prompts stored in any database table
  - Pattern hashes confirmed as one-way structural fingerprints
  - `docs/SECURITY_REVIEW_PROCESS.md` Data Privacy Guarantees section reviewed

- [ ] **Badge endpoint verified**
  - Run: `pnpm tsx scripts/verify-badge.ts`
  - Returns `Content-Type: image/svg+xml`
  - Renders correctly in browser, GitHub README markdown, and direct image request

- [ ] **Pattern hash not exposed in any public UI or API**
  - Verified: no `pattern_hash` field in `/api/v1/analyze` response
  - Verified: no `pattern_hash` field in shareable report pages

---

## Integration Readiness

- [ ] **Public API endpoint live**
  - `POST /api/v1/analyze` returns `200` with valid JSON
  - API key authentication enforced
  - `safety_score`, `analysis_version`, `ruleset_hash` present in response

- [ ] **CLI functional**
  - `costguard analyze` command works
  - `costguard ci --fail-on-risk <n>` exits with correct codes

- [ ] **GitHub Action workflow present**
  - `.github/workflows/costguard.yml` exists and runs on PR
  - PR comment posted with CostGuard Safety Check results

- [ ] **GitHub PR Safety Check scaffold in place**
  - `src/integrations/github/pr-safety-check.ts` present
  - Interface documented for future implementation

---

## Frontend

- [ ] **Landing page trust section visible**
  - "Why developers trust CostGuard" section present
  - 3 trust pillars render: Versioned Safety Score, Prompt CVE Intelligence, Privacy-Safe Analysis
  - Supporting links row present: Methodology, Vulnerabilities, Examples, Calibration

- [ ] **TypeScript: no errors**
  - Run: `pnpm typecheck`
  - Zero TypeScript errors

- [ ] **Build succeeds**
  - Run: `pnpm build`
  - Zero build errors

---

## Smoke Tests

- [ ] **E2E smoke tests pass**
  - Run: `pnpm e2e`
  - All smoke scenarios pass

---

## Notes

Record any deferred items or known advisories here before launch.

| Item | Status | Owner | Notes |
|---|---|---|---|
| | | | |
