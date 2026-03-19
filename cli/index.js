#!/usr/bin/env node

'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

// ── Replay manifest helpers ───────────────────────────────────────────────────

function getReplayDir() {
  return path.join(os.homedir(), '.costguard', 'replays');
}

function saveReplayManifest(manifest) {
  const dir = getReplayDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, manifest.analysis_id + '.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
  return filePath;
}

function loadReplayManifest(analysisId) {
  const filePath = path.join(getReplayDir(), analysisId + '.json');
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

// ── Usage ─────────────────────────────────────────────────────────────────────

function printUsage() {
  console.error('Usage:');
  console.error('  costguard analyze <prompt-file> --api-key <key> [--host <url>] [--model <id>] [--requests <n>]');
  console.error('  costguard ci      <prompt-file> --api-key <key> [--host <url>] [--model <id>] [--requests <n>] [--fail-on-risk <n>] [--json]');
  console.error('  costguard replay  <analysis-id> --api-key <key> [--host <url>]');
  console.error('');
  console.error('Options:');
  console.error('  --api-key       API key (or set COSTGUARD_API_KEY env var)');
  console.error('  --host          Base URL (default: https://costguardai.io)');
  console.error('  --model         Model ID (default: gpt-4o-mini)');
  console.error('  --requests      Requests/month for monthly cost estimate (default: 1000)');
  console.error('  --fail-on-risk  [ci only] Exit 1 if risk score > threshold');
  console.error('  --json          [ci only] Output JSON instead of human-readable text');
  console.error('');
  console.error('Exit codes (ci / replay):');
  console.error('  0  Pass (risk below threshold or replay match)');
  console.error('  1  Risk threshold exceeded, or replay mismatch / version mismatch');
  console.error('  2  CLI or runtime error');
}

// ── Argument parsing ──────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const command = args[0]; // 'analyze', 'ci', or 'replay'

if (command !== 'analyze' && command !== 'ci' && command !== 'replay') {
  printUsage();
  process.exit(2);
}

// args[1] = prompt-file (analyze/ci) OR analysis-id (replay)
const positionalArg = args[1];
if (!positionalArg) {
  printUsage();
  process.exit(2);
}

let host             = 'https://costguardai.io';
let apiKey           = process.env.COSTGUARD_API_KEY || '';
let model            = null;
let requestsPerMonth = null;
let failOnRisk       = null;
let jsonOutput       = false;

for (let i = 2; i < args.length; i++) {
  const a = args[i];
  if ((a === '--host' || a === '-h') && args[i + 1])         { host = args[++i]; }
  else if ((a === '--api-key' || a === '-k') && args[i + 1]) { apiKey = args[++i]; }
  else if ((a === '--model' || a === '-m') && args[i + 1])   { model = args[++i]; }
  else if (a === '--requests' && args[i + 1])                 { requestsPerMonth = parseInt(args[++i], 10); }
  else if (a === '--fail-on-risk' && args[i + 1])             { failOnRisk = parseInt(args[++i], 10); }
  else if (a === '--json')                                     { jsonOutput = true; }
  else if (a.startsWith('--api-key='))                        { apiKey = a.slice(10); }
  else if (a.startsWith('--host='))                           { host = a.slice(7); }
  else if (a.startsWith('--model='))                          { model = a.slice(8); }
  else if (a.startsWith('--requests='))                       { requestsPerMonth = parseInt(a.slice(11), 10); }
  else if (a.startsWith('--fail-on-risk='))                   { failOnRisk = parseInt(a.slice(15), 10); }
}

if (!apiKey) {
  console.error('Error: API key required. Pass --api-key <key> or set COSTGUARD_API_KEY.');
  process.exit(2);
}

const endpoint = new URL('/api/v1/analyze', host).toString();

// ── Shared: call API ──────────────────────────────────────────────────────────

async function callApi(promptText, modelOverride) {
  const requestBody = { prompt: promptText };
  if (modelOverride) requestBody.model = modelOverride;
  if (requestsPerMonth) requestBody.requests_per_month = requestsPerMonth;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error(`Error: Could not reach ${endpoint}`);
    console.error(err.message);
    process.exit(2);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text).error || text; } catch {}
    console.error(`Error ${response.status}: ${detail}`);
    process.exit(2);
  }

  return response.json();
}

// ── replay command ────────────────────────────────────────────────────────────

async function runReplay() {
  const analysisId = positionalArg;
  const manifest   = loadReplayManifest(analysisId);

  if (!manifest) {
    console.error(`Error: No replay manifest found for analysis ID: ${analysisId}`);
    console.error(`Expected: ${path.join(getReplayDir(), analysisId + '.json')}`);
    console.error('Run "costguard analyze" or "costguard ci" first to save a replay manifest.');
    process.exit(2);
  }

  if (!manifest.prompt_text) {
    console.error('Error: Replay manifest is missing prompt_text. Cannot re-run analysis.');
    process.exit(2);
  }

  console.log('');
  console.log('CostGuardAI Replay');
  console.log('─────────────────────────────────────────');
  console.log(`Analysis ID:       ${manifest.analysis_id}`);
  console.log(`Analysis Version:  ${manifest.analysis_version}`);
  console.log(`Score Version:     ${manifest.score_version}`);
  console.log(`Model:             ${manifest.model_id}`);
  console.log(`Stored Score:      ${manifest.stored_result.risk_score} (${manifest.stored_result.risk_level})`);
  console.log('');
  console.log('Re-running analysis...');

  const data = await callApi(manifest.prompt_text, manifest.model_id);

  // Version gate — fail if engine versions differ
  const storedAnalysisVer = manifest.analysis_version ?? 'unknown';
  const storedScoreVer    = manifest.score_version    ?? 'unknown';
  const newAnalysisVer    = data.analysis_version     ?? 'unknown';
  const newScoreVer       = data.score_version        ?? 'unknown';

  if (storedAnalysisVer !== newAnalysisVer || storedScoreVer !== newScoreVer) {
    console.log('');
    console.log('Replay mismatch detected — version change');
    console.log(`  Stored:  analysis_version=${storedAnalysisVer}  score_version=${storedScoreVer}`);
    console.log(`  Current: analysis_version=${newAnalysisVer}  score_version=${newScoreVer}`);
    console.log('─────────────────────────────────────────');
    console.log('');
    process.exit(1);
  }

  // Ruleset gate
  if (manifest.ruleset_hash && data.ruleset_hash && manifest.ruleset_hash !== data.ruleset_hash) {
    console.log('');
    console.log('Replay mismatch detected — ruleset changed');
    console.log(`  Stored:  ${manifest.ruleset_hash}`);
    console.log(`  Current: ${data.ruleset_hash}`);
    console.log('─────────────────────────────────────────');
    console.log('');
    process.exit(1);
  }

  // Output comparison
  const storedScore   = manifest.stored_result.risk_score;
  const storedLevel   = (manifest.stored_result.risk_level ?? '').toLowerCase();
  const newScore      = typeof data.risk_score === 'number' ? data.risk_score : null;
  const newLevel      = typeof data.risk        === 'string' ? data.risk.toLowerCase() : '';
  const storedDrivers = [...(manifest.stored_result.top_risk_drivers ?? [])].sort();
  const newDrivers    = [...(data.explanation?.top_risk_drivers ?? [])].sort();
  const scoreMatch    = storedScore === newScore;
  const levelMatch    = storedLevel === newLevel;
  const driversMatch  = JSON.stringify(storedDrivers) === JSON.stringify(newDrivers);

  console.log('');
  console.log('Result comparison:');
  console.log(`  risk_score:   stored=${storedScore}  current=${newScore}  ${scoreMatch   ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  risk_level:   stored=${storedLevel}  current=${newLevel}  ${levelMatch   ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  top_drivers:  ${driversMatch ? 'MATCH' : 'MISMATCH'}`);

  if (!scoreMatch || !levelMatch || !driversMatch) {
    console.log('');
    console.log('Replay mismatch detected');
    console.log('─────────────────────────────────────────');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log('Replay successful — outputs match');
  console.log('─────────────────────────────────────────');
  console.log('');
  process.exit(0);
}

// ── analyze / ci commands ─────────────────────────────────────────────────────

async function runAnalyzeOrCi() {
  const filePath = positionalArg;
  let promptText;
  try {
    promptText = fs.readFileSync(path.resolve(filePath), 'utf8');
  } catch {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(2);
  }

  const data = await callApi(promptText, model);

  // Extract trust fields (with safe fallbacks for older API versions)
  const analysisId      = data.analysis_id      ?? crypto.randomUUID();
  const analysisVersion = data.analysis_version  ?? '1.0.0';
  const scoreVersion    = data.score_version      ?? 'v1.0';
  const rulesetHash     = data.ruleset_hash       ?? null;
  const inputHash       = data.input_hash         ?? null;
  const riskBand        = data.risk               ? String(data.risk) : 'UNKNOWN';
  const score           = typeof data.risk_score === 'number' ? data.risk_score : null;
  const topDrivers      = Array.isArray(data.explanation?.top_risk_drivers)
    ? data.explanation.top_risk_drivers : [];

  // Persist replay manifest to ~/.costguard/replays/<id>.json
  const manifest = {
    analysis_id:      analysisId,
    created_at:       new Date().toISOString(),
    analysis_version: analysisVersion,
    score_version:    scoreVersion,
    ruleset_hash:     rulesetHash,
    input_hash:       inputHash,
    model_id:         data.model ?? model ?? 'gpt-4o-mini',
    prompt_text:      promptText,
    stored_result: {
      risk_score:          score,
      risk_level:          riskBand.toLowerCase(),
      explanation_summary: data.explanation?.summary ?? null,
      top_risk_drivers:    topDrivers,
    },
  };
  const manifestPath = saveReplayManifest(manifest);

  // ── analyze ───────────────────────────────────────────────────────────────

  if (command === 'analyze') {
    printAnalyzeReport(data, analysisId, manifestPath);
    process.exit(0);
  }

  // ── ci ────────────────────────────────────────────────────────────────────

  const shareUrl = data.share_url ?? null;

  if (jsonOutput) {
    const out = {
      analysis_id:      analysisId,
      analysis_version: analysisVersion,
      score_version:    scoreVersion,
      ruleset_hash:     rulesetHash,
      input_hash:       inputHash,
      score,
      risk_band:        riskBand,
      top_drivers:      topDrivers,
      share_url:        shareUrl,
      replay_manifest:  manifestPath,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    printCiReport(score, riskBand, topDrivers, failOnRisk, analysisId);
  }

  if (failOnRisk !== null && score !== null && score > failOnRisk) {
    process.exit(1);
  }
  process.exit(0);
}

// ── Output formatters ─────────────────────────────────────────────────────────

function fmtCost(n) {
  if (typeof n !== 'number') return 'n/a';
  return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function printAnalyzeReport(data, analysisId, manifestPath) {
  const costPer1k   = fmtCost(data.estimated_cost_per_1k_calls);
  const monthlyCost = fmtCost(data.estimated_monthly_cost);
  const riskScore   = typeof data.risk_score === 'number' ? String(data.risk_score) : 'n/a';

  console.log('');
  console.log('CostGuardAI Report');
  console.log('');
  console.log(`Risk:                ${data.risk ?? 'n/a'}`);
  console.log(`CostGuardAI Safety Score: ${riskScore}`);
  console.log(`Score Version:       ${data.score_version ?? 'n/a'}`);
  console.log('');
  console.log('Estimated Cost Impact');
  console.log(`  Per 1k calls:      ${costPer1k}`);
  console.log(`  Monthly (100k):    ${monthlyCost}`);
  console.log('');
  console.log(`Recommended Model:   ${data.recommended_model ?? 'n/a'}`);
  console.log('');

  if (data.explanation) {
    const ex = data.explanation;
    console.log(`Summary: ${ex.summary}`);
    console.log('');
    if (Array.isArray(ex.top_risk_drivers) && ex.top_risk_drivers.length > 0) {
      console.log('Top Risk Drivers:');
      for (const d of ex.top_risk_drivers) { console.log(`  - ${d}`); }
      console.log('');
    }
    if (Array.isArray(ex.mitigation_suggestions) && ex.mitigation_suggestions.length > 0) {
      console.log('Mitigations:');
      for (const s of ex.mitigation_suggestions) { console.log(`  - ${s}`); }
      console.log('');
    }
  }

  if (data.share_url) { console.log(`Share: ${data.share_url}`); }

  console.log('');
  console.log('Add this badge to your repo:');
  console.log('[![CostGuardAI Safety](https://costguardai.io/badge.svg)](https://costguardai.io)');
  console.log('');
  console.log(`Analysis ID:         ${analysisId}`);
  console.log(`Analysis Version:    ${data.analysis_version ?? 'n/a'}`);
  console.log(`Input Hash:          ${data.input_hash ?? 'n/a'}`);
  console.log(`Replay:              costguard replay ${analysisId}`);
  console.log(`Manifest:            ${manifestPath}`);
  console.log('');
}

function printCiReport(score, riskBand, topDrivers, threshold, analysisId) {
  const scoreStr          = score !== null ? String(score) : 'n/a';
  const thresholdExceeded = threshold !== null && score !== null && score > threshold;

  console.log('');
  console.log('CostGuardAI CI Report');
  console.log('─────────────────────────────────────────');
  console.log(`RiskScore: ${scoreStr} (${riskBand})`);

  if (topDrivers.length > 0) {
    console.log('');
    console.log('Top Drivers:');
    topDrivers.slice(0, 3).forEach((d, i) => { console.log(`  ${i + 1}. ${d}`); });
  }

  console.log('');
  if (threshold !== null) {
    const label = thresholdExceeded
      ? `FAIL (threshold ${threshold} exceeded)`
      : `PASS (below threshold ${threshold})`;
    console.log(`CI status: ${label}`);
  } else {
    console.log('CI status: PASS');
  }

  if (analysisId) { console.log(`Replay ID: ${analysisId}`); }
  console.log('─────────────────────────────────────────');
  console.log('');
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (command === 'replay') {
  runReplay().catch((err) => {
    console.error('Error:', err.message);
    process.exit(2);
  });
} else {
  runAnalyzeOrCi().catch((err) => {
    console.error('Error:', err.message);
    process.exit(2);
  });
}
