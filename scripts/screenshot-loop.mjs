#!/usr/bin/env node
/**
 * screenshot-loop.mjs
 * Agent-driven screenshot capture + pixel diff tool.
 *
 * Usage:
 *   node scripts/screenshot-loop.mjs          # 1 pass
 *   PASSES=2 node scripts/screenshot-loop.mjs # 2 passes
 *
 * Env vars (all optional):
 *   BASE_URL        default: http://localhost:3000
 *   ROUTES          default: /,/dashboard   (comma-separated)
 *   SELECTORS       default: ""             (comma-separated CSS selectors)
 *   DIFF_THRESHOLD  default: 2              (percent)
 *   PASSES          default: 1
 *   WAIT_MS         default: 250            (ms after networkidle)
 *   WAIT_UNTIL      default: networkidle0
 */

import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- config ---
const BASE_URL       = process.env.BASE_URL       || 'http://localhost:3000';
const ROUTES         = (process.env.ROUTES        || '/,/dashboard').split(',').map(r => r.trim());
const SELECTORS      = (process.env.SELECTORS     || '').split(',').map(s => s.trim()).filter(Boolean);
const DIFF_THRESHOLD = parseFloat(process.env.DIFF_THRESHOLD || '2');
const PASSES         = parseInt(process.env.PASSES || '1', 10);
const WAIT_MS        = parseInt(process.env.WAIT_MS || '250', 10);
const WAIT_UNTIL     = process.env.WAIT_UNTIL || 'networkidle0';

const OUT_DIR     = join(ROOT, 'temporary_screenshots');
const TARGETS_DIR = join(ROOT, 'brand_assets', 'target_screens');

// --- helpers ---
function routeToSafe(route) {
  const stripped = route.replace(/^\//, '');
  if (!stripped) return 'root';
  return stripped.replace(/\//g, '__');
}

function selectorToSafe(selector) {
  return selector.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', 'T').split('.')[0];
}

function log(msg) {
  process.stdout.write(msg + '\n');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function diffImages(actualPath, targetPath, diffPath) {
  const { PNG } = await import('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;

  const actualBuf  = readFileSync(actualPath);
  const targetBuf  = readFileSync(targetPath);

  const actual  = PNG.sync.read(actualBuf);
  const target  = PNG.sync.read(targetBuf);

  const width  = Math.min(actual.width,  target.width);
  const height = Math.min(actual.height, target.height);

  const diff = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    actual.data,
    target.data,
    diff.data,
    width,
    height,
    { threshold: 0.1, includeAA: true }
  );

  writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  return (numDiffPixels / totalPixels) * 100;
}

// --- main ---
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const targetsExist = existsSync(TARGETS_DIR);
  const filesWritten = [];

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    for (let pass = 1; pass <= PASSES; pass++) {
      const ts       = timestamp();
      const passShot = {}; // route → filepath (for diff after pass 1)

      for (const route of ROUTES) {
        const safe = routeToSafe(route);
        const url  = BASE_URL + route;

        try {
          await page.goto(url, { waitUntil: WAIT_UNTIL, timeout: 30000 });
        } catch (err) {
          log(`[warn] pass ${pass}  ${route}  → failed to load: ${err.message}`);
          continue;
        }

        if (WAIT_MS > 0) await sleep(WAIT_MS);

        // full-page screenshot
        const fullName = `${safe}__pass${pass}__full__${ts}.png`;
        const fullPath = join(OUT_DIR, fullName);
        await page.screenshot({ path: fullPath, fullPage: true });
        filesWritten.push(fullName);
        passShot[route] = fullPath;
        log(`[shot] pass ${pass}  ${route.padEnd(20)} → ${fullName}`);

        // selector clips
        for (const selector of SELECTORS) {
          try {
            const el = await page.$(selector);
            if (!el) { log(`[warn] selector not found: ${selector}`); continue; }
            const safeSel  = selectorToSafe(selector);
            const selName  = `${safe}__pass${pass}__${safeSel}__${ts}.png`;
            const selPath  = join(OUT_DIR, selName);
            await el.screenshot({ path: selPath });
            filesWritten.push(selName);
            log(`[shot] pass ${pass}  ${route.padEnd(20)} → ${selName}`);
          } catch (err) {
            log(`[warn] selector "${selector}" error: ${err.message}`);
          }
        }
      }

      // diff vs targets after each pass (if targets exist)
      if (targetsExist) {
        for (const route of ROUTES) {
          const safe       = routeToSafe(route);
          const targetPath = join(TARGETS_DIR, `${safe}__target.png`);
          const actualPath = passShot[route];
          if (!actualPath || !existsSync(targetPath)) continue;

          try {
            const diffName = `${safe}__diff.png`;
            const diffPath = join(OUT_DIR, diffName);
            const pct      = await diffImages(actualPath, targetPath, diffPath);
            const pctStr   = pct.toFixed(1);
            const flag     = pct > DIFF_THRESHOLD ? `❌ (threshold ${DIFF_THRESHOLD}%) → ${diffName}` : '✓';
            log(`[diff] pass ${pass}  ${route.padEnd(20)} ${pctStr}% ${flag}`);
            if (!filesWritten.includes(diffName)) filesWritten.push(diffName);
          } catch (err) {
            log(`[warn] diff failed for ${route}: ${err.message}`);
          }
        }
      }

      if (pass === 1 && PASSES > 1) {
        log(`--- pass 1 complete; Claude applies fixes; starting pass 2 ---`);
      }
    }
  } finally {
    await browser.close();
  }

  log(`[done] ${filesWritten.length} file(s) written to temporary_screenshots/`);
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
