import { runAnalyze, analyzeToOutput } from "./analyze";
import { loadPolicy, evaluatePolicy } from "../policy";

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
    forwarded.unshift("--ci-mode", ".");
    primaryFile = ".";
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
