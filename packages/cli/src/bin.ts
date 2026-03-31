import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runAnalyze } from "./commands/analyze";
import { runInit } from "./commands/init";
import { runCi } from "./commands/ci";
import { runFix } from "./commands/fix";
import { runTrends } from "./trends";
import { version as PKG_VERSION } from "../package.json";

const DEMO_PROMPT = `Write a detailed, comprehensive, in depth explanation of everything you know about the topic as much as possible, and thoroughly explain all aspects. Please improve and optimize this to be as efficient, flexible, clean, robust, scalable, advanced, and modern as possible, with high quality, good results that are better and faster than any existing solution.`;

const args = process.argv.slice(2);
const command = args[0];

function printTip(): void {
  process.stdout.write(
    "\n  Tip: run `costguardai init` to add CostGuardAI to your repo.\n\n" +
    "  ────────────────────────\n" +
    "  Docs:   https://costguardai.io/docs\n" +
    "  GitHub: https://github.com/Camj78/Cost-Guard-AI\n" +
    "  Star if useful ⭐\n" +
    "  ────────────────────────\n\n",
  );
}

function printHelp(): void {
  process.stdout.write(
    [
      `CostGuardAI CLI v${PKG_VERSION}`,
      "",
      "USAGE",
      "  costguardai <command> [options]",
      "",
      "COMMANDS",
      "  analyze <path>    Analyze prompt files in a directory or a single file",
      "  fix <file>        Harden a prompt and improve its safety score",
      "  ci                CI-native scan with exit codes — gates on CostGuardAI Safety Score",
      "  trends            Show risk trend intelligence from git history",
      "  init              Bootstrap CostGuardAI in this repo (interactive or CI-safe defaults)",
      "  install           Alias for init (kept for compatibility)",
      "  version           Print version",
      "",
      "ANALYZE OPTIONS",
      "  --model <id>             Model to use (default: gpt-4o-mini)",
      "  --format text|md|json    Output format (default: text)",
      "  --json                   Shorthand for --format json",
      "  --threshold <n>          Exit 1 if any file risk_score >= n (risk 0–100; Safety Score <= 100-n)",
      "  --config <path>          Config file path (default: costguard.config.json)",
      "  --ext <exts>             Comma-separated extensions (default: .txt,.md,.prompt)",
      "  --expected-output <n>    Expected output tokens (default: 512)",
      "",
      "CI OPTIONS",
      "  --fail-on-risk <n>       Exit 1 if risk_score >= n (equivalent: Safety Score <= 100-n)",
      "  --policy [path]          Enforce costguard.policy.json rules (exit 1 on violation)",
      "  --json                   Output JSON",
      "  [path]                   Directory to scan (default: current directory)",
      "",
      "TRENDS OPTIONS",
      "  --json                   Output JSON",
      "",
      "MODELS",
      "  gpt-4o-mini (default)   claude-sonnet-4-6   gemini-2.5-flash-lite",
      "  gpt-4o                  claude-haiku-4-5    llama-3.3-70b",
      "",
      "EXIT CODES",
      "  0   All files below threshold (or no threshold set)",
      "  1   One or more files at or above threshold (or policy violation)",
      "  2   Runtime error",
      "",
    ].join("\n"),
  );
  printTip();
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    process.exit(0);
  }

  if (command === "version" || command === "--version" || command === "-v") {
    process.stdout.write(PKG_VERSION + "\n");
    process.exit(0);
  }

  if (command === "install") {
    await runInit(args.slice(1));
    process.exit(0);
  }

  if (command === "init") {
    await runInit(args.slice(1));
    process.exit(0);
  }

  if (command === "analyze") {
    const restArgs = args.slice(1);
    const isJsonMode = restArgs.some(
      (a, i, arr) =>
        a === "--json" ||
        a === "--format=json" ||
        (a === "--format" && arr[i + 1] === "json"),
    );
    if (isJsonMode) {
      // Suppress all console.* output so stdout contains only the JSON object.
      // process.stderr is left intact for error diagnostics.
      const noop = (): void => {};
      console.log = noop;
      console.warn = noop;
      console.info = noop;
    }
    const code = await runAnalyze(restArgs);
    if (code === 0 && !isJsonMode) printTip();
    process.exit(code);
  }

  if (command === "fix") {
    const code = await runFix(args.slice(1));
    process.exit(code);
  }

  if (command === "ci") {
    const code = await runCi(args.slice(1));
    process.exit(code);
  }

  if (command === "trends") {
    const code = await runTrends(args.slice(1));
    process.exit(code);
  }

  if (command === "demo") {
    const tmpFile = path.join(os.tmpdir(), `costguard-demo-${Date.now()}.prompt`);
    fs.writeFileSync(tmpFile, DEMO_PROMPT, "utf8");
    try {
      const demoArgs = args.slice(1); // pass-through any flags (e.g. --json, --model)
      const code = await runAnalyze([tmpFile, ...demoArgs]);
      if (code === 0) printTip();
      process.exit(code);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  process.stderr.write("Run 'costguardai --help' for usage.\n");
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
