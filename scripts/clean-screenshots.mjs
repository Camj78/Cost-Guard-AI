#!/usr/bin/env node
/**
 * clean-screenshots.mjs
 * Wipe temporary_screenshots/ and recreate it empty.
 *
 * Usage: node scripts/clean-screenshots.mjs
 */

import { existsSync, readdirSync, rmSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR   = resolve(__dirname, '..', 'temporary_screenshots');

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('[clean] temporary_screenshots/ created (was empty)');
  process.exit(0);
}

const files = readdirSync(OUT_DIR);
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

console.log(`[clean] removed ${files.length} file(s) from temporary_screenshots/`);
