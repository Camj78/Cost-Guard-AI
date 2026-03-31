import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { DEFAULT_MODEL, DEFAULT_EXPECTED_OUTPUT, resolveModel, type ModelConfig } from "../core/models";
import { assessRisk, AMBIGUOUS_TERMS, VOLATILITY_PHRASES, SCORING_WEIGHTS } from "../core/risk";
import { countTokens } from "../core/tokenizer";

// ── Ruleset identity ────────────────────────────────────────────────────────

export const SCORE_VERSION = "1";

const _RULESET_SEED = JSON.stringify({
  ambiguousTerms: [...AMBIGUOUS_TERMS].sort(),
  volatilityPhrases: [...VOLATILITY_PHRASES].sort(),
  weights: SCORING_WEIGHTS,
  scoreVersion: SCORE_VERSION,
});
export const RULESET_HASH = crypto
  .createHash("sha256")
  .update(_RULESET_SEED)
  .digest("hex")
  .slice(0, 16);

// ── Types ───────────────────────────────────────────────────────────────────

export interface CliConfig {
  model?: string;
  extensions?: string[];
  ignore?: string[];
  expectedOutputTokens?: number;
  threshold?: number;
}

export interface FileResult {
  file: string;
  input_hash: string;
  model_id: string;
  input_tokens: number;
  is_estimated: boolean;
  risk_score: number;        // internal: 0–100, higher = riskier (backward compat)
  safety_score: number;      // canonical: 0–100, higher = safer (= 100 − risk_score)
  risk_level: string;        // internal risk band (backward compat)
  safety_band: string;       // canonical safety band: Safe|Low|Warning|High
  context_usage_pct: number;
  estimated_cost_per_request: number;
  truncation: string;
  risk_drivers: Array<{ name: string; impact: number }>;
  score_version: string;
  ruleset_hash: string;
}

export interface AnalysisOutput {
  score_version: string;
  ruleset_hash: string;
  files: FileResult[];
  summary: {
    total_files: number;
    max_risk_score: number;      // internal (backward compat)
    max_risk_level: string;      // internal (backward compat)
    min_safety_score: number;    // canonical: lowest safety score across files
    above_threshold: boolean;
    threshold: number | null;
  };
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_EXTENSIONS = [".txt", ".md", ".prompt"];
const DEFAULT_IGNORE = [
  "node_modules", ".git", "dist", "build", ".next",
  "coverage", ".cache", ".turbo",
];

// ── Config loading ────────────────────────────────────────────────────────────

function loadConfig(configPath: string): CliConfig {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  targetPath: string | null;
  model: string | null;
  format: "text" | "md" | "json";
  threshold: number | null;
  configPath: string;
  extensions: string[] | null;
  expectedOutputTokens: number | null;
}

function parseArgs(args: string[]): ParsedArgs {
  let targetPath: string | null = null;
  let model: string | null = null;
  let format: "text" | "md" | "json" = "text";
  let threshold: number | null = null;
  let configPath = "costguard.config.json";
  let extensions: string[] | null = null;
  let expectedOutputTokens: number | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") {
      format = "json";
    } else if (a === "--format" && args[i + 1]) {
      const f = args[++i];
      if (f === "text" || f === "md" || f === "json") format = f;
    } else if (a.startsWith("--format=")) {
      const f = a.slice(9);
      if (f === "text" || f === "md" || f === "json") format = f;
    } else if ((a === "--model" || a === "-m") && args[i + 1]) {
      model = args[++i];
    } else if (a.startsWith("--model=")) {
      model = a.slice(8);
    } else if (a === "--threshold" && args[i + 1]) {
      threshold = parseInt(args[++i], 10);
    } else if (a.startsWith("--threshold=")) {
      threshold = parseInt(a.slice(12), 10);
    } else if (a === "--config" && args[i + 1]) {
      configPath = args[++i];
    } else if (a.startsWith("--config=")) {
      configPath = a.slice(9);
    } else if (a === "--ext" && args[i + 1]) {
      extensions = args[++i].split(",").map((e) => (e.startsWith(".") ? e : "." + e));
    } else if (a.startsWith("--ext=")) {
      extensions = a.slice(6).split(",").map((e) => (e.startsWith(".") ? e : "." + e));
    } else if (a === "--expected-output" && args[i + 1]) {
      expectedOutputTokens = parseInt(args[++i], 10);
    } else if (!a.startsWith("--") && !a.startsWith("-") && targetPath === null) {
      targetPath = a;
    }
  }

  return { targetPath, model, format, threshold, configPath, extensions, expectedOutputTokens };
}

// ── File walking ──────────────────────────────────────────────────────────────

function walkDir(dir: string, extensions: string[], ignoreList: string[]): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    // Stable lexicographic sort by name
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (ignoreList.some((p) => entry.name === p || entry.name === p + "/")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

// ── Safety band mapping ───────────────────────────────────────────────────────

/** Maps CostGuardAI Safety Score (0–100, higher = safer) to a band label. */
function getSafetyBand(safetyScore: number): string {
  if (safetyScore >= 85) return "Safe";
  if (safetyScore >= 70) return "Low";
  if (safetyScore >= 40) return "Warning";
  return "High";
}

// ── Per-file analysis ─────────────────────────────────────────────────────────

function fmtCostNum(n: number): number {
  return parseFloat(n >= 0.01 ? n.toFixed(2) : n.toFixed(4));
}

function analyzeFile(
  filePath: string,
  relativePath: string,
  model: ModelConfig,
  expectedOutputTokens: number,
): FileResult {
  const content = fs.readFileSync(filePath, "utf8");
  const inputHash = crypto.createHash("sha256").update(content).digest("hex");
  const inputTokens = countTokens(content, model);

  const assessment = assessRisk({
    promptText: content,
    inputTokens,
    contextWindow: model.contextWindow,
    expectedOutputTokens,
    maxOutputTokens: model.maxOutputTokens,
    compressionDelta: 0,
    tokenStrategy: model.tokenStrategy,
    inputPricePer1M: model.inputPricePer1M,
    outputPricePer1M: model.outputPricePer1M,
  });

  const riskScore = assessment.riskScore;
  const safetyScore = 100 - riskScore;
  const safetyBand = getSafetyBand(safetyScore);

  return {
    file: relativePath,
    input_hash: inputHash,
    model_id: model.id,
    input_tokens: assessment.inputTokens,
    is_estimated: assessment.isEstimated,
    risk_score: riskScore,
    safety_score: safetyScore,
    risk_level: assessment.riskLevel.toUpperCase(),
    safety_band: safetyBand,
    context_usage_pct: parseFloat(assessment.usagePercent.toFixed(1)),
    estimated_cost_per_request: fmtCostNum(assessment.estimatedCostTotal),
    truncation: assessment.truncation.level,
    risk_drivers: assessment.riskDrivers.map((d) => ({ name: d.name, impact: d.impact })),
    score_version: SCORE_VERSION,
    ruleset_hash: RULESET_HASH,
  };
}

// ── Output formatters ─────────────────────────────────────────────────────────

function fmtCostDisplay(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function statusLine(safetyScore: number): string {
  if (safetyScore < 50) return `❌ FAILED  (score: ${safetyScore})`;
  if (safetyScore <= 70) return `⚠️  WARNING  (score: ${safetyScore})`;
  return `✅ SAFE  (score: ${safetyScore})`;
}

function deriveCallouts(f: FileResult): string[] {
  const callouts: string[] = [];
  const names = f.risk_drivers.map((d) => d.name);
  const has = (n: string) => names.includes(n);

  if (has("Context Saturation Risk") || f.context_usage_pct > 60)
    callouts.push("token amplification risk detected from repeated context");
  if (has("Length Risk"))
    callouts.push("prompt length may scale cost non-linearly");
  if (has("Ambiguity Risk"))
    callouts.push("ambiguous instructions may increase output variance");
  if (has("Output Volatility Risk") && callouts.length < 3)
    callouts.push("high output volatility — response length unpredictable");

  return callouts.slice(0, 3);
}

function formatText(output: AnalysisOutput): string {
  const SEP = "─".repeat(56);
  const lines: string[] = ["CostGuardAI Preflight Analysis", SEP];

  for (const f of output.files) {
    lines.push(`  ${statusLine(f.safety_score)}`);
    lines.push("");
    lines.push(`  File:           ${f.file}`);
    lines.push(`  Model:          ${f.model_id}`);
    lines.push(`  Tokens:         ${f.input_tokens.toLocaleString()}`);
    lines.push(`  Cost/req:       ${fmtCostDisplay(f.estimated_cost_per_request)}`);
    lines.push(`  CostGuardAI Safety Score: ${f.safety_score} (${f.safety_band})`);
    lines.push(`  Context:        ${f.context_usage_pct}%`);
    lines.push(`  Truncation:     ${f.truncation}`);
    if (f.risk_drivers.length > 0) {
      lines.push("  Risk Drivers:");
      for (const d of f.risk_drivers) {
        lines.push(`    ${d.name.padEnd(28)} (${d.impact})`);
      }
    }
    const callouts = deriveCallouts(f);
    if (callouts.length > 0) {
      lines.push("");
      lines.push("  Risk Notes:");
      for (const c of callouts) lines.push(`    • ${c}`);
    }
    if (f.safety_score < 60) {
      lines.push("");
      lines.push("  ⚠️  this prompt is likely to increase token usage significantly in production");
    }
    lines.push(SEP);
  }

  const s = output.summary;
  const thresholdSafety =
    s.threshold !== null ? Math.max(0, Math.min(100, 100 - s.threshold)) : null;
  const parts = [
    `${s.total_files} file(s) analyzed.`,
    `Lowest Safety Score: ${s.min_safety_score}.`,
  ];
  if (s.threshold !== null) {
    parts.push(`Risk Threshold: ${s.threshold} (Safety Score <= ${thresholdSafety}).`);
  }
  if (s.above_threshold) parts.push("ABOVE THRESHOLD — BLOCKED.");
  lines.push(parts.join(" "));
  lines.push("");
  lines.push("threshold behavior:");
  lines.push("  score < 40  →  exit 1 (fail)");
  lines.push("  score 40–70  →  warning");
  lines.push("  score > 70  →  pass");

  return lines.join("\n");
}

function formatMd(output: AnalysisOutput): string {
  const lines: string[] = ["# CostGuardAI Preflight Analysis", ""];

  for (const f of output.files) {
    lines.push(`## \`${f.file}\``, "");
    lines.push("| Field | Value |", "|---|---|");
    lines.push(`| Model | \`${f.model_id}\` |`);
    lines.push(`| Input tokens | ${f.input_tokens.toLocaleString()} |`);
    lines.push(`| CostGuardAI Safety Score | **${f.safety_score}** |`);
    lines.push(`| Safety band | **${f.safety_band}** |`);
    lines.push(`| Context usage | ${f.context_usage_pct}% |`);
    lines.push(`| Cost/request | ${fmtCostDisplay(f.estimated_cost_per_request)} |`);
    lines.push(`| Truncation | ${f.truncation} |`);
    lines.push("");
    if (f.risk_drivers.length > 0) {
      lines.push("**Risk drivers:**", "");
      for (const d of f.risk_drivers) lines.push(`- ${d.name}: ${d.impact}`);
      lines.push("");
    }
  }

  const s = output.summary;
  lines.push("---");
  lines.push(`**${s.total_files} file(s) analyzed.** Lowest Safety Score: **${s.min_safety_score}**.`);
  if (s.threshold !== null) {
    const thresholdSafety =
      s.threshold !== null ? Math.max(0, Math.min(100, 100 - s.threshold)) : null;
    lines.push(
      `Risk Threshold: ${s.threshold} (Safety Score <= ${thresholdSafety}). Above threshold: **${s.above_threshold}**.`,
    );
  }

  return lines.join("\n");
}

// ── Core computation (exported for programmatic use) ──────────────────────────

export async function analyzeToOutput(args: string[]): Promise<{
  output: AnalysisOutput;
  format: "text" | "md" | "json";
  exitCode: number;
} | null> {
  const parsed = parseArgs(args);
  const configFile = loadConfig(parsed.configPath);

  const modelId = parsed.model ?? configFile.model ?? DEFAULT_MODEL;
  const model = resolveModel(modelId);
  if (!model) {
    process.stderr.write(`Error: Unknown model "${modelId}".\n`);
    return null;
  }

  const extensions = parsed.extensions ?? configFile.extensions ?? DEFAULT_EXTENSIONS;
  const ignoreList = configFile.ignore ?? DEFAULT_IGNORE;
  const expectedOutputTokens =
    parsed.expectedOutputTokens ?? configFile.expectedOutputTokens ?? DEFAULT_EXPECTED_OUTPUT;
  const threshold = parsed.threshold ?? configFile.threshold ?? null;
  const format = parsed.format;

  if (threshold !== null && (isNaN(threshold) || threshold < 0 || threshold > 100)) {
    process.stderr.write("Error: --threshold must be an integer 0–100.\n");
    return null;
  }

  if (!parsed.targetPath) {
    process.stderr.write("Error: specify a file or directory to analyze.\n");
    process.stderr.write("  costguardai analyze <path> [options]\n");
    return null;
  }

  const targetPath = path.resolve(parsed.targetPath);
  if (!fs.existsSync(targetPath)) {
    process.stderr.write(`Error: path does not exist: ${parsed.targetPath}\n`);
    return null;
  }

  const stat = fs.statSync(targetPath);
  let files: string[];
  if (stat.isDirectory()) {
    files = walkDir(targetPath, extensions, ignoreList);
  } else {
    const ext = path.extname(targetPath).toLowerCase();
    if (!extensions.includes(ext)) {
      // Accept any single file regardless of extension when specified directly
    }
    files = [targetPath];
  }

  if (files.length === 0) {
    const empty: AnalysisOutput = {
      score_version: SCORE_VERSION,
      ruleset_hash: RULESET_HASH,
      files: [],
      summary: { total_files: 0, max_risk_score: 0, max_risk_level: "SAFE", min_safety_score: 100, above_threshold: false, threshold },
    };
    return { output: empty, format, exitCode: 0 };
  }

  const cwd = process.cwd();
  const fileResults: FileResult[] = [];

  for (const file of files) {
    try {
      const relativePath = path.relative(cwd, file);
      fileResults.push(analyzeFile(file, relativePath, model, expectedOutputTokens));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error analyzing ${file}: ${msg}\n`);
      return null;
    }
  }

  const maxRiskScore = Math.max(...fileResults.map((f) => f.risk_score));
  const minSafetyScore = Math.min(...fileResults.map((f) => f.safety_score));
  const maxRiskFile = fileResults.find((f) => f.risk_score === maxRiskScore)!;
  const aboveThreshold = threshold !== null && maxRiskScore >= threshold;

  const output: AnalysisOutput = {
    score_version: SCORE_VERSION,
    ruleset_hash: RULESET_HASH,
    files: fileResults,
    summary: {
      total_files: fileResults.length,
      max_risk_score: maxRiskScore,
      max_risk_level: maxRiskFile.risk_level,
      min_safety_score: minSafetyScore,
      above_threshold: aboveThreshold,
      threshold,
    },
  };

  return { output, format, exitCode: aboveThreshold ? 1 : 0 };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAnalyze(args: string[]): Promise<number> {
  const result = await analyzeToOutput(args);
  if (result === null) return 2;

  const { output, format, exitCode } = result;

  if (output.files.length === 0) {
    if (format === "json") {
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } else {
      process.stderr.write("No files found matching the configured extensions.\n");
    }
    return 0;
  }

  if (format === "json") {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    return exitCode;
  }

  if (format !== "json") {
    if (format === "md") {
      process.stdout.write(formatMd(output) + "\n");
    } else {
      process.stdout.write(formatText(output) + "\n");
    }

    process.stdout.write(
      "\n---\n\n" +
      "🚀 Next step (recommended):\n" +
      "Run CostGuardAI on a real prompt from your codebase:\n\n" +
      "costguardai analyze ./prompts/your-prompt.txt\n\n" +
      "Then protect production with CI:\n\n" +
      "costguardai ci --fail-on-risk 70\n\n" +
      "→ Blocks unsafe prompts before production\n" +
      "→ Prevents token explosions + cost spikes\n" +
      "→ Required for teams / production workflows\n\n" +
      "---\n\n",
    );

    console.log("⚠️  This prompt may cause production issues");
    console.log("");
    console.log("Free includes → basic analysis only");
    console.log("🔒 Fix suggestions: Pro");
    console.log("🔒 CI enforcement: Pro");
    console.log("");
    console.log("Upgrade → https://costguardai.io/upgrade");
    console.log("Pro unlocks → fix suggestions, CI enforcement, safer prompt reviews");
    console.log("");
  }

  return exitCode;
}
