import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ── Admin client (bypasses RLS) ───────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyRow {
  day: string;
  model: string;
  calls: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens: number;
}

export interface TopPromptRow {
  prompt_hash: string;
  calls: number;
  tokens: number;
}

export interface TopModelRow {
  model: string;
  calls: number;
  total_tokens_in: number;
  total_tokens_out: number;
  tokens: number;
}

export interface ObsPayload {
  daily: DailyRow[];
  topPrompts: TopPromptRow[];
  topModels: TopModelRow[];
  totalCalls: number;
  totalTokens: number;
  filters: {
    models: string[];
    envs: string[];
    projects: string[];
  };
}

// ── GET /api/observability ────────────────────────────────────────────────────
// Query params:
//   days    = 7 | 30 | 90 (default 30)
//   model   = model id to filter (optional)
//   env     = env string (optional)
//   project = project_id string (optional)

export async function GET(req: Request) {
  // Auth: require signed-in user
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const daysRaw = parseInt(searchParams.get("days") ?? "30", 10);
  const days = [7, 30, 90].includes(daysRaw) ? daysRaw : 30;
  const modelFilter = searchParams.get("model") ?? null;
  const envFilter = searchParams.get("env") ?? null;
  const projectFilter = searchParams.get("project") ?? null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const admin = getAdmin();

  // Build base filter helper
  function applyFilters(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: any
  ) {
    query = query.gte("ts", since);
    if (modelFilter) query = query.eq("model", modelFilter);
    if (envFilter) query = query.eq("env", envFilter);
    if (projectFilter) query = query.eq("project_id", projectFilter);
    return query;
  }

  // ── 1. Daily rollup ──────────────────────────────────────────────────────────
  const dailyQuery = applyFilters(
    admin
      .from("ai_usage_events")
      .select("ts, model, tokens_in, tokens_out")
      .order("ts", { ascending: true })
  );

  const [dailyRes, topModelsRes, topPromptsRes, filterRes] = await Promise.all([
    dailyQuery,

    // top models (filtered)
    applyFilters(
      admin.from("ai_usage_events").select("model, tokens_in, tokens_out")
    ),

    // top prompts (filtered)
    applyFilters(
      admin
        .from("ai_usage_events")
        .select("prompt_hash, tokens_in, tokens_out")
        .not("prompt_hash", "is", null)
    ),

    // distinct filter values (unfiltered — always show all options)
    admin
      .from("ai_usage_events")
      .select("model, env, project_id")
      .gte("ts", since),
  ]);

  if (dailyRes.error || topModelsRes.error || topPromptsRes.error) {
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // ── Aggregate daily rows client-side (avoids needing a materialized view) ───

  const dailyMap = new Map<string, DailyRow>();
  for (const row of dailyRes.data ?? []) {
    const day = row.ts.slice(0, 10); // YYYY-MM-DD
    const key = `${day}::${row.model}`;
    const existing = dailyMap.get(key);
    if (existing) {
      existing.calls += 1;
      existing.total_tokens_in += row.tokens_in;
      existing.total_tokens_out += row.tokens_out;
      existing.total_tokens += row.tokens_in + row.tokens_out;
    } else {
      dailyMap.set(key, {
        day,
        model: row.model,
        calls: 1,
        total_tokens_in: row.tokens_in,
        total_tokens_out: row.tokens_out,
        total_tokens: row.tokens_in + row.tokens_out,
      });
    }
  }
  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.day.localeCompare(b.day)
  );

  // ── Top models ───────────────────────────────────────────────────────────────

  const modelMap = new Map<string, TopModelRow>();
  for (const row of topModelsRes.data ?? []) {
    const existing = modelMap.get(row.model);
    if (existing) {
      existing.calls += 1;
      existing.total_tokens_in += row.tokens_in;
      existing.total_tokens_out += row.tokens_out;
      existing.tokens += row.tokens_in + row.tokens_out;
    } else {
      modelMap.set(row.model, {
        model: row.model,
        calls: 1,
        total_tokens_in: row.tokens_in,
        total_tokens_out: row.tokens_out,
        tokens: row.tokens_in + row.tokens_out,
      });
    }
  }
  const topModels = Array.from(modelMap.values())
    .sort((a, b) => b.tokens - a.tokens);

  // ── Top prompts ──────────────────────────────────────────────────────────────

  const promptMap = new Map<string, TopPromptRow>();
  for (const row of topPromptsRes.data ?? []) {
    if (!row.prompt_hash) continue;
    const existing = promptMap.get(row.prompt_hash);
    if (existing) {
      existing.calls += 1;
      existing.tokens += row.tokens_in + row.tokens_out;
    } else {
      promptMap.set(row.prompt_hash, {
        prompt_hash: row.prompt_hash,
        calls: 1,
        tokens: row.tokens_in + row.tokens_out,
      });
    }
  }
  const topPrompts = Array.from(promptMap.values())
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 50);

  // ── Filter option lists ───────────────────────────────────────────────────────

  const allModels = new Set<string>();
  const allEnvs = new Set<string>();
  const allProjects = new Set<string>();
  for (const row of filterRes.data ?? []) {
    if (row.model) allModels.add(row.model);
    if (row.env) allEnvs.add(row.env);
    if (row.project_id) allProjects.add(row.project_id);
  }

  // ── Summary totals ────────────────────────────────────────────────────────────

  let totalCalls = 0;
  let totalTokens = 0;
  for (const row of dailyRes.data ?? []) {
    totalCalls += 1;
    totalTokens += row.tokens_in + row.tokens_out;
  }

  const payload: ObsPayload = {
    daily,
    topPrompts,
    topModels,
    totalCalls,
    totalTokens,
    filters: {
      models: Array.from(allModels).sort(),
      envs: Array.from(allEnvs).sort(),
      projects: Array.from(allProjects).sort(),
    },
  };

  return NextResponse.json(payload);
}
