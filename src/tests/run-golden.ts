import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

import { countTokens } from "../src/lib/tokenizer";
import { compressPrompt } from "../src/lib/compressor";
import { assessRisk } from "../src/lib/risk";
import { MODELS, DEFAULT_EXPECTED_OUTPUT } from "../src/config/models";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "golden-baseline.json");
const PROMPTS_PATH = path.join(__dirname, "golden-prompts.json");

function percentDiff(a: number, b: number) {
  if (b === 0) return a === 0 ? 0 : 100;
  return Math.abs(a - b) / Math.abs(b) * 100;
}

function runPreflight() {
  try {
    execSync("pnpm build", { cwd: ROOT, stdio: "pipe" });
    execSync("pnpm lint", { cwd: ROOT, stdio: "pipe" });
    execSync("pnpm tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
  } catch (err: any) {
    console.error("Preflight failed:\n", err.stderr?.toString() || err);
    process.exit(1);
  }
}

function main() {
  runPreflight();

  const prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, "utf8")).prompts;

  const results: Record<string, any> = {};

  for (const prompt of prompts) {
    for (const model of MODELS) {
      const inputTokens = countTokens(prompt.text, model);
      const { compressed } = compressPrompt(prompt.text);
      const compressedTokens = countTokens(compressed, model);

      const compressionDelta =
        inputTokens > 0
          ? Math.max(0, (1 - compressedTokens / inputTokens) * 100)
          : 0;

      const compressionActive = compressionDelta > 5;

      const assessment = assessRisk({
        inputTokens,
        contextWindow: model.contextWindow,
        expectedOutputTokens: DEFAULT_EXPECTED_OUTPUT,
        maxOutputTokens: model.maxOutputTokens,
        compressionDelta,
        tokenStrategy: model.tokenStrategy,
        inputPricePer1M: model.inputPricePer1M,
        outputPricePer1M: model.outputPricePer1M
      });

      const key = `${prompt.id}|${model.id}`;

      results[key] = {
        inputTokens,
        outputTokens: DEFAULT_EXPECTED_OUTPUT,
        estimatedCostTotal: assessment.estimatedCostTotal,
        riskScore: assessment.riskScore,
        compressionActive
      };
    }
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          results
        },
        null,
        2
      )
    );
    console.log("BASELINE_CREATED");
    process.exit(0);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).results;

  let hasFail = false;

  for (const key of Object.keys(results)) {
    const current = results[key];
    const base = baseline[key];

    if (!base) {
      console.error(`Missing baseline entry: ${key}`);
      hasFail = true;
      continue;
    }

    const tokenVar = percentDiff(current.inputTokens, base.inputTokens);
    const costVar = percentDiff(
      current.estimatedCostTotal,
      base.estimatedCostTotal
    );
    const riskVar = percentDiff(current.riskScore, base.riskScore);

    if (
      tokenVar > 3 ||
      costVar > 3 ||
      riskVar > 5 ||
      current.compressionActive !== base.compressionActive
    ) {
      console.error(
        `FAIL ${key} | tokenΔ=${tokenVar.toFixed(
          2
        )}% costΔ=${costVar.toFixed(2)}% riskΔ=${riskVar.toFixed(2)}%`
      );
      hasFail = true;
    }
  }

  if (hasFail) {
    process.exit(1);
  }

  console.log("All golden checks PASS");
  process.exit(0);
}

main();
