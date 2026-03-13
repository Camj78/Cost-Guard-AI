import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Admin client (lazy singleton) ─────────────────────────────────────────────

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

// ── Prompt storage mode ───────────────────────────────────────────────────────

export type PromptStorageMode = "hash" | "redacted" | "full";

function getStorageMode(): PromptStorageMode {
  const mode = process.env.COSTGUARD_PROMPT_STORAGE ?? "hash";
  if (mode === "redacted" || mode === "full") return mode as PromptStorageMode;
  return "hash";
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AiUsageEventInput {
  endpoint: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  env?: string;
  orgId?: string | null;
  projectId?: string | null;
  promptText?: string;
}

/**
 * Record a single AI analysis call.
 * Fire-and-forget: never throws, does not block the response path.
 *
 * Prompt storage is controlled by COSTGUARD_PROMPT_STORAGE env var:
 *   hash     (default) — SHA-256 of prompt stored; preview is null
 *   redacted            — hash stored; preview = "[redacted]"
 *   full                — hash stored; preview = first 500 chars of prompt
 */
export async function recordAiUsageEvent(
  input: AiUsageEventInput
): Promise<void> {
  try {
    const admin = getAdmin();
    const mode = getStorageMode();

    let promptHash: string | null = null;
    let promptPreview: string | null = null;

    if (input.promptText) {
      promptHash = await sha256hex(input.promptText);
      if (mode === "full") {
        promptPreview = input.promptText.slice(0, 500);
      } else if (mode === "redacted") {
        promptPreview = "[redacted]";
      }
    }

    const env =
      input.env ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "production";

    await admin.from("ai_usage_events").insert({
      ts: new Date().toISOString(),
      org_id: input.orgId ?? null,
      project_id: input.projectId ?? null,
      endpoint: input.endpoint,
      model: input.model,
      tokens_in: input.tokensIn,
      tokens_out: input.tokensOut,
      latency_ms: input.latencyMs,
      env,
      prompt_hash: promptHash,
      prompt_preview: promptPreview,
    });
  } catch {
    // Non-blocking telemetry: silently discard errors
  }
}
