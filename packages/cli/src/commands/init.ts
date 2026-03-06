import * as fs from "fs";
import * as path from "path";

const DEFAULT_CONFIG = {
  model: "gpt-4o-mini",
  extensions: [".txt", ".md", ".prompt"],
  ignore: ["node_modules", ".git", "dist", "build", ".next", "coverage", ".cache"],
  expectedOutputTokens: 512,
  threshold: 70,
};

export function runInit(_args: string[]): void {
  const configPath = path.resolve("costguard.config.json");

  if (fs.existsSync(configPath)) {
    process.stderr.write(`costguard.config.json already exists at ${configPath}\n`);
    process.stderr.write("Delete it first if you want to reset to defaults.\n");
    process.exit(1);
  }

  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  process.stdout.write(`Created costguard.config.json\n`);
  process.stdout.write(`Edit it to configure your model, extensions, and threshold.\n`);
}
