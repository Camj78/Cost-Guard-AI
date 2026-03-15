import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: ReturnType<typeof createClient<any>> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): ReturnType<typeof createClient<any>> {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

/**
 * Log a 5xx server error to request_logs.
 * Fire-and-forget: never throws, does not block the response path.
 * Logs only metadata — no prompts, no payloads.
 */
export async function logRequestError(
  route: string,
  statusCode: number,
  source?: string
): Promise<void> {
  try {
    const admin = getAdmin();
    await admin.from("request_logs").insert({
      route,
      status_code: statusCode,
      source: source ?? null,
    });
  } catch {
    // Non-blocking telemetry: silently discard errors
  }
}
