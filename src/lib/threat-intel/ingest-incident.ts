/**
 * CostGuardAI — Threat Intelligence Ingestion
 *
 * Records anonymized prompt incidents for the global CVE database.
 * Fire-and-forget — never blocks the analysis response.
 *
 * PRIVACY GUARANTEE:
 *   - No raw prompt text is ever stored or transmitted.
 *   - Only structural fingerprints (pattern_hash, structure_signature) are persisted.
 *   - pattern_hash = SHA-256(token_band + risk_factor_scores) — cannot reconstruct prompt.
 */

import { createClient } from "@supabase/supabase-js";
import { checkAndGenerateCve } from "./cve-engine";
import { ANALYSIS_VERSION } from "@/config/analysis";

/** Minimum incident count before a CVE is generated for this pattern. */
const CVE_THRESHOLD = 25;

/** Maximum incidents ingested per project per hour. Prevents dataset spam. */
const RATE_LIMIT_PER_HOUR = 50;

export interface IncidentInput {
  patternHash: string;
  structureSignature: string;
  riskType: string;
  riskScore: number;
  tokenEstimate: number;
  model: string;
  mitigationUsed: string | null;
  /** @deprecated Version is now pinned internally from src/config/analysis.ts */
  analysisVersion?: string;
  projectId?: string;
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Ingests a high-risk prompt incident into the threat intelligence pipeline.
 *
 * Steps:
 *   1. Insert anonymized record into prompt_incidents
 *   2. Upsert incident_patterns (rolling count + avg_risk)
 *   3. Insert structural fingerprint into prompt_pattern_examples
 *   4. If pattern count >= 25 → trigger CVE generation
 */
export async function ingestIncident(input: IncidentInput): Promise<void> {
  try {
    const admin = getAdminClient();
    if (!admin) return;

    // Rate limit: max 50 incidents per project per hour
    if (input.projectId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await admin
        .from("prompt_incidents")
        .select("*", { count: "exact", head: true })
        .eq("project_id", input.projectId)
        .gte("created_at", oneHourAgo);

      if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
        console.warn(
          `[ThreatIntel] ingest rate limit reached for project_id ${input.projectId}`
        );
        return;
      }
    }

    const now = new Date().toISOString();

    // 1. Append anonymized incident record
    await admin.from("prompt_incidents").insert({
      risk_type: input.riskType,
      risk_score: input.riskScore,
      token_estimate: input.tokenEstimate,
      model: input.model,
      pattern_hash: input.patternHash,
      mitigation_used: input.mitigationUsed,
      analysis_version: ANALYSIS_VERSION,
      project_id: input.projectId ?? null,
    });

    // 2. Upsert incident_patterns — rolling count + weighted avg_risk
    const { data: existing } = await admin
      .from("incident_patterns")
      .select("count, avg_risk")
      .eq("pattern_hash", input.patternHash)
      .maybeSingle();

    let newCount: number;
    let newAvgRisk: number;

    if (existing) {
      newCount = (existing.count as number) + 1;
      newAvgRisk = Math.round(
        ((existing.avg_risk as number) * (existing.count as number) + input.riskScore) / newCount
      );
      await admin
        .from("incident_patterns")
        .update({ count: newCount, avg_risk: newAvgRisk, last_seen: now })
        .eq("pattern_hash", input.patternHash);
    } else {
      newCount = 1;
      newAvgRisk = input.riskScore;
      await admin.from("incident_patterns").insert({
        pattern_hash: input.patternHash,
        count: newCount,
        avg_risk: newAvgRisk,
        last_seen: now,
      });
    }

    // 3. Record structural fingerprint (no text — only signature label)
    await admin.from("prompt_pattern_examples").insert({
      pattern_hash: input.patternHash,
      structure_signature: input.structureSignature,
      risk_type: input.riskType,
    });

    // 4. CVE threshold check — generate or update if >= 25 incidents
    if (newCount >= CVE_THRESHOLD) {
      await checkAndGenerateCve(admin, {
        patternHash: input.patternHash,
        avgRisk: newAvgRisk,
        riskType: input.riskType,
        incidentCount: newCount,
      });
    }
  } catch {
    // Fire-and-forget: swallow all errors — never surface to caller
  }
}
