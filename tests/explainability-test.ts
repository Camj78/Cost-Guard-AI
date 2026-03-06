/**
 * CostGuardAI — Explainability Determinism Test
 *
 * Verifies:
 *   1. Same inputs → identical explanation output (strict equality)
 *   2. Driver ordering is stable across repeated calls
 *   3. Mitigation suggestions map directly from active drivers
 *   4. Explanation schema is structurally complete (all 4 fields present)
 *   5. Explanation content varies correctly across risk levels
 *
 * Usage: pnpm test:explainability
 */

import { assessRisk } from "../src/lib/risk";
import { buildExplanation } from "../src/lib/risk";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];
let failures = 0;

// ─── Helpers ───────────────────────────────────────────────────────────────

function pass(name: string, message: string): void {
  results.push({ name, passed: true, message });
}

function fail(name: string, message: string): void {
  results.push({ name, passed: false, message });
  failures++;
}

function assert(condition: boolean, name: string, onFail: string): void {
  if (condition) {
    pass(name, "OK");
  } else {
    fail(name, onFail);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

const BASE_INPUTS = {
  compressionDelta: 0,
  tokenStrategy: "exact" as const,
  inputPricePer1M: 2.5,
  outputPricePer1M: 10.0,
};

const FIXTURES = [
  {
    name: "minimal-safe",
    input: {
      promptText: "### Instructions\nList 3 items.\n- item one\n- item two\n- item three\nFormat: JSON. Max 50 words.",
      inputTokens: 30,
      contextWindow: 128_000,
      expectedOutputTokens: 50,
      maxOutputTokens: 4096,
    },
  },
  {
    name: "high-ambiguity",
    input: {
      promptText: "Write a comprehensive, in depth analysis. Make it better, more efficient, and high quality. Optimize everything. Be flexible and advanced.",
      inputTokens: 40,
      contextWindow: 16_385,
      expectedOutputTokens: 512,
      maxOutputTokens: 4096,
    },
  },
  {
    name: "context-saturation",
    input: {
      promptText: "Summarize this document.",
      inputTokens: 12_000,
      contextWindow: 16_385,
      expectedOutputTokens: 4000,
      maxOutputTokens: 4096,
    },
  },
  {
    name: "structural-missing",
    input: {
      promptText: "explain machine learning to me, I want to understand how it works with some examples",
      inputTokens: 20,
      contextWindow: 128_000,
      expectedOutputTokens: 512,
      maxOutputTokens: 4096,
    },
  },
  {
    name: "volatility-spike",
    input: {
      promptText: "Write a detailed, comprehensive guide. Include as much as possible. Thoroughly explain all aspects.",
      inputTokens: 25,
      contextWindow: 128_000,
      expectedOutputTokens: 8000,
      maxOutputTokens: 16384,
    },
  },
];

// ─── Tests ─────────────────────────────────────────────────────────────────

console.log("");
console.log("CostGuardAI — Explainability Determinism Test");
console.log("─".repeat(60));

// TEST 1: Schema completeness — explanation has all required fields
for (const fixture of FIXTURES) {
  const assessment = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  const ex = assessment.explanation;

  assert(
    typeof ex === "object" && ex !== null,
    `[${fixture.name}] explanation is an object`,
    `explanation is ${typeof ex}`
  );
  assert(
    typeof ex.summary === "string" && ex.summary.length > 0,
    `[${fixture.name}] explanation.summary is a non-empty string`,
    `summary is '${ex.summary}'`
  );
  assert(
    Array.isArray(ex.top_risk_drivers),
    `[${fixture.name}] explanation.top_risk_drivers is an array`,
    "top_risk_drivers is not an array"
  );
  assert(
    Array.isArray(ex.contributing_factors),
    `[${fixture.name}] explanation.contributing_factors is an array`,
    "contributing_factors is not an array"
  );
  assert(
    Array.isArray(ex.mitigation_suggestions),
    `[${fixture.name}] explanation.mitigation_suggestions is an array`,
    "mitigation_suggestions is not an array"
  );
}

// TEST 2: Determinism — calling assessRisk twice with same inputs → identical explanation
for (const fixture of FIXTURES) {
  const a1 = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  const a2 = assessRisk({ ...BASE_INPUTS, ...fixture.input });

  assert(
    deepEqual(a1.explanation, a2.explanation),
    `[${fixture.name}] explanation is deterministic (assessRisk called twice)`,
    `explanations differ:\n  run1: ${JSON.stringify(a1.explanation)}\n  run2: ${JSON.stringify(a2.explanation)}`
  );
}

// TEST 3: buildExplanation determinism — same args → identical output
for (const fixture of FIXTURES) {
  const assessment = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  const e1 = buildExplanation(assessment.riskScore, assessment.riskLevel, assessment.riskDrivers);
  const e2 = buildExplanation(assessment.riskScore, assessment.riskLevel, assessment.riskDrivers);

  assert(
    deepEqual(e1, e2),
    `[${fixture.name}] buildExplanation is deterministic`,
    `buildExplanation outputs differ`
  );
}

// TEST 4: Driver ordering stability — same inputs → same driver order in explanation
for (const fixture of FIXTURES) {
  const a1 = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  const a2 = assessRisk({ ...BASE_INPUTS, ...fixture.input });

  assert(
    deepEqual(a1.explanation.top_risk_drivers, a2.explanation.top_risk_drivers),
    `[${fixture.name}] top_risk_drivers order is stable`,
    `driver order differed between calls`
  );
}

// TEST 5: top_risk_drivers names match riskDrivers names (only active ones, impact > 5)
for (const fixture of FIXTURES) {
  const assessment = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  const ex = assessment.explanation;

  const activeDriverNames = assessment.riskDrivers
    .filter((d) => d.impact > 5)
    .map((d) => d.name);

  assert(
    deepEqual(ex.top_risk_drivers, activeDriverNames),
    `[${fixture.name}] top_risk_drivers matches active riskDrivers`,
    `expected: ${JSON.stringify(activeDriverNames)}, got: ${JSON.stringify(ex.top_risk_drivers)}`
  );
}

// TEST 6: summary encodes correct score and band
for (const fixture of FIXTURES) {
  const assessment = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  const ex = assessment.explanation;
  const scoreStr = String(assessment.riskScore);
  const bands: Record<string, string> = { safe: "Safe", low: "Low", warning: "Warning", high: "High", critical: "Critical" };
  const bandLabel = bands[assessment.riskLevel] ?? assessment.riskLevel;

  assert(
    ex.summary.includes(scoreStr) && ex.summary.includes(bandLabel),
    `[${fixture.name}] summary contains score (${scoreStr}) and band (${bandLabel})`,
    `summary is: '${ex.summary}'`
  );
}

// TEST 7: mitigation_suggestions non-empty when riskScore > 10
for (const fixture of FIXTURES) {
  const assessment = assessRisk({ ...BASE_INPUTS, ...fixture.input });
  if (assessment.riskScore <= 10) continue;
  const ex = assessment.explanation;

  assert(
    ex.mitigation_suggestions.length > 0,
    `[${fixture.name}] mitigation_suggestions non-empty when riskScore=${assessment.riskScore}`,
    "mitigation_suggestions is empty"
  );
}

// TEST 8: Explanation varies across different risk profiles
const safe = assessRisk({
  ...BASE_INPUTS,
  promptText: "### Task\nList 3 items.\n- a\n- b\n- c\nFormat: JSON. Max 20 words.",
  inputTokens: 20,
  contextWindow: 128_000,
  expectedOutputTokens: 50,
  maxOutputTokens: 4096,
});
const risky = assessRisk({
  ...BASE_INPUTS,
  promptText: "Write a comprehensive, in depth analysis. As much as possible. Thoroughly explain everything.",
  inputTokens: 30,
  contextWindow: 128_000,
  expectedOutputTokens: 8000,
  maxOutputTokens: 16384,
});
assert(
  !deepEqual(safe.explanation, risky.explanation),
  "explanation varies between safe and risky prompts",
  "safe and risky prompts produced identical explanations"
);

// TEST 9: Summary for safe prompt references no risk drivers (or says "No significant")
assert(
  safe.explanation.top_risk_drivers.length === 0 ||
  safe.explanation.summary.includes("No significant") ||
  safe.explanation.summary.includes("Safe"),
  "safe prompt explanation summary is appropriate",
  `got: '${safe.explanation.summary}'`
);

// TEST 10: buildExplanation called directly with explicit driver list
const manualDrivers = [
  { name: "Structural Risk", impact: 80, fixes: ["Add output format instructions."] },
  { name: "Ambiguity Risk", impact: 45, fixes: ["Replace vague terms with specifics."] },
  { name: "Length Risk", impact: 5, fixes: [] },
];
const e1 = buildExplanation(62, "warning", manualDrivers);
const e2 = buildExplanation(62, "warning", manualDrivers);
assert(
  deepEqual(e1, e2),
  "buildExplanation deterministic with explicit driver list",
  "outputs differ"
);
assert(
  e1.top_risk_drivers[0] === "Structural Risk" && e1.top_risk_drivers[1] === "Ambiguity Risk",
  "buildExplanation preserves driver order from input",
  `got: ${JSON.stringify(e1.top_risk_drivers)}`
);
assert(
  e1.mitigation_suggestions.includes("Add output format instructions."),
  "buildExplanation includes dynamic engine fix in mitigation_suggestions",
  `mitigations: ${JSON.stringify(e1.mitigation_suggestions)}`
);

// ─── Print results ──────────────────────────────────────────────────────────

console.log("");
for (const r of results) {
  const status = r.passed ? "PASS" : "FAIL ***";
  console.log(`${status.padEnd(8)} ${r.name}`);
  if (!r.passed) {
    console.log(`         ${r.message}`);
  }
}

console.log("");
console.log("─".repeat(60));
console.log(`Tests: ${results.length}  Pass: ${results.filter(r => r.passed).length}  Fail: ${failures}`);
console.log("");

if (failures > 0) {
  console.log(`FAIL: ${failures} test(s) failed.`);
  console.log("");
  process.exit(1);
}

console.log("PASS: All explainability determinism tests passed.");
console.log("");
