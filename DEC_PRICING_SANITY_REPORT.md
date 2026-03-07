# DEC_PRICING_SANITY_REPORT

Date: 2026-03-06
Sprint: SP-DEC PRICING-SANITY

---

## 1. Files Checked

| File | Pricing References Found |
|------|--------------------------|
| `README.md` | $0 (Free), $29/month (Pro), $99/month (Team) |
| `docs/pricing.md` | $0 (Free), $29/month (Pro), $99/month (Team) |
| `src/app/upgrade/page.tsx` | $29/month, $199/year (pre-fix), $290/year (post-fix) |
| `src/app/page.tsx` | $29/month, $199/year (pre-fix), $290/year (post-fix) |
| `.env.example` | Comment: $29/month, $199/year (pre-fix), $290/year (post-fix) |

---

## 2. Monthly vs Yearly Comparison

| Metric | Pre-Fix | Post-Fix |
|--------|---------|----------|
| Pro monthly | $29/month | $29/month (unchanged) |
| Pro yearly | $199/year | $290/year |
| Monthly annualized | $348/year | $348/year |
| Annual savings | $149 | $58 |
| Discount percentage | **42.8%** | **16.7%** |
| Effective monthly (annual) | $16.58/month | $24.17/month |

---

## 3. Discount Verdict

**$199/year (42.8% off) — flagged as not intentional.**

Rationale:
- 43% off is consumer-tier pricing, not developer B2B
- Undercuts Pro positioning relative to Team tier ($99/month)
- Sends wrong signal to developer audience: price should reflect value, not volume desperation
- Industry standard for dev tools: 2 months free (~17% off)

**$290/year (16.7% off) — adopted as canonical.**

Rationale:
- Equivalent to 2 months free — clear, defensible, industry-standard framing
- $24.17/month effective rate maintains perceived value
- $58 savings is honest and proportionate
- Preserves pricing authority without looking like a distressed discount

---

## 4. Final Canonical Launch Pricing

| Tier | Price | Notes |
|------|-------|-------|
| Free | $0 | 25 analyses/month |
| Pro | $29/month or $290/year | $290/year = 2 months free (~17% off) |
| Team | $99/month | Available on request |

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/app/upgrade/page.tsx` | $199 → $290; $16.58/month → $24.17/month; "Save $149" → "Save $58" (×2) |
| `src/app/page.tsx` | $199 / yr · Save $149 → $290 / yr · Save $58 |
| `.env.example` | Comment: `# Pro: $199/year` → `# Pro: $290/year` |

Files confirmed unchanged (no annual price references):
- `README.md` — monthly only
- `docs/pricing.md` — monthly only

---

## 6. Verification Results

```
pnpm typecheck → clean (no errors)
```

Stale $199 references: 0 remaining
Checkout UI mismatch: resolved
Docs mismatch: none existed
All pricing surfaces consistent at $290/year.

---

## 7. Commit

`launch: finalize pricing sanity check`
