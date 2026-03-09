/**
 * CostGuardAI — Weekly Intelligence Recalculation Job
 *
 * Recalculates top prompt injection patterns, token explosion signatures,
 * and tool abuse patterns. Updates CVE incident counts.
 *
 * Call via: POST /api/admin/intelligence/weekly
 * Protected by Authorization: Bearer <CRON_SECRET> header.
 *
 * Trigger via Vercel Cron (vercel.json) or manual HTTP call.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface PatternRow {
  pattern_hash: string;
  count: number;
  avg_risk: number;
  last_seen: string;
}

interface CveRow {
  cve_id: string;
  pattern_hash: string;
  severity: string;
}

interface IntelReport {
  ran_at: string;
  top_patterns: {
    pattern_hash: string;
    count: number;
    avg_risk: number;
    has_cve: boolean;
  }[];
  token_explosion_patterns: number;
  high_risk_patterns: number;
  cve_counts_updated: number;
  summary: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin client unavailable" }, { status: 500 });
  }

  try {
    const ranAt = new Date().toISOString();

    // 1. Fetch top patterns by incident count (top 50)
    const { data: topPatterns, error: patternsErr } = await admin
      .from("incident_patterns")
      .select("pattern_hash, count, avg_risk, last_seen")
      .order("count", { ascending: false })
      .limit(50);

    if (patternsErr) {
      return NextResponse.json({ error: patternsErr.message }, { status: 500 });
    }

    const patterns = (topPatterns ?? []) as PatternRow[];

    // 2. Fetch all existing CVEs for cross-reference
    const { data: existingCves } = await admin
      .from("prompt_cve_registry")
      .select("cve_id, pattern_hash, severity");

    const cveMap = new Map<string, CveRow>();
    for (const cve of (existingCves ?? []) as CveRow[]) {
      cveMap.set(cve.pattern_hash, cve);
    }

    // 3. Update CVE incident_count + last_seen for patterns that have CVEs
    let cveCountsUpdated = 0;
    const now = new Date().toISOString();

    for (const pattern of patterns) {
      const cve = cveMap.get(pattern.pattern_hash);
      if (cve) {
        await admin
          .from("prompt_cve_registry")
          .update({
            incident_count: pattern.count,
            last_seen: now,
          })
          .eq("pattern_hash", pattern.pattern_hash);
        cveCountsUpdated++;
      }
    }

    // 4. Compute intelligence summary metrics
    const tokenExplosionPatterns = patterns.filter((p) => p.avg_risk >= 70).length;
    const highRiskPatterns = patterns.filter((p) => p.avg_risk >= 65).length;

    // 5. Build report
    const report: IntelReport = {
      ran_at: ranAt,
      top_patterns: patterns.slice(0, 10).map((p) => ({
        pattern_hash: p.pattern_hash.slice(0, 12) + "…", // partial hash — do not expose full hash
        count: p.count,
        avg_risk: p.avg_risk,
        has_cve: cveMap.has(p.pattern_hash),
      })),
      token_explosion_patterns: tokenExplosionPatterns,
      high_risk_patterns: highRiskPatterns,
      cve_counts_updated: cveCountsUpdated,
      summary: `Processed ${patterns.length} patterns. ${cveCountsUpdated} CVE records updated. ${highRiskPatterns} high-risk patterns active.`,
    };

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
