import { createClient } from "@supabase/supabase-js";

export interface ApiKeyRecord {
  id: string;
  plan: string;
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

const FREE_TIER_MONTHLY_LIMIT = 100;

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
 * Verify an API key by hashing it and checking against api_keys table.
 * Returns null if the key is missing, unknown, or revoked.
 */
export async function verifyApiKey(key: string): Promise<ApiKeyRecord | null> {
  if (!key) return null;

  try {
    const admin = getAdminClient();
    if (!admin) return null;

    const keyHash = await hashKey(key);

    const { data, error } = await admin
      .from("api_keys")
      .select("id, plan")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (error || !data) return null;

    return { id: data.id as string, plan: data.plan as string };
  } catch {
    return null;
  }
}
