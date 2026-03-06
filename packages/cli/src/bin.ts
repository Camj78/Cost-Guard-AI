import { runAnalyze } from "./commands/analyze";
import { runInit } from "./commands/init";

const PKG_VERSION = "0.2.0";

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
  process.stdout.write(
    [
      `CostGuard CLI v${PKG_VERSION}`,
      "",
      "USAGE",
      "  costguard <command> [options]",
      "",
      "COMMANDS",
      "  analyze <path>    Analyze prompt files in a directory or a single file",
      "  init              Create costguard.config.json with defaults",
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
      "MODELS",
      "  gpt-4o-mini (default)   claude-sonnet-4-6   gemini-2.5-flash-lite",
      "  gpt-4o                  claude-haiku-4-5    llama-3.3-70b",
      "",
      "EXIT CODES",
      "  0   All files below threshold (or no threshold set)",
      "  1   Runtime error",
      "  2   One or more files at or above threshold",
      "",
    ].join("\n"),
  );
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

  if (command === "init") {
    runInit(args.slice(1));
    process.exit(0);
  }

  if (command === "analyze") {
    const code = await runAnalyze(args.slice(1));
    process.exit(code);
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  process.stderr.write("Run 'costguard --help' for usage.\n");
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
