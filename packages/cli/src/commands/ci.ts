import { runAnalyze, analyzeToOutput } from "./analyze";
import { loadPolicy, evaluatePolicy } from "../policy";

export async function runCi(args: string[]): Promise<number> {
  const forwarded: string[] = [];
  let hasPath = false;
  let policyPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--fail-on-risk" && args[i + 1]) {
      forwarded.push("--threshold", args[++i]);
    } else if (a.startsWith("--fail-on-risk=")) {
      forwarded.push("--threshold=" + a.slice(15));
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
      forwarded.push(a);
    } else {
      forwarded.push(a);
    }
  }

  if (!hasPath) forwarded.unshift(".");

  // No policy: delegate unchanged to runAnalyze
  if (policyPath === null) {
    return runAnalyze(forwarded);
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
