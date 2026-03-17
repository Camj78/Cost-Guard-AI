import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { runInstall } from "./install";

const PROVIDER_DEFAULTS: Record<string, string> = {
  openai:    "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  google:    "gemini-2.5-flash-lite",
  meta:      "llama-3.3-70b",
};

const DEFAULT_CONFIG = {
  model: "gpt-4o-mini",
  extensions: [".txt", ".md", ".prompt"],
  ignore: ["node_modules", ".git", "dist", "build", ".next", "coverage", ".cache"],
  expectedOutputTokens: 512,
  threshold: 70,
};

function isInteractive(): boolean {
  return !!process.stdout.isTTY && !process.env.CI;
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function collectConfig(): Promise<typeof DEFAULT_CONFIG> {
  if (!isInteractive()) {
    return DEFAULT_CONFIG;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write("\nCostGuardAI setup — press Enter to accept defaults.\n\n");

  const providers = Object.keys(PROVIDER_DEFAULTS);
  process.stdout.write("Provider:\n");
  providers.forEach((p, i) => process.stdout.write(`  ${i + 1}) ${p}\n`));

  const providerInput = (await ask(rl, "  Choice [1]: ")).trim();
  const providerIdx = parseInt(providerInput, 10);
  const provider =
    !isNaN(providerIdx) && providerIdx >= 1 && providerIdx <= providers.length
      ? providers[providerIdx - 1]
      : "openai";
  const model = PROVIDER_DEFAULTS[provider];

  const budgetInput = (await ask(rl, "\nExpected output tokens [512]: ")).trim();
  const expectedOutputTokens =
    parseInt(budgetInput, 10) > 0 ? parseInt(budgetInput, 10) : 512;

  const thresholdInput = (await ask(rl, "\nFail threshold — risk score 0–100 (e.g. 70 = Safety Score ≤ 30) [70]: ")).trim();
  const threshold =
    parseInt(thresholdInput, 10) > 0 ? parseInt(thresholdInput, 10) : 70;

  rl.close();

  return { ...DEFAULT_CONFIG, model, expectedOutputTokens, threshold };
}

export async function runInit(_args: string[]): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, "costguard.config.json");
  const interactive = isInteractive();

  // 1. Collect config (interactive TTY or CI-safe defaults)
  const config = await collectConfig();

  // 2. Write config file (non-destructive)
  if (fs.existsSync(configPath)) {
    process.stdout.write("  costguard.config.json  already exists — skipped\n");
  } else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    process.stdout.write("  costguard.config.json  created\n");
  }

  // 3. Bootstrap policy + workflow + .costguard dir
  process.stdout.write("\n");
  runInstall([]);

  // 4. Footer
  process.stdout.write(
    `\nSetup complete (${interactive ? "interactive" : "defaults"}).\n` +
      "Run: costguardai analyze .\n",
  );
}
