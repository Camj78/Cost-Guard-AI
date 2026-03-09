/**
 * Environment variable validation.
 *
 * Call validateEnv() at server startup (e.g. instrumentation.ts) to surface
 * missing configuration before the first request is served.
 *
 * Throws with a descriptive message so CI/deployment pipelines can catch
 * misconfiguration early rather than producing cryptic runtime errors.
 */

const REQUIRED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
] as const;

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const missing = REQUIRED_SERVER_ENV.filter((name) => !process.env[name]);

  if (missing.length === 0) return;

  const messages = missing.map((name) => `Missing required environment variable: ${name}`);

  if (isProd) {
    throw new Error(messages.join("\n"));
  } else {
    for (const msg of messages) {
      console.warn(`[CostGuard] ${msg}`);
    }
  }
}
