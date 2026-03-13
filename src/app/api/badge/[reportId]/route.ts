/**
 * GET /api/badge/[reportId]
 *
 * Returns an SVG badge showing the Prompt Safety risk level for a given
 * share report. Used in the badge snippet suggested in PR/issue comments.
 *
 * Cached for 1 hour — risk scores for a given report ID are immutable.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Risk level → badge color ─────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
  extreme: "#7c3aed",
};

// ─── SVG badge builder ────────────────────────────────────────────────────────

function buildBadgeSvg(level: string, score: number): string {
  const color = RISK_COLORS[level.toLowerCase()] ?? "#64748b";
  const label = "Prompt Risk";
  const value = `${level.toUpperCase()} ${score}/100`;

  // Approximate text widths (px) at 11 px DejaVu Sans
  const labelPx = label.length * 6.5 + 10;
  const valuePx = Math.max(value.length * 6.5 + 10, 70);
  const totalPx = Math.round(labelPx + valuePx);
  const labelMid = Math.round(labelPx / 2);
  const valueMid = Math.round(labelPx + valuePx / 2);
  const h = 20;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalPx}" height="${h}">` +
    `<linearGradient id="s" x2="0" y2="100%">` +
    `<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>` +
    `<stop offset="1" stop-opacity=".1"/>` +
    `</linearGradient>` +
    `<rect rx="3" width="${totalPx}" height="${h}" fill="#555"/>` +
    `<rect rx="3" x="${Math.round(labelPx)}" width="${Math.round(valuePx)}" height="${h}" fill="${color}"/>` +
    `<rect x="${Math.round(labelPx)}" width="4" height="${h}" fill="${color}"/>` +
    `<rect rx="3" width="${totalPx}" height="${h}" fill="url(#s)"/>` +
    `<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">` +
    `<text x="${labelMid}" y="15" fill="#010101" fill-opacity=".3">${label}</text>` +
    `<text x="${labelMid}" y="14">${label}</text>` +
    `<text x="${valueMid}" y="15" fill="#010101" fill-opacity=".3">${value}</text>` +
    `<text x="${valueMid}" y="14">${value}</text>` +
    `</g>` +
    `</svg>`
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;

  let level = "unknown";
  let score = 0;

  if (reportId) {
    const supabaseUrl =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const admin = createClient(supabaseUrl, supabaseKey);

        const { data } = await admin
          .from("share_links")
          .select("snapshot")
          .eq("id", reportId)
          .single();

        if (data?.snapshot) {
          const snapshot = data.snapshot as {
            analysis?: { riskLevel?: string; riskScore?: number };
          };
          level = snapshot.analysis?.riskLevel ?? "unknown";
          score = snapshot.analysis?.riskScore ?? 0;
        }
      } catch {
        // Serve default badge on any error
      }
    }
  }

  const svg = buildBadgeSvg(level, score);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
