import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrendEntry {
  timestamp: string;
  commit: string;
  files: Array<{ file: string; risk_score: number }>;
  avg_risk: number;
  max_risk: number;
}

export interface TrendSummary {
  risk_delta: number;
  highest_risk_prompt: string;
  risk_trend: "increasing" | "decreasing" | "stable";
  last_10_commits: TrendEntry[];
}

// ── Persistence ───────────────────────────────────────────────────────────────

const HISTORY_DIR = ".costguard";
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");

function loadHistory(): TrendEntry[] {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")) as TrendEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: TrendEntry[]): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2));
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function runGit(args: string[]): string | null {
  try {
    return execSync(`git ${args.map((a) => `"${a}"`).join(" ")}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getRecentCommits(limit = 10): Array<{ sha: string; date: string }> {
  const output = runGit([
    "log",
    `--max-count=${limit}`,
    "--format=%H %aI",
    "--no-merges",
  ]);
  if (!output) return [];
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const spaceIdx = line.indexOf(" ");
      return {
        sha: line.slice(0, spaceIdx),
        date: line.slice(spaceIdx + 1),
      };
    });
}

function getFilesChangedAtCommit(sha: string): string[] {
  const output = runGit(["diff-tree", "--no-commit-id", "-r", "--name-only", sha]);
  if (!output) return [];
  return output.split("\n").filter((f) => f && /\.(prompt|txt|md)$/.test(f));
}

function getFileContentAtCommit(sha: string, filePath: string): string | null {
  try {
    // Use shell directly to avoid quoting issues with colons in the ref
    return execSync(`git show ${sha}:"${filePath}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

// ── Risk heuristic ────────────────────────────────────────────────────────────
// Lightweight estimate for historical trend tracking (consistent across runs).

function estimateRisk(content: string): number {
  const words = content.split(/\s+/).filter(Boolean);
  const tokenEstimate = Math.ceil(words.length * 1.3);
  let score = 0;

  // Length heuristic
  if (tokenEstimate > 3000) score += 30;
  else if (tokenEstimate > 1000) score += 15;
  else score += 5;

  // Ambiguity signals
  const ambiguousTerms = [
    "comprehensive",
    "detailed",
    "extensive",
    "thorough",
    "complete",
    "as much as possible",
    "everything",
  ];
  const ambiguityCount = ambiguousTerms.reduce(
    (acc, t) => acc + (content.toLowerCase().split(t).length - 1),
    0,
  );
  if (ambiguityCount >= 3) score += 30;
  else if (ambiguityCount >= 1) score += 15;

  // Structural signals
  const hasOutputFormat = /json|xml|markdown|format|output|schema/i.test(content);
  const hasConstraints = /\bmax\b|\blimit\b|\bonly\b|\bexactly\b|\bmust\b/i.test(content);
  if (!hasOutputFormat) score += 20;
  if (!hasConstraints) score += 15;

  return Math.min(score, 100);
}

// ── Core computation ──────────────────────────────────────────────────────────

function buildTrendEntry(
  sha: string,
  date: string,
  promptExtensions: string[],
): TrendEntry | null {
  const changedFiles = getFilesChangedAtCommit(sha).filter((f) =>
    promptExtensions.some((ext) => f.endsWith(ext)),
  );
  if (changedFiles.length === 0) return null;

  const fileScores: Array<{ file: string; risk_score: number }> = [];
  for (const file of changedFiles) {
    const content = getFileContentAtCommit(sha, file);
    if (!content) continue;
    fileScores.push({ file, risk_score: estimateRisk(content) });
  }
  if (fileScores.length === 0) return null;

  const avg =
    fileScores.reduce((a, b) => a + b.risk_score, 0) / fileScores.length;
  const max = Math.max(...fileScores.map((f) => f.risk_score));

  return {
    timestamp: date,
    commit: sha,
    files: fileScores,
    avg_risk: parseFloat(avg.toFixed(1)),
    max_risk: max,
  };
}

export function computeTrends(
  promptExtensions = [".prompt", ".txt", ".md"],
): TrendSummary {
  const commits = getRecentCommits(10);
  const existingHistory = loadHistory();

  const newEntries: TrendEntry[] = [];
  for (const commit of commits) {
    const existing = existingHistory.find((e) => e.commit === commit.sha);
    if (existing) {
      newEntries.push(existing);
      continue;
    }
    const entry = buildTrendEntry(commit.sha, commit.date, promptExtensions);
    if (entry) newEntries.push(entry);
  }

  // Merge + persist (newest 50 entries)
  const merged = [
    ...newEntries,
    ...existingHistory.filter(
      (e) => !newEntries.some((n) => n.commit === e.commit),
    ),
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 50);

  saveHistory(merged);

  const last10 = merged.slice(0, 10);
  if (last10.length === 0) {
    return {
      risk_delta: 0,
      highest_risk_prompt: "",
      risk_trend: "stable",
      last_10_commits: [],
    };
  }

  const newest = last10[0];
  const oldest = last10[last10.length - 1];
  const riskDelta = newest.avg_risk - oldest.avg_risk;

  let highestRiskFile = "";
  let highestRisk = -1;
  for (const entry of last10) {
    for (const f of entry.files) {
      if (f.risk_score > highestRisk) {
        highestRisk = f.risk_score;
        highestRiskFile = f.file;
      }
    }
  }

  const trend: "increasing" | "decreasing" | "stable" =
    riskDelta > 5 ? "increasing" : riskDelta < -5 ? "decreasing" : "stable";

  return {
    risk_delta: parseFloat(riskDelta.toFixed(1)),
    highest_risk_prompt: highestRiskFile,
    risk_trend: trend,
    last_10_commits: last10,
  };
}

// ── CLI command ───────────────────────────────────────────────────────────────

export async function runTrends(args: string[]): Promise<number> {
  const useJson = args.includes("--json");
  const summary = computeTrends();

  if (useJson) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return 0;
  }

  const SEP = "─".repeat(56);
  const deltaStr =
    summary.risk_delta >= 0
      ? `+${summary.risk_delta}`
      : `${summary.risk_delta}`;

  const lines = [
    "CostGuard Risk Trend Intelligence",
    SEP,
    `  Risk delta (last 10 commits):  ${deltaStr}`,
    `  Trend:                         ${summary.risk_trend}`,
    `  Highest risk prompt:           ${summary.highest_risk_prompt || "(none detected)"}`,
    "",
  ];

  if (summary.last_10_commits.length > 0) {
    lines.push("  Recent commit history:");
    for (const entry of summary.last_10_commits.slice(0, 5)) {
      const shortSha = entry.commit.slice(0, 7);
      lines.push(
        `    ${shortSha}  avg=${entry.avg_risk.toFixed(1)}  max=${entry.max_risk}  files=${entry.files.length}`,
      );
    }
  } else {
    lines.push("  No prompt file history found in last 10 commits.");
  }

  lines.push(SEP);
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}
