#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args[0] !== 'analyze' || !args[1]) {
  console.error('Usage: costguard analyze <prompt-file> --api-key <key> [--host <url>] [--model <id>] [--requests <n>]');
  console.error('');
  console.error('Options:');
  console.error('  --api-key   API key (or set COSTGUARD_API_KEY env var)');
  console.error('  --host      Base URL (default: https://costguardai.io)');
  console.error('  --model     Model ID (default: gpt-4o-mini)');
  console.error('  --requests  Requests/month for monthly cost estimate (default: 1000)');
  process.exit(1);
}

const filePath = args[1];

let host = 'https://costguardai.io';
let apiKey = process.env.COSTGUARD_API_KEY || '';
let model = null;
let requestsPerMonth = null;

for (let i = 2; i < args.length; i++) {
  const a = args[i];
  if ((a === '--host' || a === '-h') && args[i + 1])        { host = args[++i]; }
  else if ((a === '--api-key' || a === '-k') && args[i + 1]){ apiKey = args[++i]; }
  else if ((a === '--model' || a === '-m') && args[i + 1])  { model = args[++i]; }
  else if ((a === '--requests') && args[i + 1])             { requestsPerMonth = parseInt(args[++i], 10); }
  else if (a.startsWith('--api-key='))  { apiKey = a.slice(10); }
  else if (a.startsWith('--host='))     { host = a.slice(7); }
  else if (a.startsWith('--model='))    { model = a.slice(8); }
  else if (a.startsWith('--requests=')){ requestsPerMonth = parseInt(a.slice(11), 10); }
}

if (!apiKey) {
  console.error('Error: API key required. Pass --api-key <key> or set COSTGUARD_API_KEY.');
  process.exit(1);
}

// ── Read prompt file ──────────────────────────────────────────────────────────

let promptText;
try {
  promptText = fs.readFileSync(path.resolve(filePath), 'utf8');
} catch {
  console.error(`Error: Cannot read file: ${filePath}`);
  process.exit(1);
}

// ── API call ──────────────────────────────────────────────────────────────────

const endpoint = new URL('/api/v1/analyze', host).toString();

const requestBody = { prompt: promptText };
if (model) requestBody.model = model;
if (requestsPerMonth) requestBody.requests_per_month = requestsPerMonth;

async function run() {
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error(`Error: Could not reach ${endpoint}`);
    console.error(err.message);
    process.exit(1);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text).error || text; } catch {}
    console.error(`Error ${response.status}: ${detail}`);
    process.exit(1);
  }

  const data = await response.json();

  // ── Format output ────────────────────────────────────────────────────────────

  function fmtCost(n) {
    if (typeof n !== 'number') return 'n/a';
    return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
  }

  const monthlyCost = fmtCost(data.estimated_monthly_cost);
  const truncation  = typeof data.risk_score === 'number'
    ? `${data.risk_score}%`
    : 'n/a';

  console.log('');
  console.log('CostGuardAI Report');
  console.log('');
  console.log(`Risk:                ${data.risk ?? 'n/a'}`);
  console.log(`Estimated Cost:      ${monthlyCost}`);
  console.log(`Truncation Risk:     ${truncation}`);
  console.log(`Score Version:       ${data.score_version ?? 'n/a'}`);
  console.log('');
  console.log(`Recommended Model:   ${data.recommended_model ?? 'n/a'}`);
  console.log('');

  if (data.explanation) {
    const ex = data.explanation;
    console.log(`Summary: ${ex.summary}`);
    console.log('');
    if (Array.isArray(ex.top_risk_drivers) && ex.top_risk_drivers.length > 0) {
      console.log('Top Risk Drivers:');
      for (const d of ex.top_risk_drivers) {
        console.log(`  - ${d}`);
      }
      console.log('');
    }
    if (Array.isArray(ex.mitigation_suggestions) && ex.mitigation_suggestions.length > 0) {
      console.log('Mitigations:');
      for (const s of ex.mitigation_suggestions) {
        console.log(`  - ${s}`);
      }
      console.log('');
    }
  }

  if (data.share_url) {
    console.log(`Share: ${data.share_url}`);
  }
  console.log('');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
