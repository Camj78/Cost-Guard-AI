import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — deferred until first call to avoid module-level init during build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: SupabaseClient<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): SupabaseClient<any> {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

export async function recordAnalysisRun(data: {
  runId: string;
  userId?: string | null;
  plan: "free" | "pro";
  model: string;

  inputTokens: number;
  outputTokens: number;
  cost: number;

  latencyMs: number;
  truncated: boolean;
  compressionUsed: boolean;
}) {
  try {
    await getAdmin().from("analysis_runs").insert(data);
  } catch (err) {
    console.error("Telemetry insert failed:", err);
  }
}
