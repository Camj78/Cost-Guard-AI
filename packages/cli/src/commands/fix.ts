import * as fs from "fs";
import * as path from "path";
import { analyzeToOutput } from "./analyze";
import { hardenPrompt } from "../core/hardening";

const SEP = "─".repeat(48);

export async function runFix(args: string[]): Promise<number> {
  // Find the file path argument (first non-flag arg)
  const filePath = args.find((a) => !a.startsWith("-"));
  if (!filePath) {
    process.stderr.write("Usage: costguardai fix <file>\n");
    return 2;
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    process.stderr.write(`Error: file not found: ${filePath}\n`);
    return 2;
  }

  // Read original prompt
  let original: string;
  try {
    original = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    process.stderr.write(
      `Error reading file: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  // Analyze original prompt
  const beforeResult = await analyzeToOutput([filePath]);
  if (!beforeResult || beforeResult.output.files.length === 0) {
    process.stderr.write("Error: could not analyze file.\n");
    return 2;
  }
  const beforeFile = beforeResult.output.files[0];
  const beforeSafety = 100 - beforeFile.risk_score;

  // Apply deterministic hardening rules
  const { hardened, changes } = hardenPrompt(original);

  // Write hardened prompt file
  const parsed = path.parse(absPath);
  const hardenedExt = parsed.ext || ".txt";
  const hardenedPath = path.join(parsed.dir, parsed.name + ".hardened" + hardenedExt);
  const hardenedRelative = path.relative(process.cwd(), hardenedPath);

  try {
    fs.writeFileSync(hardenedPath, hardened, "utf8");
  } catch (err) {
    process.stderr.write(
      `Error writing hardened file: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 2;
  }

  // Analyze hardened prompt
  const afterResult = await analyzeToOutput([hardenedPath]);
  if (!afterResult || afterResult.output.files.length === 0) {
    process.stderr.write("Error: could not analyze hardened file.\n");
    return 2;
  }
  const afterFile = afterResult.output.files[0];
  const afterSafety = 100 - afterFile.risk_score;

  // Print before/after report
  const lines: string[] = [
    "",
    "CostGuardAI Fix Mode",
    SEP,
    `Original Safety Score: ${beforeSafety}`,
  ];

  if (beforeFile.risk_drivers.length > 0) {
    lines.push("Issues Detected:");
    for (const d of beforeFile.risk_drivers) {
      lines.push(`  • ${d.name}`);
    }
  }

  lines.push("", "Applying prompt hardening...");

  if (changes.length === 0) {
    lines.push("  No hardening changes required.");
  } else {
    for (const c of changes) {
      lines.push(`  ✔ ${c}`);
    }
  }

  lines.push(
    "",
    `New Safety Score: ${afterSafety}`,
    "",
    "Hardened prompt written to:",
    `  ${hardenedRelative}`,
    "",
  );

  process.stdout.write(lines.join("\n") + "\n");

  return 0;
}
