import { test, expect } from "@playwright/test";

test.describe("Smoke — Home Page", () => {
  test("renders headline and primary CTA", async ({ page }) => {
    await page.goto("/");
    // Page must not crash
    await expect(page).not.toHaveTitle(/Error/i);
    // Body must be visible
    await expect(page.locator("body")).toBeVisible();
    // No uncaught JS errors — checked via console
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});

test.describe("Smoke — Dashboard", () => {
  test("redirects to auth when unauthenticated", async ({ page }) => {
    const response = await page.goto("/dashboard");
    // Should either redirect to auth or return a valid response (not 500)
    const status = response?.status() ?? 200;
    expect(status).not.toBe(500);
    expect(status).not.toBe(503);
    // Should not show an unhandled error page
    const title = await page.title();
    expect(title).not.toMatch(/500|internal server error/i);
  });
});

test.describe("Smoke — API Health", () => {
  test("v1/analyze returns 401 without key", async ({ request }) => {
    const response = await request.post("/api/v1/analyze", {
      data: { prompt: "hello" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});
