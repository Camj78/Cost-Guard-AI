import { createClient } from "@supabase/supabase-js";
import { pricingLastUpdated } from "@/lib/ai/models";
import type { RiskAssessment } from "@/lib/risk";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface ShareReportResult {
  shareId: string;
  urlPath: string;
  absoluteUrl: string;
}

export async function createShareReport(result: {
  assessment: RiskAssessment;
  modelId: string;
  modelName: string;
}): Promise<ShareReportResult | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const snapshot = {
    analysis: result.assessment,
    modelId: result.modelId,
    modelName: result.modelName,
    pricingLastUpdated,
  };

  const { data, error } = await admin
    .from("share_links")
    .insert({ snapshot })
    .select("id")
    .single();

  if (error || !data) return null;

  const shareId = data.id as string;
  const urlPath = `/s/${shareId}`;
  return { shareId, urlPath, absoluteUrl: `${siteUrl}${urlPath}` };
}
