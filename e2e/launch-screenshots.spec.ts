/**
 * launch-screenshots.spec.ts
 *
 * Generates launch-quality screenshots from the actual rendered pages.
 * Output: screenshots/ folder (gitignored for build artifacts; commit selectively).
 *
 * Usage:
 *   pnpm e2e -- --grep "launch-screenshots"
 *   # or with a running dev server:
 *   BASE_URL=http://localhost:3000 pnpm e2e -- --grep "launch-screenshots"
 *
 * Captures:
 *   1. /examples — full-page desktop
 *   2. /examples — hero + credibility panel (above-the-fold)
 *   3. /examples — first disaster example section
 *   4. / — homepage disaster gallery card
 */

import { test } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const SCREENSHOTS_DIR = join(process.cwd(), "screenshots");

test.beforeAll(() => {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

test.describe("launch-screenshots", () => {
  test("examples — full page desktop", async ({ page }) => {
    await page.goto("/examples", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "examples__full__desktop.png"),
      fullPage: true,
    });
  });

  test("examples — hero and credibility panel", async ({ page }) => {
    await page.goto("/examples", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    // Capture top 900px — hero + credibility panel
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "examples__hero_credibility.png"),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });
  });

  test("examples — first disaster example section", async ({ page }) => {
    await page.goto("/examples", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const firstExample = page.locator("[id='agent-loop']").first();
    if ((await firstExample.count()) > 0) {
      await firstExample.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
    }
    // Capture mid-page section showing before/after cards
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "examples__first_disaster.png"),
      clip: { x: 0, y: 700, width: 1440, height: 900 },
    });
  });

  test("homepage — disaster gallery card", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    // The gallery card sits between trust section and main content
    // Capture area just below the trust bar
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "homepage__disaster_gallery_card.png"),
      clip: { x: 0, y: 550, width: 1440, height: 280 },
    });
  });

  test("methodology — full page desktop", async ({ page }) => {
    await page.goto("/methodology", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "methodology__full__desktop.png"),
      fullPage: true,
    });
  });

  test("vulnerabilities — full page desktop", async ({ page }) => {
    await page.goto("/vulnerabilities", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "vulnerabilities__full__desktop.png"),
      fullPage: true,
    });
  });

  test("report/demo — full page desktop", async ({ page }) => {
    await page.goto("/report/demo", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "report_demo__full__desktop.png"),
      fullPage: true,
    });
  });
});
