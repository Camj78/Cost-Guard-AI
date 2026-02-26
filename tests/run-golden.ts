/**
 * CostGuardAI — Golden Prompt Regression Harness
 *
 * Usage: pnpm golden
 *
 * Step 1: Pre-flight — build, lint, typecheck (abort on failure)
 * Step 2: Load tests/golden-prompts.json
 * Step 3: Run analysis for each prompt × model (4 × 6 = 24 cells)
 * Step 4: Baseline logic:
 *   - No baseline → write tests/golden-baseline.json → exit(0)
 *   - Baseline exists → compare → report → exit(0|1)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

// Resolve __dirname in ESM contexts (tsx may run as ESM depending on package.json "type")
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Relative imports — avoids @/ path alias resolution issues in tsx entry-point
import { countTokens } from "../src/lib/tokenizer";
import { compressPrompt } from "../src/lib/compressor";
import { assessRisk, type RiskInputs } from "../src/lib/risk";
import { MODELS, DEFAULT_EXPECTED_OUTPUT } from "../src/config/models";

// ─── Paths ─────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PROMPTS_PATH = path.join(__dirname, "golden-prompts.json");
const BASELINE_PATH = path.join(__dirname, "golden-baseline.json");

// ─── Types ──────────────────────────────────────────────────────────────────

interface GoldenPrompt {
  id: string;
  text: string;
  expectedRiskRange: [number, number];
  compressionExpected: boolean;
  truncationExpected: "safe" | "warning" | "danger";
}

interface GoldenPromptsFile {
  version: number;
  prompts: GoldenPrompt[];
}

interface ResultRecord {
  inputTokens: number;
  outputTokens: number;
  estimatedCostTotal: number;
  riskScore: number;
  compressionActive: boolean;
}

interface Baseline {
  createdAt: string;
  gitCommit: string;
  gitBranch: string;
  results: Record<string, ResultRecord>;
}

interface CellResult {
  promptId: string;
  modelId: string;
  record: ResultRecord;
  truncationLevel: "safe" | "warning" | "danger";
  status: "BASELINE_CREATED" | "PASS" | "FAIL";
  failReasons: string[];
  warns: string[];
  deltas?: {
    token: number;
    cost: number;
    risk: number;
    compressionFlipped: boolean;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOKEN_THRESHOLD = 3;   // percent
const COST_THRESHOLD  = 3;   // percent
const RISK_THRESHOLD  = 5;   // percent
const EPS             = 1e-9; // avoid divide-by-zero in percentDiff

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentDiff(current: number, baseline: number): number {
  const denom = Math.max(Math.abs(baseline), EPS);
  return (Math.abs(current - baseline) / denom) * 100;
}

function getGitInfo(): { commit: string; branch: string } {
  try {
    const commit = execSync("git rev-parse --short HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();
    const branch = execSync("git branch --show-current", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();
    return { commit, branch };
  } catch {
    return { commit: "unknown", branch: "unknown" };
  }
}

function formatCost(amount: number): string {
  if (amount === 0) return "$0.000000";
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1)    return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

// ─── Step 1: Pre-flight ──────────────────────────────────────────────────────

function runPreflight(): Record<string, "PASS" | "FAIL"> {
  const checks: Record<string, "PASS" | "FAIL"> = {
    build: "PASS",
    lint: "PASS",
    typecheck: "PASS",
  };

  const steps = [
    { key: "build",     cmd: "pnpm build",         label: "Build"     },
    { key: "lint",      cmd: "pnpm lint",           label: "Lint"      },
    { key: "typecheck", cmd: "pnpm tsc --noEmit",   label: "TypeCheck" },
  ] as const;

  for (const step of steps) {
    try {
      execSync(step.cmd, {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (err: unknown) {
      checks[step.key] = "FAIL";
      const e = err as { stderr?: string; stdout?: string };
      console.error(`\n${step.label} FAILED:`);
      if (e.stderr) console.error(e.stderr);
      if (e.stdout) console.error(e.stdout);
    }
  }

  return checks;
}

// ─── Step 3: Core analysis per cell ──────────────────────────────────────────

function analyzeCell(
  text: string,
  model: (typeof MODELS)[0]
): ResultRecord & { truncationLevel: "safe" | "warning" | "danger" } {
  const inputTokens = countTokens(text, model);

  const { compressed } = compressPrompt(text);
  const compressedTokens = countTokens(compressed, model);

  const compressionDelta =
    inputTokens > 0
      ? Math.max(0, (1 - compressedTokens / inputTokens) * 100)
      : 0;

  const riskInputs: RiskInputs = {
    promptText: text,
    inputTokens,
    contextWindow: model.contextWindow,
    expectedOutputTokens: DEFAULT_EXPECTED_OUTPUT,
    maxOutputTokens: model.maxOutputTokens,
    compressionDelta,
    tokenStrategy: model.tokenStrategy,
    inputPricePer1M: model.inputPricePer1M,
    outputPricePer1M: model.outputPricePer1M,
  };

  const assessment = assessRisk(riskInputs);

  return {
    inputTokens,
    outputTokens: DEFAULT_EXPECTED_OUTPUT,
    estimatedCostTotal: assessment.estimatedCostTotal,
    riskScore: assessment.riskScore,
    compressionActive: compressionDelta > 5,
    truncationLevel: assessment.truncation.level,
  };
}

// ─── Step 4: Compare vs baseline ─────────────────────────────────────────────

function compareCell(
  key: string,
  current: ResultRecord,
  baseline: Baseline
): {
  failReasons: string[];
  deltas: CellResult["deltas"];
} {
  const base = baseline.results[key];

  if (!base) {
    return {
      failReasons: [`No baseline entry for "${key}"`],
      deltas: undefined,
    };
  }

  const tokenDelta = percentDiff(current.inputTokens, base.inputTokens);
  const costDelta   = percentDiff(current.estimatedCostTotal, base.estimatedCostTotal);
  const riskDelta   = percentDiff(current.riskScore, base.riskScore);
  const compressionFlipped = current.compressionActive !== base.compressionActive;

  const failReasons: string[] = [];

  if (tokenDelta > TOKEN_THRESHOLD) {
    failReasons.push(`token_variance ${tokenDelta.toFixed(1)}% > ${TOKEN_THRESHOLD}%`);
  }
  if (costDelta > COST_THRESHOLD) {
    failReasons.push(`cost_variance ${costDelta.toFixed(1)}% > ${COST_THRESHOLD}%`);
  }
  if (riskDelta > RISK_THRESHOLD) {
    failReasons.push(`risk_variance ${riskDelta.toFixed(1)}% > ${RISK_THRESHOLD}%`);
  }
  if (compressionFlipped) {
    failReasons.push(
      `compression state changed: baseline=${base.compressionActive} current=${current.compressionActive}`
    );
  }

  return {
    failReasons,
    deltas: { token: tokenDelta, cost: costDelta, risk: riskDelta, compressionFlipped },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const git = getGitInfo();

  console.log("CostGuardAI — Golden Prompt Verification");
  console.log("========================================");
  console.log(`Git: ${git.branch} @ ${git.commit}`);

  // ── Step 1: Pre-flight ──
  console.log("\nRunning pre-flight checks...");
  const checks = runPreflight();
  console.log(
    `Build: ${checks.build} | Lint: ${checks.lint} | TypeCheck: ${checks.typecheck}`
  );

  if (checks.build === "FAIL" || checks.lint === "FAIL" || checks.typecheck === "FAIL") {
    console.error("\nPre-flight checks failed. Aborting.");
    process.exit(1);
  }

  // ── Step 2: Load prompts ──
  const promptsFile: GoldenPromptsFile = JSON.parse(
    fs.readFileSync(PROMPTS_PATH, "utf8")
  );
  const prompts = promptsFile.prompts;
  console.log(`\nLoaded ${prompts.length} golden prompts × ${MODELS.length} models = ${prompts.length * MODELS.length} cells\n`);

  // ── Step 3: Load or create baseline ──
  const isBaselineRun = !fs.existsSync(BASELINE_PATH);
  let baseline: Baseline | null = null;

  if (!isBaselineRun) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as Baseline;
    console.log(
      `Baseline: ${baseline.gitBranch} @ ${baseline.gitCommit} (${baseline.createdAt})\n`
    );
  } else {
    console.log("No baseline found — this run will establish the baseline.\n");
  }

  // ── Step 4: Run all cells ──
  const cellResults: CellResult[] = [];
  const newBaselineResults: Record<string, ResultRecord> = {};

  for (const prompt of prompts) {
    for (const model of MODELS) {
      const key = `${prompt.id}|${model.id}`;
      const { truncationLevel, ...record } = analyzeCell(prompt.text, model);

      newBaselineResults[key] = record;

      // Qualitative warnings (advisory, not hard FAIL)
      const warns: string[] = [];
      const [minRisk, maxRisk] = prompt.expectedRiskRange;
      if (record.riskScore < minRisk || record.riskScore > maxRisk) {
        warns.push(
          `riskScore ${record.riskScore} outside expected range [${minRisk}, ${maxRisk}]`
        );
      }

      if (isBaselineRun) {
        // Hard FAIL if compressionExpected but not active (can be checked even on first run)
        const compressionFail =
          prompt.compressionExpected && !record.compressionActive;
        const failReasons: string[] = compressionFail
          ? ["compressionExpected: true but compressionActive: false"]
          : [];

        cellResults.push({
          promptId: prompt.id,
          modelId: model.id,
          record,
          truncationLevel,
          status: failReasons.length > 0 ? "FAIL" : "BASELINE_CREATED",
          failReasons,
          warns,
        });
      } else {
        const { failReasons: baselineFailReasons, deltas } = compareCell(
          key,
          record,
          baseline!
        );

        // Also check compressionExpected hard constraint
        const compressionFail =
          prompt.compressionExpected && !record.compressionActive;
        if (compressionFail) {
          baselineFailReasons.push(
            "compressionExpected: true but compressionActive: false"
          );
        }

        cellResults.push({
          promptId: prompt.id,
          modelId: model.id,
          record,
          truncationLevel,
          status: baselineFailReasons.length > 0 ? "FAIL" : "PASS",
          failReasons: baselineFailReasons,
          warns,
          deltas,
        });
      }
    }
  }

  // ── Write baseline on first run ──
  if (isBaselineRun) {
    const newBaseline: Baseline = {
      createdAt: new Date().toISOString(),
      gitCommit: git.commit,
      gitBranch: git.branch,
      results: newBaselineResults,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2), "utf8");
  }

  // ── Print results ──
  for (const r of cellResults) {
    console.log(`Prompt: "${r.promptId}" | Model: ${r.modelId}`);
    console.log(
      `  Tokens: ${r.record.inputTokens} | ` +
      `Cost: ${formatCost(r.record.estimatedCostTotal)} | ` +
      `Risk: ${r.record.riskScore} | ` +
      `Compression: ${r.record.compressionActive} | ` +
      `Truncation: ${r.truncationLevel}`
    );

    if (r.status === "BASELINE_CREATED") {
      console.log(`  Status: BASELINE_CREATED`);
    } else if (r.status === "PASS") {
      const d = r.deltas!;
      console.log(
        `  Status: PASS` +
        ` (Δtoken: ${d.token.toFixed(1)}%,` +
        ` Δcost: ${d.cost.toFixed(1)}%,` +
        ` Δrisk: ${d.risk.toFixed(1)}%)`
      );
    } else {
      console.log(`  Status: FAIL`);
      for (const reason of r.failReasons) {
        console.log(`    - ${reason}`);
      }
      if (r.failReasons.some((f) => f.includes("token") || f.includes("compression"))) {
        console.log(`    Suspected file(s): src/lib/tokenizer.ts, src/lib/compressor.ts`);
      }
      if (r.failReasons.some((f) => f.includes("cost") || f.includes("risk"))) {
        console.log(`    Suspected file(s): src/lib/risk.ts, src/config/models.ts`);
      }
    }

    for (const w of r.warns) {
      console.log(`  [WARN] ${w}`);
    }

    console.log("");
  }

  // ── Summary ──
  const total   = cellResults.length;
  const failed  = cellResults.filter((r) => r.status === "FAIL").length;
  const passed  = total - failed;

  console.log("========================================");
  if (isBaselineRun) {
    const baselineCreated = cellResults.filter((r) => r.status === "BASELINE_CREATED").length;
    console.log(`SUMMARY: ${baselineCreated} BASELINE_CREATED | ${failed} FAIL`);
    if (failed === 0) {
      console.log("Baseline written to tests/golden-baseline.json");
      console.log("Safe to deploy: YES (baseline established)");
    } else {
      console.log("Safe to deploy: NO (fix failures before committing baseline)");
    }
  } else {
    console.log(`SUMMARY: ${passed}/${total} PASS | ${failed} FAIL`);
    console.log(`Safe to deploy: ${failed === 0 ? "YES" : "NO"}`);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
