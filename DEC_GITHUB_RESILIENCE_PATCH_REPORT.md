# DEC_GITHUB_RESILIENCE_PATCH_REPORT.md

Recover Endpoint Lockdown + Batch Cap — Patch Verification

---

## Commands Run

```
pnpm typecheck
npx tsx tests/github-webhook-resilience.test.ts
pnpm test   # golden suite (24 cells)
```

---

## Results

### typecheck
```
> tsc --noEmit
(no output — 0 errors)
```
**PASS**

### Resilience test suite
```
38 tests: 38 passed, 0 failed
```
**PASS**

### Golden suite
```
SUMMARY: 24/24 PASS | 0 FAIL
Safe to deploy: YES
```
**PASS**

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/github/recover/route.ts` | Auth lockdown: secret now REQUIRED (503 if unset/empty); `MAX_ITEMS_PER_RUN` 20 → 50 |
| `tests/github-webhook-resilience.test.ts` | Added 11 new tests (auth × 5, cap × 6) |

---

## Behavior Summary

### Gate A — Secret required (503 if unset)

**Before:**
```ts
if (recoverSecret) {        // open if not set
  // check auth
}
```

**After:**
```ts
if (!recoverSecret) {
  return NextResponse.json(
    { ok: false, error: "recover_not_configured" },
    { status: 503 }
  );
}
// auth check always runs
if (auth !== `Bearer ${recoverSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

The endpoint is now **never open**. Missing or empty `GITHUB_RECOVER_SECRET` returns `503 { ok: false, error: "recover_not_configured" }` immediately, before any DB access.

### Gate B — Batch cap

`MAX_ITEMS_PER_RUN` changed from `20` to `50`. The `.limit()` call in the Supabase query already used this constant, so ordering and stable processing are preserved (`order("next_attempt_at", { ascending: true })`).

### Gate C — New tests

**Auth tests (5):**
- `missing GITHUB_RECOVER_SECRET → 503 recover_not_configured` ✅
- `empty GITHUB_RECOVER_SECRET → 503 recover_not_configured` ✅
- `secret set, no Authorization header → 401` ✅
- `secret set, wrong token → 401` ✅
- `secret set, correct Bearer token → 200 (passes auth)` ✅

**Batch cap tests (6):**
- `cap: 0 pending → processes 0` ✅
- `cap: 10 pending → processes 10 (under cap)` ✅
- `cap: exactly 50 pending → processes 50` ✅
- `cap: 51 pending → processes only 50 (cap enforced)` ✅
- `cap: 200 pending → processes only 50 (cap enforced)` ✅
- `cap: remaining rows stay pending for next invocation` ✅

---

Date: 2026-03-04
