import { createClient } from "@supabase/supabase-js";

export interface ApiKeyRecord {
  id: string;
  plan: string;
  user_id: string | null;
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const FREE_TIER_MONTHLY_LIMIT = 25;

/**
 * Check whether a free-tier API key has exceeded its monthly analysis limit.
 * Counts calls in ai_usage_events for the current calendar month (UTC).
 * Fails open (returns allowed=true) if the admin client is unavailable.
 */
export async function checkFreeTierLimit(
  keyId: string
): Promise<{ allowed: boolean; count: number }> {
  const admin = getAdminClient();
  if (!admin) return { allowed: true, count: 0 };

  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count } = await admin
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("org_id", keyId)
      .gte("ts", monthStart.toISOString());

    const n = count ?? 0;
    return { allowed: n < FREE_TIER_MONTHLY_LIMIT, count: n };
  } catch {
    return { allowed: true, count: 0 };
  }
}

/**
 * Resolve the founder's Supabase user_id.
 * Checks FOUNDER_USER_ID env first; falls back to email lookup via auth.admin.
 */
async function resolveFounderUserId(): Promise<string | null> {
  const fromEnv = process.env.FOUNDER_USER_ID ?? null;
  if (fromEnv) return fromEnv;

  const founderEmail = process.env.FOUNDER_EMAIL ?? "camjohnson78@gmail.com";
  try {
    const admin = getAdminClient();
    if (!admin) {
      console.error("[verifyApiKey] resolveFounderUserId: admin client unavailable — check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
      return null;
    }
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.error("[verifyApiKey] resolveFounderUserId: listUsers error:", error.message);
      return null;
    }
    const user = data?.users?.find((u) => u.email === founderEmail);
    if (!user) {
      console.error(`[verifyApiKey] resolveFounderUserId: no user found for email ${founderEmail} — set FOUNDER_USER_ID env var to fix CLI analysis_history writes`);
      return null;
    }
    return user.id;
  } catch (err) {
    console.error("[verifyApiKey] resolveFounderUserId: unexpected error:", err);
    return null;
  }
}

/**
 * Verify an API key.
 *
 * Priority:
 * 1. Env-key match (COSTGUARD_API_KEY) — maps to the founder account.
 *    Enables CLI/API runs to be attributed to the founder and written to
 *    analysis_history without requiring a database-backed api_keys table.
 * 2. Database lookup against api_keys table (for future multi-user keys).
 *
 * Returns null if the key is missing, unknown, or revoked.
 */
export async function verifyApiKey(key: string): Promise<ApiKeyRecord | null> {
  if (!key) return null;

  // ── 1. Env-key fallback (founder / CLI) ────────────────────────────────
  const envKey = process.env.COSTGUARD_API_KEY;
  if (envKey && key === envKey) {
    if (!process.env.FOUNDER_USER_ID) {
      console.error(
        "[verifyApiKey] FOUNDER_USER_ID is not set in environment. " +
        "CLI analysis_history writes WILL be skipped. " +
        "Fix: add FOUNDER_USER_ID=<your-supabase-uuid> to Vercel Environment Variables and redeploy."
      );
    }
    const founderId = await resolveFounderUserId();
    return { id: "founder", plan: "pro", user_id: founderId };
  }

  // ── 2. DB lookup (api_keys table) ──────────────────────────────────────
  try {
    const admin = getAdminClient();
    if (!admin) return null;

    const keyHash = await hashKey(key);

    const { data, error } = await admin
      .from("api_keys")
      .select("id, plan, user_id")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (error || !data) return null;

    return { id: data.id as string, plan: data.plan as string, user_id: (data.user_id as string | null) ?? null };
  } catch {
    return null;
  }
}
