import { createClient } from "@supabase/supabase-js";

// Service role client — use ONLY in server-side handlers (bypasses RLS).
// Lazy factory: client is created at call time, never at module import.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}
