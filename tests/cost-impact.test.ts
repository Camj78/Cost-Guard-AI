/**
 * CostGuardAI — Cost Impact Determinism Tests
 * Verifies same inputs always produce same outputs.
 * Run with: pnpm test:cost-impact
 */

import { estimateCostImpact, MONTHLY_CALL_BASELINE } from "../packages/core/src/cost-estimator";
import { estimateModelCost, MODEL_PRICING } from "../packages/core/src/model-pricing";
import { MODEL_CATALOG } from "../packages/core/src/models";

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertClose(label: string, a: number, b: number, tol = 1e-10): void {
  const diff = Math.abs(a - b);
  if (diff > tol) throw new Error(`${label}: expected ${b}, got ${a} (diff=${diff})`);
}

function assert(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${label}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}: ${(err as Error).message}`);
    failed++;
  }
}

console.log("\nCost Impact Determinism Tests\n");

// 1. MODEL_PRICING is derived from MODEL_CATALOG — no orphan entries
test("MODEL_PRICING covers all MODEL_CATALOG entries", () => {
  for (const m of MODEL_CATALOG) {
    assert(`pricing exists for ${m.id}`, m.id in MODEL_PRICING);
    assertClose(`input_per_1k for ${m.id}`, MODEL_PRICING[m.id].input_per_1k, m.inputPricePer1M / 1000);
    assertClose(`output_per_1k for ${m.id}`, MODEL_PRICING[m.id].output_per_1k, m.outputPricePer1M / 1000);
  }
});

// 2. MONTHLY_CALL_BASELINE is exactly 100_000
test("MONTHLY_CALL_BASELINE == 100000", () => {
  assert("baseline is 100000", MONTHLY_CALL_BASELINE === 100_000);
});

// 3. estimateModelCost is deterministic
test("estimateModelCost is deterministic for gpt-4o", () => {
  const a = estimateModelCost(1000, 200, "gpt-4o");
  const b = estimateModelCost(1000, 200, "gpt-4o");
  assertClose("same call produces same result", a, b);
});

// 4. estimateModelCost formula: (tokens_in/1000)*input_per_1k + (tokens_out/1000)*output_per_1k
test("estimateModelCost formula verification — gpt-4o-mini", () => {
  const tokens_in = 500;
  const tokens_out = 100;
  const model = "gpt-4o-mini";
  const pricing = MODEL_PRICING[model];
  const expected = (tokens_in / 1000) * pricing.input_per_1k + (tokens_out / 1000) * pricing.output_per_1k;
  const actual = estimateModelCost(tokens_in, tokens_out, model);
  assertClose("formula matches", actual, expected);
});

// 5. estimateModelCost returns 0 for unknown model
test("estimateModelCost returns 0 for unknown model", () => {
  const result = estimateModelCost(1000, 200, "unknown-model-xyz");
  assertClose("zero cost for unknown model", result, 0);
});

// 6. estimateCostImpact is deterministic — multiple identical calls produce same result
test("estimateCostImpact is deterministic — 10 identical calls", () => {
  const inputs = { tokens_in: 800, tokens_out: 300, model: "claude-sonnet-4-6" };
  const first = estimateCostImpact(inputs);
  for (let i = 0; i < 9; i++) {
    const next = estimateCostImpact(inputs);
    assertClose(`estimated_cost_per_call iter ${i}`, next.estimated_cost_per_call, first.estimated_cost_per_call);
    assertClose(`estimated_cost_per_1k_calls iter ${i}`, next.estimated_cost_per_1k_calls, first.estimated_cost_per_1k_calls);
    assertClose(`estimated_monthly_cost iter ${i}`, next.estimated_monthly_cost, first.estimated_monthly_cost);
  }
});

// 7. estimateCostImpact — per_1k_calls = per_call * 1000
test("estimated_cost_per_1k_calls == per_call * 1000", () => {
  const result = estimateCostImpact({ tokens_in: 400, tokens_out: 150, model: "gpt-4o" });
  assertClose("per_1k = per_call * 1000", result.estimated_cost_per_1k_calls, result.estimated_cost_per_call * 1000);
});

// 8. estimateCostImpact — monthly_cost = per_call * 100_000
test("estimated_monthly_cost == per_call * 100000", () => {
  const result = estimateCostImpact({ tokens_in: 400, tokens_out: 150, model: "gpt-4o" });
  assertClose("monthly = per_call * 100000", result.estimated_monthly_cost, result.estimated_cost_per_call * 100_000);
});

// 9. All models in catalog produce finite, non-negative cost
test("all catalog models produce finite non-negative cost", () => {
  for (const m of MODEL_CATALOG) {
    const result = estimateCostImpact({ tokens_in: 500, tokens_out: 200, model: m.id });
    assert(`${m.id} per_call >= 0`, result.estimated_cost_per_call >= 0);
    assert(`${m.id} per_call finite`, Number.isFinite(result.estimated_cost_per_call));
    assert(`${m.id} per_1k >= 0`, result.estimated_cost_per_1k_calls >= 0);
    assert(`${m.id} monthly >= 0`, result.estimated_monthly_cost >= 0);
  }
});

// 10. Zero tokens → zero cost
test("zero tokens produce zero cost", () => {
  const result = estimateCostImpact({ tokens_in: 0, tokens_out: 0, model: "gpt-4o-mini" });
  assertClose("per_call is 0", result.estimated_cost_per_call, 0);
  assertClose("per_1k is 0", result.estimated_cost_per_1k_calls, 0);
  assertClose("monthly is 0", result.estimated_monthly_cost, 0);
});

// 11. Gemini flash lite is cheapest per token among catalog models
test("gemini-2.5-flash-lite cheapest per 1k tokens", () => {
  const tokens_in = 1000;
  const tokens_out = 200;
  const geminiCost = estimateModelCost(tokens_in, tokens_out, "gemini-2.5-flash-lite");
  for (const m of MODEL_CATALOG) {
    if (m.id === "gemini-2.5-flash-lite") continue;
    const other = estimateModelCost(tokens_in, tokens_out, m.id);
    assert(`gemini cheaper than ${m.id}`, geminiCost <= other);
  }
});

// 12. Example spot-check for gpt-4o-mini ($0.15/1M in, $0.6/1M out)
test("gpt-4o-mini spot-check: 1k in + 200 out", () => {
  // input: 1000 * (0.15/1M) = $0.00015; output: 200 * (0.6/1M) = $0.00012 → total $0.00027
  const expected = (1000 / 1_000_000) * 0.15 + (200 / 1_000_000) * 0.6;
  const actual = estimateModelCost(1000, 200, "gpt-4o-mini");
  assertClose("spot-check matches", actual, expected);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
