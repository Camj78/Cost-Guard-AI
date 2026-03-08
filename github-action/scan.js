#!/usr/bin/env node
// CostGuard Prompt Scan — GitHub Action entry point
// Scans *.prompt, *.txt, *.md, *.ts, *.js files for embedded AI prompts,
// calls the CostGuard API, and blocks the build if risk exceeds threshold.

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Inputs ─────────────────────────────────────────────────────────────────────

const API_KEY        = process.env.INPUT_API_KEY        || process.env.COSTGUARD_API_KEY || '';
const SCAN_PATH      = process.env.INPUT_PATH           || '.';
const THRESHOLD      = parseInt(process.env.INPUT_RISK_THRESHOLD || '70', 10);
const WORKSPACE      = process.env.GITHUB_WORKSPACE     || process.cwd();
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN         || '';
const GITHUB_REPO    = process.env.GITHUB_REPOSITORY    || '';
const OUTPUT_FILE    = process.env.GITHUB_OUTPUT        || '';
const GITHUB_REF     = process.env.GITHUB_REF           || '';

const COSTGUARD_HOST = 'https://costguardai.io';

// ── Config ─────────────────────────────────────────────────────────────────────

const PROMPT_EXTENSIONS = new Set(['.prompt', '.txt', '.md', '.ts', '.js']);
const IGNORE_DIRS       = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  'coverage', '.turbo', '.cache', 'vendor', '__pycache__',
]);
const MAX_FILES      = 50;   // cap to keep scan < 10s
const MAX_FILE_BYTES = 100_000;
const CONCURRENCY    = 5;

// ── File discovery ─────────────────────────────────────────────────────────────

function walkDir(dir, results = []) {
  if (results.length >= MAX_FILES) return results;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const entry of entries) {
    if (results.length >= MAX_FILES) break;
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        walkDir(path.join(dir, entry.name), results);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (PROMPT_EXTENSIONS.has(ext)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  return results;
}

// ── Prompt extraction ──────────────────────────────────────────────────────────

// Matches template literals assigned to prompt-like variable names.
const NAMED_PROMPT_RE = /(?:prompt|system|instruction|message|context|template)\s*[:=]\s*`([^`]{50,})`/gis;
// Matches long standalone template literals likely to be prompts.
const LONG_TEMPLATE_RE = /`([^`]{120,})`/g;

function extractPromptsFromSource(src) {
  const found = new Set();

  // Named prompt variables first (highest signal)
  NAMED_PROMPT_RE.lastIndex = 0;
  let m;
  while ((m = NAMED_PROMPT_RE.exec(src)) !== null) {
    found.add(m[1].trim());
  }

  // Long template literals (lower signal — filter by alpha ratio)
  LONG_TEMPLATE_RE.lastIndex = 0;
  while ((m = LONG_TEMPLATE_RE.exec(src)) !== null) {
    const text       = m[1].trim();
    const alphaRatio = (text.match(/[a-zA-Z ]/g) || []).length / text.length;
    if (alphaRatio > 0.55) found.add(text);
  }

  return [...found];
}

function readFilePrompts(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let content;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_BYTES) return [];
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  // Source files: extract embedded prompt strings heuristically
  if (ext === '.ts' || ext === '.js') {
    return extractPromptsFromSource(content);
  }

  // Text / markdown / .prompt files: treat whole file as the prompt
  const trimmed = content.trim();
  return trimmed.length >= 10 ? [trimmed] : [];
}

// ── API ────────────────────────────────────────────────────────────────────────

async function analyzePrompt(promptText) {
  const url        = new URL('/api/v1/analyze', COSTGUARD_HOST).toString();
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 30_000);

  let resp;
  try {
    resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    API_KEY,
        'User-Agent':   'costguard-prompt-scan-action/1.0',
      },
      body:   JSON.stringify({ prompt: promptText }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('API request timed out (30s). Check network connectivity or costguardai.io/status.');
    }
    throw new Error(`Network error: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const raw = await resp.text().catch(() => resp.statusText);
    let detail = raw;
    try { detail = JSON.parse(raw).error || raw; } catch { /* noop */ }

    if (resp.status === 401) {
      throw new Error('Invalid API key (401). Verify COSTGUARD_API_KEY in Settings → Secrets → Actions.');
    }
    if (resp.status === 429) {
      throw new Error('Free tier limit reached (429). Upgrade at costguardai.io to continue scanning.');
    }
    if (resp.status >= 500) {
      throw new Error(`CostGuard server error (${resp.status}). Check costguardai.io/status.`);
    }
    throw new Error(`API error ${resp.status}: ${detail}`);
  }

  try {
    return await resp.json();
  } catch {
    throw new Error(`API returned malformed JSON (HTTP ${resp.status}).`);
  }
}

// ── Concurrency pool ───────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const pool = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(pool);
  return results;
}

// ── PR comment (idempotent) ────────────────────────────────────────────────────

const COMMENT_MARKER = '<!-- costguard-prompt-scan -->';

function extractPrNumber() {
  // refs/pull/123/merge
  const match = GITHUB_REF.match(/refs\/pull\/(\d+)\/merge/);
  return match ? match[1] : '';
}

async function postPrComment(body) {
  const prNumber = extractPrNumber();
  if (!GITHUB_TOKEN || !GITHUB_REPO || !prNumber) return;

  const headers = {
    Authorization:        `Bearer ${GITHUB_TOKEN}`,
    Accept:               'application/vnd.github+json',
    'Content-Type':       'application/json',
    'User-Agent':         'costguard-prompt-scan-action/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const baseUrl = `https://api.github.com/repos/${GITHUB_REPO}/issues/${prNumber}/comments`;

  // Find existing comment (idempotent)
  let existingId = null;
  try {
    const listResp = await fetch(`${baseUrl}?per_page=100`, { headers });
    if (listResp.ok) {
      const comments = await listResp.json();
      const match = comments.find(c => typeof c.body === 'string' && c.body.includes(COMMENT_MARKER));
      if (match) existingId = match.id;
    }
  } catch { /* noop */ }

  const payload = JSON.stringify({ body: `${COMMENT_MARKER}\n${body}` });
  try {
    if (existingId) {
      await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues/comments/${existingId}`, {
        method: 'PATCH', headers, body: payload,
      });
    } else {
      await fetch(baseUrl, { method: 'POST', headers, body: payload });
    }
  } catch { /* PR comment failure is non-fatal */ }
}

// ── Output ─────────────────────────────────────────────────────────────────────

function setOutput(name, value) {
  if (!OUTPUT_FILE) return;
  fs.appendFileSync(OUTPUT_FILE, `${name}=${value}\n`, 'utf8');
}

function fmtCost(n) {
  if (typeof n !== 'number') return 'n/a';
  return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error('::error::CostGuard: api_key input is required.');
    process.exit(2);
  }

  const absPath = path.resolve(WORKSPACE, SCAN_PATH);

  console.log('\nCostGuard Prompt Scan');
  console.log('─────────────────────────────────────────');
  console.log(`Scanning:  ${absPath}`);
  console.log(`Threshold: ${THRESHOLD}`);
  console.log('');

  // 1. Discover files
  const files = walkDir(absPath);
  if (files.length === 0) {
    console.log('No prompt files found. Scan complete.');
    setOutput('highest_risk_score', '0');
    setOutput('scanned_files', '0');
    setOutput('blocked', 'false');
    process.exit(0);
  }
  console.log(`Found ${files.length} file(s).`);

  // 2. Extract prompts
  const tasks = [];
  for (const file of files) {
    const prompts = readFilePrompts(file);
    for (const prompt of prompts) {
      tasks.push({ file, prompt });
    }
  }

  if (tasks.length === 0) {
    console.log('No extractable prompts found. Scan complete.');
    setOutput('highest_risk_score', '0');
    setOutput('scanned_files', String(files.length));
    setOutput('blocked', 'false');
    process.exit(0);
  }
  console.log(`Analyzing ${tasks.length} prompt(s) via CostGuard API...`);

  // 3. Run analysis (concurrent)
  const apiTasks = tasks.map(({ file, prompt }) => async () => {
    try {
      const data = await analyzePrompt(prompt);
      return { file, data, error: null };
    } catch (err) {
      return { file, data: null, error: err.message };
    }
  });

  const results = await runWithConcurrency(apiTasks, CONCURRENCY);

  // 4. Aggregate
  let highestScore = 0;
  let blockedCount = 0;
  const reportLines = [];

  for (const { file, data, error } of results) {
    const rel = path.relative(WORKSPACE, file);

    if (error) {
      reportLines.push(`- **${rel}**: API error — ${error}`);
      console.log(`  ${rel}: ERROR — ${error}`);
      continue;
    }

    const score    = typeof data.risk_score === 'number' ? data.risk_score : 0;
    const risk     = typeof data.risk === 'string' ? data.risk : 'UNKNOWN';
    const cost1k   = fmtCost(data.estimated_cost_per_1k_calls);
    const drivers  = Array.isArray(data.explanation?.top_risk_drivers)
      ? data.explanation.top_risk_drivers.slice(0, 3)
      : [];
    const shareUrl = typeof data.share_url === 'string' ? data.share_url : null;

    if (score > highestScore) highestScore = score;
    if (score >= THRESHOLD)   blockedCount++;

    const badge = score >= THRESHOLD ? '🚫' : '✅';
    reportLines.push(`${badge} **${rel}**`);
    reportLines.push(`  - Risk Score: \`${score}\` (${risk})  |  Cost / 1k calls: ${cost1k}`);
    if (drivers.length > 0) {
      reportLines.push(`  - Top Risks: ${drivers.map(d => `\`${d}\``).join(', ')}`);
    }
    if (shareUrl) reportLines.push(`  - [Full report](${shareUrl})`);

    console.log(`  ${rel}: score=${score} (${risk}) cost/1k=${cost1k}`);
  }

  // If every prompt failed due to API errors (e.g. bad key, network down), treat
  // as a runtime error rather than silently passing with exit 0.
  const errorCount   = results.filter(r => r.error !== null).length;
  const successCount = results.length - errorCount;
  if (successCount === 0 && errorCount > 0) {
    const firstError = results.find(r => r.error)?.error ?? 'Unknown API error';
    console.error(`::error::CostGuard: All ${errorCount} API request(s) failed. First error: ${firstError}`);
    process.exit(2);
  }

  const blocked = blockedCount > 0;

  // 5. Console summary
  console.log('');
  console.log(`Highest Risk Score: ${highestScore}`);
  console.log(`Files Scanned:      ${files.length}`);
  console.log(`Threshold:          ${THRESHOLD}`);
  if (blocked) {
    console.log(`Status:             BLOCKED — ${blockedCount} prompt(s) exceeded threshold`);
  } else {
    console.log(`Status:             PASSED`);
  }
  console.log('─────────────────────────────────────────');

  // 6. PR comment
  const statusIcon  = blocked ? '🚫' : '✅';
  const statusLabel = blocked
    ? `Deployment blocked — ${blockedCount} prompt(s) exceeded risk threshold (${THRESHOLD})`
    : `All prompts passed (highest score: ${highestScore} / threshold: ${THRESHOLD})`;

  const commentBody = [
    `## ${statusIcon} CostGuard Scan Results`,
    '',
    `**Status:** ${statusLabel}`,
    `**Highest Risk Score:** \`${highestScore}\``,
    `**Files Scanned:** ${files.length}`,
    `**Threshold:** ${THRESHOLD}`,
    '',
    '### Results by File',
    '',
    ...reportLines,
    '',
    '---',
    '_Powered by [CostGuard](https://costguardai.io) — AI cost & risk optimization for developers._',
  ].join('\n');

  await postPrComment(commentBody);

  // 7. Outputs
  setOutput('highest_risk_score', String(highestScore));
  setOutput('scanned_files', String(files.length));
  setOutput('blocked', blocked ? 'true' : 'false');

  // 8. Exit
  if (blocked) {
    console.log('');
    console.error(`::error::Deployment blocked by CostGuard. Risk score ${highestScore} exceeds threshold ${THRESHOLD}.`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('::error::CostGuard scan error:', err.message);
  process.exit(2);
});
