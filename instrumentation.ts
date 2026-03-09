/**
 * Next.js instrumentation hook — runs once on server startup.
 * Validates required environment variables before the first request is served.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env/validate-env");
    validateEnv();
  }
}
