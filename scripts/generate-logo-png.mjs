/**
 * Generates public/logo.png from public/logo.svg using Puppeteer.
 * Run once: node scripts/generate-logo-png.mjs
 */
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const svgContent = readFileSync(join(ROOT, 'public/logo.svg'), 'utf8');
const b64 = Buffer.from(svgContent).toString('base64');

const SIZE = 128; // 128×128 for email-client clarity (4× the 32px viewBox)

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
await page.setContent(`<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:#0d1117;">
  <img src="data:image/svg+xml;base64,${b64}"
       width="${SIZE}" height="${SIZE}"
       style="display:block;" />
</body>
</html>`);

await page.screenshot({
  path: join(ROOT, 'public/logo.png'),
  clip: { x: 0, y: 0, width: SIZE, height: SIZE },
  omitBackground: false,
});

await browser.close();
console.log(`✓ public/logo.png written (${SIZE}×${SIZE}px)`);
