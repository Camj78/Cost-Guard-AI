#!/usr/bin/env node
/**
 * Golden fixture test for CostGuard CLI.
 * Runs the CLI on each fixture and compares JSON output to expected files.
 * Usage: node packages/cli/scripts/test-golden.mjs
 */

import { execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../../../");
const cliPath = join(__dirname, "../dist/bin.js");
const fixturesDir = join(projectRoot, "fixtures/cli");

// Strict deep equality — throws with path on mismatch
function assertEqual(actual, expected, path = "") {
  if (typeof actual !== typeof expected) {
    throw new Error(`Type mismatch at "${path}": got ${typeof actual}, want ${typeof expected}`);
  }
  if (actual === null || expected === null) {
    if (actual !== expected) throw new Error(`Null mismatch at "${path}": ${actual} vs ${expected}`);
    return;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      throw new Error(`Array length mismatch at "${path}": got ${actual.length}, want ${expected.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
      assertEqual(actual[i], expected[i], `${path}[${i}]`);
    }
    return;
  }
  if (typeof actual === "object") {
    const keysA = Object.keys(actual).sort();
    const keysE = Object.keys(expected).sort();
    if (keysA.join(",") !== keysE.join(",")) {
      throw new Error(`Key mismatch at "${path}": got [${keysA}], want [${keysE}]`);
    }
    for (const k of keysA) {
      assertEqual(actual[k], expected[k], path ? `${path}.${k}` : k);
    }
    return;
  }
  if (actual !== expected) {
    throw new Error(`Value mismatch at "${path}": got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}

const fixtures = [
  { label: "minimal", input: "minimal.txt", expected: "minimal.expected.json" },
  { label: "risky",   input: "risky.txt",   expected: "risky.expected.json" },
];

let passed = 0;
let failed = 0;
let skipped = 0;

if (!existsSync(cliPath)) {
  console.error(`CLI not built: ${cliPath}`);
  console.error("Run: npm run build  (in packages/cli/)");
  process.exit(1);
}

for (const { label, input, expected } of fixtures) {
  const inputPath = join(fixturesDir, input);
  const expectedPath = join(fixturesDir, expected);

  if (!existsSync(expectedPath)) {
    console.log(`SKIP  ${label} — expected file missing (${expected})`);
    skipped++;
    continue;
  }

  let actual;
  try {
    const stdout = execFileSync(process.execPath, [cliPath, "analyze", inputPath, "--json"], {
      encoding: "utf8",
      cwd: projectRoot,
    });
    actual = JSON.parse(stdout);
  } catch (err) {
    console.error(`FAIL  ${label} — CLI error: ${err.message}`);
    failed++;
    continue;
  }

  const expectedData = JSON.parse(readFileSync(expectedPath, "utf8"));

  try {
    assertEqual(actual, expectedData);
    console.log(`PASS  ${label}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${label} — ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
