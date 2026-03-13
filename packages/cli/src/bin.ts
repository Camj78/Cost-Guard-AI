import { runAnalyze } from "./commands/analyze";
import { runInit } from "./commands/init";
import { runCi } from "./commands/ci";
import { runTrends } from "./trends";

const PKG_VERSION = "0.2.4";

const args = process.argv.slice(2);
const command = args[0];

function printTip(): void {
  process.stdout.write(
    "\n  Tip: run `costguardai init` to add CostGuardAI to your repo.\n\n" +
    "  ────────────────────────\n" +
    "  Docs:   https://costguardai.io/docs\n" +
    "  GitHub: https://github.com/costguardai/costguard\n" +
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
      "  ci                CI-native scan with exit codes (use --fail-on-risk)",
      "  trends            Show risk trend intelligence from git history",
      "  init              Bootstrap CostGuardAI in this repo (interactive or CI-safe defaults)",
      "  install           Alias for init (kept for compatibility)",
      "  version           Print version",
      "",
      "ANALYZE OPTIONS",
      "  --model <id>             Model to use (default: gpt-4o-mini)",
      "  --format text|md|json    Output format (default: text)",
      "  --json                   Shorthand for --format json",
      "  --threshold <n>          Exit code 2 if any file risk_score >= n (0–100)",
      "  --config <path>          Config file path (default: costguard.config.json)",
      "  --ext <exts>             Comma-separated extensions (default: .txt,.md,.prompt)",
      "  --expected-output <n>    Expected output tokens (default: 512)",
      "",
      "CI OPTIONS",
      "  --fail-on-risk <n>       Exit 2 if any file risk_score >= n (0–100)",
      "  --policy [path]          Enforce costguard.policy.json rules (exit 2 on violation)",
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
    const code = await runAnalyze(restArgs);
    const isJsonMode = restArgs.some(
      (a, i, arr) =>
        a === "--json" ||
        a === "--format=json" ||
        (a === "--format" && arr[i + 1] === "json"),
    );
    if (code === 0 && !isJsonMode) printTip();
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

  process.stderr.write(`Unknown command: ${command}\n`);
  process.stderr.write("Run 'costguardai --help' for usage.\n");
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
