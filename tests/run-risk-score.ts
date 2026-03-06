/**
 * CostGuardAI — RiskScore Drift Harness
 *
 * Usage: pnpm test:risk-score
 *
 * Loads all fixtures from fixtures/risk-score/*.json
 * Runs assessRisk() against each fixture's input
 * Fails if produced score is outside fixture's expected score_range
 * Tolerance: ±5 points beyond the range bounds before FAIL
 *
 * To add new golden cases: create a new .json file in fixtures/risk-score/
 * See docs/risk-score-spec.md for the fixture format and scoring rules.
 */

import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import from core via web shim (avoids @/ alias, consistent with other test files)
import { assessRisk, SCORE_VERSION } from "../src/lib/risk";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FixtureInput {
  prompt: string;
  inputTokens: number;
  contextWindow: number;
  expectedOutputTokens: number;
  maxOutputTokens: number;
}

interface FixtureExpected {
  score_range: [number, number];
  risk_band: string;
  top_risk_drivers: string[];
}

interface Fixture {
  name: string;
  description: string;
  input: FixtureInput;
  expected: FixtureExpected;
  notes?: string;
}

interface Result {
  name: string;
  passed: boolean;
  score: number;
  range: [number, number];
  band: string;
  expectedBand: string;
  driverMatch: boolean;
  producedDrivers: string[];
  expectedDrivers: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOLERANCE = 5; // ±5 points beyond range bounds = FAIL
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/risk-score");

// ─── Load fixtures ───────────────────────────────────────────────────────────

function loadFixtures(): Fixture[] {
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.error(`ERROR: No fixture files found in ${FIXTURES_DIR}`);
    process.exit(1);
  }

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf8");
    return JSON.parse(raw) as Fixture;
  });
}

// ─── Run harness ─────────────────────────────────────────────────────────────

function run(): void {
  const fixtures = loadFixtures();
  const results: Result[] = [];

  for (const fixture of fixtures) {
    const { input, expected, name } = fixture;

    const assessment = assessRisk({
      promptText: input.prompt,
      inputTokens: input.inputTokens,
      contextWindow: input.contextWindow,
      expectedOutputTokens: input.expectedOutputTokens,
      maxOutputTokens: input.maxOutputTokens,
      compressionDelta: 0,
      tokenStrategy: "exact",
      inputPricePer1M: 2.5,
      outputPricePer1M: 10.0,
    });

    const score = assessment.riskScore;
    const [lo, hi] = expected.score_range;

    // Score must be within [lo - TOLERANCE, hi + TOLERANCE] to pass
    const passed = score >= lo - TOLERANCE && score <= hi + TOLERANCE;

    const producedDrivers = assessment.riskDrivers.map((d) => d.name);
    const driverMatch =
      producedDrivers.length === expected.top_risk_drivers.length &&
      producedDrivers.every((d, i) => d === expected.top_risk_drivers[i]);

    results.push({
      name,
      passed,
      score,
      range: expected.score_range,
      band: assessment.riskLevel,
      expectedBand: expected.risk_band,
      driverMatch,
      producedDrivers,
      expectedDrivers: expected.top_risk_drivers,
    });
  }

  // ─── Print results ───────────────────────────────────────────────────────

  const width = Math.max(...results.map((r) => r.name.length));

  console.log("");
  console.log(`CostGuardAI — RiskScore Drift Harness`);
  console.log(`score_version: ${SCORE_VERSION}  tolerance: ±${TOLERANCE} pts`);
  console.log(`${"─".repeat(72)}`);
  console.log(
    `${"STATUS".padEnd(8)} ${"CASE".padEnd(width + 2)} ${"SCORE".padStart(5)} ${"RANGE".padStart(10)} ${"BAND".padStart(8)} ${"DRIVERS"}`
  );
  console.log(`${"─".repeat(72)}`);

  for (const r of results) {
    const status = r.passed ? "PASS   " : "FAIL ***";
    const rangeStr = `[${r.range[0]},${r.range[1]}]`;
    const driverStatus = r.driverMatch ? "✓" : "✗";
    console.log(
      `${status} ${r.name.padEnd(width + 2)} ${String(r.score).padStart(5)} ${rangeStr.padStart(10)} ${r.band.padStart(8)} ${driverStatus}`
    );

    if (!r.passed) {
      console.log(
        `         Expected range: [${r.range[0]}–${r.range[1]}]  Got: ${r.score}  Drift: ${
          r.score < r.range[0] ? r.range[0] - r.score : r.score - r.range[1]
        } pts outside tolerance`
      );
    }
    if (!r.driverMatch) {
      console.log(`         Expected drivers: ${r.expectedDrivers.join(", ")}`);
      console.log(`         Produced drivers: ${r.producedDrivers.join(", ")}`);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const driverFails = results.filter((r) => !r.driverMatch).length;

  console.log(`${"─".repeat(72)}`);
  console.log(`Fixtures: ${results.length}  Pass: ${passed}  Fail: ${failed}  Driver mismatches: ${driverFails}`);

  if (failed > 0) {
    console.log("");
    console.log(
      `FAIL: ${failed} fixture(s) drifted beyond ±${TOLERANCE} pts.`
    );
    console.log(
      `If drift is intentional, bump score_version and update expected ranges.`
    );
    console.log("");
    process.exit(1);
  }

  if (driverFails > 0) {
    console.log("");
    console.log(`WARNING: ${driverFails} fixture(s) have driver order mismatches (scores passed).`);
    console.log(`Update expected.top_risk_drivers in affected fixtures if this is expected.`);
    console.log("");
  }

  console.log("");
  console.log(`PASS: All ${results.length} fixtures within tolerance.`);
  console.log("");
}

run();
