/**
 * CostGuardAI — Benchmark Runner
 *
 * Validates that the risk scoring engine produces stable results against
 * a canonical set of anonymized structural fixtures.
 *
 * Usage: pnpm benchmark
 *
 * Exit codes:
 *   0 — all benchmarks passed
 *   1 — one or more benchmarks drifted outside expected range
 *   2 — runtime error
 */

import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, "artifacts", "benchmarks");

// Relative imports — avoids @/ path alias issues in tsx entry-point
import { countTokens } from "../src/lib/tokenizer";
import { assessRisk } from "../src/lib/risk";
import { MODEL_CATALOG } from "../src/lib/ai/models";
import { ANALYSIS_VERSION } from "../src/lib/trust";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExampleFixture {
  title: string;
  structure_summary: string;
  verification_prompt: string;
  expected_score: string;
  explanation?: string;
  mitigations?: string[];
}

interface ExampleResult {
  title: string;
  passed: boolean;
  safetyScore: number;
  expectedScore: number;
  tolerance: number;
  drift?: string;
}

interface BenchmarkFixture {
  id: string;
  description: string;
  risk_type: string;
  prompt: string;
  model: string;
  expected_output_tokens: number;
  expected_risk_score_range: [number, number];
  expected_safety_score_range: [number, number];
  notes?: string;
}

interface BenchmarkResult {
  id: string;
  passed: boolean;
  riskScore: number;
  safetyScore: number;
  expectedRiskRange: [number, number];
  expectedSafetyRange: [number, number];
  riskLevel: string;
  topDriver: string;
  drift?: string;
}

interface BenchmarkSummary {
  analysis_version: string;
  timestamp: string;
  pass_rate: number;
  fixture_count: number;
  fixture_results: BenchmarkResult[];
  score_band_distribution: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreBand(safetyScore: number): string {
  if (safetyScore >= 85) return "Safe";
  if (safetyScore >= 70) return "Low";
  if (safetyScore >= 40) return "Warning";
  return "High";
}

function persistSummary(results: BenchmarkResult[]): void {
  try {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const passed = results.filter((r) => r.passed).length;
    const bandDist: Record<string, number> = {
      Safe: 0,
      Low: 0,
      Warning: 0,
      High: 0,
    };
    for (const r of results) {
      if (r.safetyScore >= 0) {
        const band = scoreBand(r.safetyScore);
        bandDist[band] = (bandDist[band] ?? 0) + 1;
      }
    }
    const summary: BenchmarkSummary = {
      analysis_version: ANALYSIS_VERSION,
      timestamp: new Date().toISOString(),
      pass_rate: results.length > 0 ? passed / results.length : 0,
      fixture_count: results.length,
      fixture_results: results,
      score_band_distribution: bandDist,
    };
    const outPath = path.join(ARTIFACTS_DIR, `${ANALYSIS_VERSION}-summary.json`);
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf-8");
    console.log(`\nBenchmark summary persisted → ${outPath}`);
  } catch (err) {
    console.warn("Failed to persist benchmark summary:", err);
  }
}

const EXAMPLE_TOLERANCE = 10;
const EXAMPLE_DEFAULT_MODEL = "gpt-4o";

const REQUIRED_EXAMPLE_FIELDS = [
  "title",
  "structure_summary",
  "verification_prompt",
  "expected_score",
  "explanation",
  "mitigations",
] as const;

function loadExamples(): ExampleFixture[] {
  const examplesDir = path.join(PROJECT_ROOT, "content", "examples");
  const files = fs.readdirSync(examplesDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(examplesDir, f), "utf-8");
    const fixture = JSON.parse(raw) as Record<string, unknown>;
    // Validate required fields
    const missing = REQUIRED_EXAMPLE_FIELDS.filter((field) => !(field in fixture) || fixture[field] === undefined);
    if (missing.length > 0) {
      throw new Error(`Example fixture '${f}' is missing required fields: ${missing.join(", ")}`);
    }
    return fixture as unknown as ExampleFixture;
  });
}

function runExampleVerification(): boolean {
  console.log("\nCostGuardAI — Example Score Verification");
  console.log("─".repeat(60));

  let examples: ExampleFixture[];
  try {
    examples = loadExamples();
  } catch (err) {
    console.error("Failed to load example fixtures:", err);
    return false;
  }

  if (examples.length === 0) {
    console.error("No example fixtures found in content/examples/");
    return false;
  }

  const model = resolveModelConfig(EXAMPLE_DEFAULT_MODEL);
  const results: ExampleResult[] = [];

  console.log(`\nVerifying ${examples.length} example(s) against engine (tolerance ±${EXAMPLE_TOLERANCE})...\n`);

  for (const example of examples) {
    try {
      const verifyText = example.verification_prompt;
      const inputTokens = countTokens(verifyText, model);
      const assessment = assessRisk({
        promptText: verifyText,
        inputTokens,
        contextWindow: model.contextWindow,
        expectedOutputTokens: 256,
        maxOutputTokens: model.maxOutputTokens,
        compressionDelta: 0,
        tokenStrategy: model.tokenStrategy,
        inputPricePer1M: model.inputPricePer1M,
        outputPricePer1M: model.outputPricePer1M,
      });

      const safetyScore = 100 - assessment.riskScore;
      const expectedScore = parseInt(example.expected_score, 10);
      const passed = Math.abs(safetyScore - expectedScore) <= EXAMPLE_TOLERANCE;
      const drift = passed
        ? undefined
        : `safety_score=${safetyScore} vs expected=${expectedScore} (diff=${Math.abs(safetyScore - expectedScore)}, tolerance=±${EXAMPLE_TOLERANCE})`;

      results.push({ title: example.title, passed, safetyScore, expectedScore, tolerance: EXAMPLE_TOLERANCE, drift });

      const icon = passed ? "PASS" : "FAIL";
      console.log(`  [${icon}] ${example.title}`);
      console.log(`         safety_score=${safetyScore}  expected=${expectedScore}  diff=${Math.abs(safetyScore - expectedScore)}`);
      if (drift) console.log(`         DRIFT: ${drift}`);
      console.log();
    } catch (err) {
      console.error(`  [ERROR] ${example.title}: ${err}`);
      results.push({
        title: example.title,
        passed: false,
        safetyScore: -1,
        expectedScore: parseInt(example.expected_score, 10),
        tolerance: EXAMPLE_TOLERANCE,
        drift: `Runtime error: ${err}`,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("─".repeat(60));
  console.log(`\nExample verification: ${passed}/${results.length} passed`);

  if (failed > 0) {
    console.log("\nFailed examples (score drift detected):");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.title}: ${r.drift}`));
    console.log(
      "\nScore drift indicates the engine or example documentation is out of sync."
    );
    console.log("Update content/examples/ expected_score or review scoring logic.\n");
    return false;
  }

  console.log("\nAll example scores verified. Documentation is consistent with the engine.\n");
  return true;
}

function loadFixtures(): BenchmarkFixture[] {
  const benchmarkDir = path.join(PROJECT_ROOT, "fixtures", "benchmarks");
  const files = fs.readdirSync(benchmarkDir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(benchmarkDir, f), "utf-8");
    return JSON.parse(raw) as BenchmarkFixture;
  });
}

function resolveModelConfig(modelId: string) {
  const m = MODEL_CATALOG.find((m) => m.id === modelId);
  if (!m) throw new Error(`Unknown model: ${modelId}`);
  return m;
}

function runFixture(fixture: BenchmarkFixture): BenchmarkResult {
  const model = resolveModelConfig(fixture.model);
  const inputTokens = countTokens(fixture.prompt, model);

  const assessment = assessRisk({
    promptText: fixture.prompt,
    inputTokens,
    contextWindow: model.contextWindow,
    expectedOutputTokens: fixture.expected_output_tokens,
    maxOutputTokens: model.maxOutputTokens,
    compressionDelta: 0,
    tokenStrategy: model.tokenStrategy,
    inputPricePer1M: model.inputPricePer1M,
    outputPricePer1M: model.outputPricePer1M,
  });

  const { riskScore, riskLevel, riskDrivers } = assessment;
  const safetyScore = 100 - riskScore;
  const [rMin, rMax] = fixture.expected_risk_score_range;

  const passed = riskScore >= rMin && riskScore <= rMax;
  const topDriver = riskDrivers[0]?.name ?? "none";

  const drift = passed
    ? undefined
    : `risk_score=${riskScore} outside expected [${rMin}, ${rMax}]`;

  return {
    id: fixture.id,
    passed,
    riskScore,
    safetyScore,
    expectedRiskRange: fixture.expected_risk_score_range,
    expectedSafetyRange: fixture.expected_safety_score_range,
    riskLevel,
    topDriver,
    drift,
  };
}

function renderResult(r: BenchmarkResult): void {
  const icon = r.passed ? "PASS" : "FAIL";
  const riskColor = r.passed ? "" : " [DRIFT]";
  console.log(`  [${icon}] ${r.id}${riskColor}`);
  console.log(
    `         risk_score=${r.riskScore}  safety_score=${r.safetyScore}` +
      `  level=${r.riskLevel}  top_driver="${r.topDriver}"`
  );
  console.log(
    `         expected_risk=[${r.expectedRiskRange[0]}, ${r.expectedRiskRange[1]}]`
  );
  if (r.drift) {
    console.log(`         DRIFT: ${r.drift}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const verifyExamples = process.argv.includes("--verify-examples");

  if (verifyExamples) {
    const ok = runExampleVerification();
    process.exit(ok ? 0 : 1);
  }

  console.log("\nCostGuardAI — Benchmark Suite");
  console.log("─".repeat(60));

  let fixtures: BenchmarkFixture[];
  try {
    fixtures = loadFixtures();
  } catch (err) {
    console.error("Failed to load benchmark fixtures:", err);
    process.exit(2);
  }

  if (fixtures.length === 0) {
    console.error("No benchmark fixtures found in fixtures/benchmarks/");
    process.exit(2);
  }

  console.log(`\nRunning ${fixtures.length} benchmark(s)...\n`);

  const results: BenchmarkResult[] = [];

  for (const fixture of fixtures) {
    try {
      const result = runFixture(fixture);
      results.push(result);
      renderResult(result);
      console.log();
    } catch (err) {
      console.error(`  [ERROR] ${fixture.id}: ${err}`);
      results.push({
        id: fixture.id,
        passed: false,
        riskScore: -1,
        safetyScore: -1,
        expectedRiskRange: fixture.expected_risk_score_range,
        expectedSafetyRange: fixture.expected_safety_score_range,
        riskLevel: "error",
        topDriver: "error",
        drift: `Runtime error: ${err}`,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("─".repeat(60));
  console.log(`\nResults: ${passed}/${results.length} passed`);

  persistSummary(results);

  if (failed > 0) {
    console.log(`\nFailed fixtures (score drift detected):`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.id}: ${r.drift}`);
      });
    console.log(
      "\nScore drift indicates the scoring engine has changed behavior."
    );
    console.log(
      "If intentional, update fixtures/benchmarks/*.json expected ranges."
    );
    console.log();
    process.exit(1);
  }

  console.log("\nAll benchmarks passed. Scoring engine is stable.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Benchmark runner crashed:", err);
  process.exit(2);
});
