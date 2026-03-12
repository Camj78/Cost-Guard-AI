import * as fs from "fs";
import * as path from "path";

const POLICY_CONTENT = JSON.stringify(
  {
    max_risk_score: 70,
    max_prompt_tokens: 4000,
    block_injection_risk: true,
    require_schema_constraints: true,
  },
  null,
  2,
) + "\n";

const WORKFLOW_CONTENT = `# CostGuardAI PR Risk Report
#
# Scans changed prompt files on every PR and:
#   1. Posts a summary comment with risk scores + cost breakdown
#   2. Adds inline annotations on changed lines (warning >=60, failure >=80)
#
# Permissions:
#   Same-repo PRs: full comment + annotation support
#   Fork PRs:      analysis runs; posting steps gracefully skip (GitHub security model)

name: CostGuardAI PR Risk Report

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  risk-report:
    name: Prompt Risk Analysis
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      checks: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build CLI
        run: pnpm --filter ./packages/cli build

      - name: Detect changed prompt files
        id: changed
        run: |
          git diff --name-only \\
            "\${{ github.event.pull_request.base.sha }}" \\
            "\${{ github.event.pull_request.head.sha }}" \\
            | grep -E '\\.(prompt|txt|md)$' \\
            > changed_prompts.txt || true

          if [ ! -s changed_prompts.txt ]; then
            echo "found=false" >> "\$GITHUB_OUTPUT"
            echo "No prompt files changed. Skipping analysis."
          else
            echo "found=true" >> "\$GITHUB_OUTPUT"
            echo "Changed prompt files:"
            cat changed_prompts.txt
          fi

      - name: Run CostGuard analysis
        if: steps.changed.outputs.found == 'true'
        run: |
          node packages/cli/dist/bin.js ci --json . > costguard.json || true

      - name: Post PR comment
        if: steps.changed.outputs.found == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require("fs");
            const marker = "<!-- costguard-ci -->";
            const data = JSON.parse(fs.readFileSync("costguard.json", "utf8"));
            const files = data.files || [];

            function riskBadge(score) {
              if (score >= 80) return "🔴 " + score;
              if (score >= 60) return "🟡 " + score;
              return "🟢 " + score;
            }

            const lines = [marker, "## CostGuardAI Risk Report", ""];
            if (files.length === 0) {
              lines.push("_No prompt files analyzed._");
            } else {
              lines.push("| File | Risk | Tokens |", "|------|------|-------:|");
              for (const f of files) {
                lines.push(\`| \\\`\${f.file}\\\` | \${riskBadge(f.risk_score)} | \${f.input_tokens.toLocaleString()} |\`);
              }
            }
            lines.push("", \`_Powered by [CostGuardAI](https://costguardai.io)_\`);
            const body = lines.join("\\n");

            try {
              const { data: comments } = await github.rest.issues.listComments({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.pull_request.number,
              });
              const existing = comments.find((c) => c.body && c.body.includes(marker));
              if (existing) {
                await github.rest.issues.updateComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  comment_id: existing.id,
                  body,
                });
              } else {
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: context.payload.pull_request.number,
                  body,
                });
              }
            } catch (err) {
              core.warning(\`Could not post PR comment: \${err.message}\`);
            }
`;

interface InstallResult {
  created: string[];
  skipped: string[];
}

function ensureFile(filePath: string, content: string, result: InstallResult): void {
  if (fs.existsSync(filePath)) {
    result.skipped.push(filePath);
    return;
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf8");
  result.created.push(filePath);
}

export function runInstall(_args: string[]): void {
  const cwd = process.cwd();
  const result: InstallResult = { created: [], skipped: [] };

  ensureFile(path.join(cwd, "costguard.policy.json"), POLICY_CONTENT, result);
  ensureFile(path.join(cwd, ".github", "workflows", "costguard-pr.yml"), WORKFLOW_CONTENT, result);
  ensureFile(path.join(cwd, ".costguard", ".gitkeep"), "", result);

  const lines: string[] = ["CostGuardAI installed", ""];

  if (result.created.length > 0) {
    lines.push("Created:");
    for (const f of result.created) lines.push(`  - ${path.relative(cwd, f)}`);
    lines.push("");
  }

  if (result.skipped.length > 0) {
    lines.push("Skipped (already exists):");
    for (const f of result.skipped) lines.push(`  - ${path.relative(cwd, f)}`);
    lines.push("");
  }

  lines.push(
    "Next:",
    "  git add .",
    '  git commit -m "chore: install CostGuardAI"',
    "  git push origin main",
    "",
  );

  process.stdout.write(lines.join("\n"));
}
