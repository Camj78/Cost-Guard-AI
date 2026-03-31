import * as fs from "fs";
import * as path from "path";
import { runAnalyze, analyzeToOutput, type FileResult, type AnalysisOutput, SCORE_VERSION, RULESET_HASH } from "./analyze";
import { loadPolicy, evaluatePolicy } from "../policy";

// ── Zero-config discovery ────────────────────────────────────────────────────

const _ZC_IGNORE = ["node_modules", ".git", "dist", "build", ".next", "coverage", ".cache", ".turbo"];

function discoverZeroConfig(cwd: string): string[] {
  const files = new Set<string>();

  function walk(dir: string, exts: string[]): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (_ZC_IGNORE.some((p) => e.name === p)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, exts);
      else if (e.isFile() && exts.includes(path.extname(e.name).toLowerCase())) files.add(full);
    }
  }

  // ./prompts/**/*.txt + ./prompts/**/*.md
  const promptsDir = path.join(cwd, "prompts");
  if (fs.existsSync(promptsDir) && fs.statSync(promptsDir).isDirectory()) {
    walk(promptsDir, [".txt", ".md"]);
  }
  // ./**/*.prompt (anywhere)
  walk(cwd, [".prompt"]);

  return [...files].sort();
}

export async function runCi(args: string[]): Promise<number> {
  const forwarded: string[] = [];
  let hasPath = false;
  let policyPath: string | null = null;
  let failOnRisk = false;
  let failOnRiskThreshold = 0;
  let primaryFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--fail-on-risk" && args[i + 1]) {
      const thresh = args[++i];
      forwarded.push("--threshold", thresh);
      failOnRisk = true;
      failOnRiskThreshold = parseInt(thresh, 10);
    } else if (a.startsWith("--fail-on-risk=")) {
      const thresh = a.slice(15);
      forwarded.push("--threshold=" + thresh);
      failOnRisk = true;
      failOnRiskThreshold = parseInt(thresh, 10);
    } else if (a === "--policy") {
      // --policy <path>  or bare --policy (uses default file)
      if (args[i + 1] && !args[i + 1].startsWith("-")) {
        policyPath = args[++i];
      } else {
        policyPath = "costguard.policy.json";
      }
    } else if (a.startsWith("--policy=")) {
      policyPath = a.slice(9) || "costguard.policy.json";
    } else if (!a.startsWith("-") && !hasPath) {
      hasPath = true;
      primaryFile = a;
      forwarded.push(a);
    } else {
      forwarded.push(a);
    }
  }

  if (!hasPath) {
    const cwd = process.cwd();
    const discovered = discoverZeroConfig(cwd);

    if (discovered.length === 0) {
      process.stdout.write(
        "CostGuardAI: no prompt files found.\n\n" +
        "Searched:\n" +
        "  ./prompts/**/*.txt\n" +
        "  ./prompts/**/*.md\n" +
        "  ./**/*.prompt\n\n" +
        "Add prompt files or run: costguardai ci <path>\n",
      );
      return 0;
    }

    // Analyze each discovered file via existing pipeline
    const fileResults: FileResult[] = [];
    for (const file of discovered) {
      const result = await analyzeToOutput([file, ...forwarded]);
      if (result === null) return 2;
      if (result.output.files.length > 0) fileResults.push(...result.output.files);
    }

    // Aggregate summary
    const total = fileResults.length;
    const maxRiskScore = total > 0 ? Math.max(...fileResults.map((f) => f.risk_score)) : 0;
    const minSafetyScore = total > 0 ? Math.min(...fileResults.map((f) => f.safety_score)) : 100;
    const worstFile = fileResults.find((f) => f.risk_score === maxRiskScore) ?? fileResults[0];
    const aboveThreshold = failOnRisk && maxRiskScore >= failOnRiskThreshold;
    const failedCount = failOnRisk ? fileResults.filter((f) => f.risk_score >= failOnRiskThreshold).length : 0;

    const isJsonMode = forwarded.some(
      (a, i, arr) => a === "--json" || a === "--format=json" || (a === "--format" && arr[i + 1] === "json"),
    );

    if (isJsonMode) {
      const output: AnalysisOutput = {
        score_version: SCORE_VERSION,
        ruleset_hash: RULESET_HASH,
        files: fileResults,
        summary: {
          total_files: total,
          max_risk_score: maxRiskScore,
          max_risk_level: worstFile?.risk_level ?? "SAFE",
          min_safety_score: minSafetyScore,
          above_threshold: aboveThreshold,
          threshold: failOnRisk ? failOnRiskThreshold : null,
        },
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } else {
      // Per-file status lines
      for (const f of fileResults) {
        const icon = f.safety_score >= 70 ? "✅" : f.safety_score >= 40 ? "⚠️ " : "❌";
        process.stdout.write(`  ${icon} ${f.file} — Safety Score: ${f.safety_score} (${f.safety_band})\n`);
      }
      process.stdout.write("\n");
    }

    // CI summary line
    if (aboveThreshold) {
      process.stdout.write(`❌ CI FAILED — ${failedCount} of ${total} prompt files exceeded threshold\n`);
      // Guardrail block for PR bots
      if (worstFile) {
        const lines: string[] = [
          "",
          "CostGuardAI blocked this merge.",
          `Safety Score: ${worstFile.safety_score} (FAIL)`,
          `This prompt exceeds your risk threshold (${failOnRiskThreshold}).`,
        ];
        if (worstFile.risk_drivers.length > 0) {
          lines.push("Issues:");
          for (const d of worstFile.risk_drivers) lines.push(`• ${d.name}`);
        }
        lines.push("", "Suggested fix:", `costguardai fix ${worstFile.file}`, "");
        process.stdout.write(lines.join("\n") + "\n");
      }
      return 1;
    }

    process.stdout.write(`✅ CI PASSED — ${total} prompt files checked\n`);
    return 0;
  }

  // No policy: delegate to runAnalyze, then append PR guardrail block on failure
  if (policyPath === null) {
    const code = await runAnalyze(forwarded);

    // When threshold is exceeded, append a structured guardrail block for PR bots
    if (failOnRisk && code === 1) {
      const result = await analyzeToOutput([...forwarded, "--format", "json"]);
      if (result !== null && result.output.files.length > 0) {
        const worst = result.output.files.reduce(
          (a, b) => (b.risk_score > a.risk_score ? b : a),
          result.output.files[0],
        );
        const safetyScore = 100 - worst.risk_score;
        const fileHint = worst.file !== "." ? worst.file : (primaryFile ?? "<prompt-file>");

        const lines: string[] = [
          "",
          "CostGuardAI blocked this merge.",
          `Safety Score: ${safetyScore} (FAIL)`,
          `This prompt exceeds your risk threshold (${failOnRiskThreshold}).`,
        ];

        if (worst.risk_drivers.length > 0) {
          lines.push("Issues:");
          for (const d of worst.risk_drivers) {
            lines.push(`• ${d.name}`);
          }
        }

        lines.push(
          "",
          "Suggested fix:",
          `costguardai fix ${fileHint}`,
          "",
          "Run locally:",
          `costguardai analyze ${fileHint}`,
          `costguardai fix ${fileHint}`,
          "",
        );

        process.stdout.write(lines.join("\n") + "\n");
      }
    }

    return code;
  }

  // Policy mode: obtain structured output then evaluate rules
  const jsonArgs = [...forwarded, "--format", "json"];
  const result = await analyzeToOutput(jsonArgs);

  if (result === null) return 2;

  const { output, exitCode: analyzeCode } = result;

  // Print JSON output to stdout
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");

  // Load policy
  const policy = loadPolicy(policyPath);
  if (!policy) {
    process.stderr.write(`Policy file not found: ${policyPath}\n`);
    return 2;
  }

  // Evaluate policy rules
  const violations = evaluatePolicy(policy, output.files);
  if (violations.length > 0) {
    process.stderr.write("\nPolicy violations:\n");
    for (const v of violations) {
      process.stderr.write(
        `  [${v.rule}]${v.file ? ` ${v.file}:` : ""} ${v.message}\n`,
      );
    }
    process.stderr.write(
      `\n${violations.length} policy violation(s) found. Exiting with code 1.\n`,
    );
    return 1;
  }

  process.stderr.write("Policy check passed.\n");
  return analyzeCode;
}
