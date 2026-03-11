import { runAnalyze } from "./analyze";

export async function runCi(args: string[]): Promise<number> {
  const forwarded: string[] = [];
  let hasPath = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--fail-on-risk" && args[i + 1]) {
      forwarded.push("--threshold", args[++i]);
    } else if (a.startsWith("--fail-on-risk=")) {
      forwarded.push("--threshold=" + a.slice(15));
    } else if (!a.startsWith("-") && !hasPath) {
      hasPath = true;
      forwarded.push(a);
    } else {
      forwarded.push(a);
    }
  }

  if (!hasPath) forwarded.unshift(".");

  return runAnalyze(forwarded);
}
