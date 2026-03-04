"use client";

import type { RiskAssessment } from "@/lib/risk";
import type { ModelConfig } from "@/config/models";
import { formatCost, formatNumber, formatPercent } from "@/lib/formatters";

interface PdfExportButtonProps {
  analysis: RiskAssessment;
  model: ModelConfig;
  prompt: string;
  compressionDelta: number;
}

// ── Brand palette (RGB) ──────────────────────────────────────────────────────
const C = {
  headerBg:  [15,  14,  13]  as [number, number, number],
  amber:     [212, 162, 44]  as [number, number, number],
  amberBg:   [249, 247, 236] as [number, number, number],
  amberBdr:  [212, 162, 44]  as [number, number, number],
  rowTint:   [244, 243, 241] as [number, number, number],
  cardBdr:   [220, 217, 212] as [number, number, number],
  body:      [22,  21,  19]  as [number, number, number],
  secondary: [100, 97,  92]  as [number, number, number],
  muted:     [155, 152, 147] as [number, number, number],
  rule:      [218, 215, 210] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};

function getRiskColor(level: string): [number, number, number] {
  switch (level.toLowerCase()) {
    case "safe":     return [34,  197, 94];
    case "low":      return [132, 204, 22];
    case "warning":  return [234, 179, 8];
    case "high":     return [249, 115, 22];
    case "critical": return [239, 68,  68];
    default:         return C.muted;
  }
}

async function getLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function PdfExportButton({
  analysis,
  model,
  prompt,
  compressionDelta,
}: PdfExportButtonProps) {
  async function handleExport() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });

    const PAGE_W  = doc.internal.pageSize.getWidth();   // 612
    const PAGE_H  = doc.internal.pageSize.getHeight();  // 792
    const MARGIN  = 48;
    const COL_W   = PAGE_W - MARGIN * 2;                // 516
    const HEADER_H = 88;

    const logoDataUrl = await getLogoDataUrl();
    const riskColor   = getRiskColor(analysis.riskLevel);
    const riskLabel   = analysis.riskLevel.charAt(0).toUpperCase() + analysis.riskLevel.slice(1);

    let y = HEADER_H + 22;

    // ── Palette helpers ────────────────────────────────────────────────────
    function sf(rgb: [number, number, number]) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
    function ss(rgb: [number, number, number]) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }
    function sc(rgb: [number, number, number]) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }

    // ── Page break guard ──────────────────────────────────────────────────
    function checkY(needed = 20) {
      if (y + needed > PAGE_H - MARGIN - 24) {
        doc.addPage();
        drawPageChrome();
        y = HEADER_H + 22;
      }
    }

    // ── Page chrome: dark header + amber strip ─────────────────────────────
    function drawPageChrome() {
      sf(C.headerBg);
      doc.rect(0, 0, PAGE_W, HEADER_H, "F");

      // Amber accent strip
      sf(C.amber);
      doc.rect(0, HEADER_H - 2, PAGE_W, 2, "F");

      // Logo (top-left in header)
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, "PNG", MARGIN, 19, 48, 48); } catch { /* skip on error */ }
      }

      // Brand name
      const textX = logoDataUrl ? MARGIN + 62 : MARGIN;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      sc(C.amber);
      doc.text("CostGuardAI", textX, 42);

      // Report subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      sc(C.white);
      doc.text("Preflight Report", textX, 58);

      // Timestamp right-aligned
      doc.setFontSize(8);
      sc(C.muted);
      doc.text(new Date().toLocaleString(), PAGE_W - MARGIN, 42, { align: "right" });
    }

    // ── Section heading (amber label + rule) ──────────────────────────────
    function sectionTitle(title: string) {
      checkY(32);
      y += 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      sc(C.amber);
      doc.text(title.toUpperCase(), MARGIN, y);
      y += 5;
      ss(C.rule);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y, MARGIN + COL_W, y);
      y += 10;
    }

    // ── Field row (label left, value right) ───────────────────────────────
    function fieldRow(label: string, value: string, tint = false) {
      const ROW_H = 18;
      checkY(ROW_H);
      if (tint) {
        sf(C.rowTint);
        doc.rect(MARGIN, y - 13, COL_W, ROW_H, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      sc(C.secondary);
      doc.text(label, MARGIN + 6, y);
      doc.setFont("helvetica", "bold");
      sc(C.body);
      doc.text(value, MARGIN + COL_W - 4, y, { align: "right" });
      y += ROW_H;
    }

    // ── Highlighted "total" row (amber background) ────────────────────────
    function totalRow(label: string, value: string) {
      checkY(22);
      sf(C.amber);
      doc.rect(MARGIN, y - 13, COL_W, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      sc(C.headerBg);
      doc.text(label, MARGIN + 6, y);
      doc.text(value, MARGIN + COL_W - 4, y, { align: "right" });
      y += 22;
    }

    // ── Wrapped body text ─────────────────────────────────────────────────
    function bodyText(
      str: string,
      color: [number, number, number] = C.secondary,
      size = 9,
      indent = 6
    ) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      sc(color);
      const lines = doc.splitTextToSize(str, COL_W - indent * 2);
      for (const l of lines) {
        checkY(size * 1.6);
        doc.text(l, MARGIN + indent, y);
        y += size * 1.45;
      }
    }

    // ── Sub-label (small uppercase label) ────────────────────────────────
    function subLabel(text: string) {
      checkY(18);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      sc(C.secondary);
      doc.text(text.toUpperCase(), MARGIN + 4, y);
      y += 11;
    }

    // ══════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════
    drawPageChrome();

    // ── 1. Risk hero strip (3-column metric card) ─────────────────────────
    const STRIP_H = 58;
    const col3    = COL_W / 3;

    // Outer border
    ss(C.cardBdr);
    doc.setLineWidth(0.5);
    sf(C.white);
    doc.rect(MARGIN, y, COL_W, STRIP_H, "FD");

    // Left col: Risk badge (colored)
    sf(riskColor);
    doc.rect(MARGIN, y, col3 - 0.5, STRIP_H, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    sc(C.white);
    doc.text(`${analysis.riskScore}`, MARGIN + col3 / 2, y + 28, { align: "center" });
    doc.setFontSize(8);
    doc.text(riskLabel.toUpperCase(), MARGIN + col3 / 2, y + 42, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("RISK SCORE", MARGIN + col3 / 2, y + 52, { align: "center" });

    // Column dividers
    ss(C.cardBdr);
    doc.setLineWidth(0.5);
    doc.line(MARGIN + col3,     y + 8, MARGIN + col3,     y + STRIP_H - 8);
    doc.line(MARGIN + col3 * 2, y + 8, MARGIN + col3 * 2, y + STRIP_H - 8);

    // Center col: Total cost
    const cx2 = MARGIN + col3 + col3 / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    sc(C.body);
    doc.text(formatCost(analysis.estimatedCostTotal), cx2, y + 26, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    sc(C.secondary);
    doc.text("TOTAL / REQUEST", cx2, y + 39, { align: "center" });

    // Right col: Context usage
    const cx3 = MARGIN + col3 * 2 + col3 / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    sc(C.body);
    doc.text(formatPercent(analysis.usagePercent), cx3, y + 26, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    sc(C.secondary);
    doc.text("CONTEXT USED", cx3, y + 39, { align: "center" });

    y += STRIP_H + 6;

    // Truncation warning banner (if applicable)
    if (analysis.truncation.level !== "safe") {
      const warnColor: [number, number, number] =
        analysis.truncation.level === "danger" ? [239, 68, 68] : [234, 179, 8];
      const warnLines = doc.splitTextToSize(analysis.truncation.message, COL_W - 18);
      const warnH     = warnLines.length * 11 + 14;
      checkY(warnH + 4);
      sf(warnColor);
      doc.rect(MARGIN, y, COL_W, warnH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      sc(C.white);
      for (let i = 0; i < warnLines.length; i++) {
        doc.text(warnLines[i], MARGIN + 8, y + 11 + i * 11);
      }
      y += warnH + 6;
    }

    // ── 2. Prompt Summary ─────────────────────────────────────────────────
    sectionTitle("Prompt Summary");
    const promptExcerpt = prompt.length > 500 ? prompt.slice(0, 500) + "…" : prompt;
    bodyText(promptExcerpt, C.secondary, 9, 6);
    y += 4;

    // ── 3. Model ──────────────────────────────────────────────────────────
    sectionTitle("Model");
    fieldRow("Name", model.name);
    fieldRow("Provider", model.provider, true);
    fieldRow("Context window", `${formatNumber(analysis.contextWindow)} tokens`);
    fieldRow("Token count method", analysis.isEstimated ? "Estimated" : "Exact", true);
    y += 4;

    // ── 4. Tokens ─────────────────────────────────────────────────────────
    sectionTitle("Tokens");
    fieldRow("Input tokens", formatNumber(analysis.inputTokens));
    fieldRow("Output tokens (expected)", formatNumber(analysis.expectedOutputTokens), true);
    fieldRow("Tokens remaining", formatNumber(analysis.remaining));
    fieldRow("Context saturation", formatPercent(analysis.usagePercent), true);
    y += 4;

    // ── 5. Cost Breakdown ─────────────────────────────────────────────────
    sectionTitle("Cost Breakdown");
    fieldRow("Input cost", formatCost(analysis.estimatedCostInput));
    fieldRow("Output cost", formatCost(analysis.estimatedCostOutput), true);
    totalRow("Total per request", formatCost(analysis.estimatedCostTotal));
    y += 4;

    // ── 6. Risk Assessment ────────────────────────────────────────────────
    sectionTitle("Risk Assessment");
    fieldRow("Risk score", `${analysis.riskScore} / 100`);
    fieldRow("Risk level", riskLabel, true);

    // Top risk drivers
    if (analysis.riskDrivers.length > 0) {
      subLabel("Top Risk Drivers");
      for (let i = 0; i < analysis.riskDrivers.length; i++) {
        const driver = analysis.riskDrivers[i];
        checkY(22);
        if (i % 2 === 0) {
          sf(C.rowTint);
          doc.rect(MARGIN, y - 13, COL_W, 18, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        sc(C.body);
        doc.text(driver.name, MARGIN + 6, y);
        sc(C.secondary);
        doc.text(`Impact: ${driver.impact}`, MARGIN + COL_W - 4, y, { align: "right" });
        y += 18;

        for (const fix of driver.fixes) {
          checkY(13);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          sc(C.secondary);
          const fixLines = doc.splitTextToSize(`• ${fix}`, COL_W - 18);
          for (const fl of fixLines) {
            checkY(12);
            doc.text(fl, MARGIN + 14, y);
            y += 12;
          }
        }
        y += 2;
      }
    }

    // Explanation summary
    subLabel("Summary");
    bodyText(analysis.riskExplanation, C.secondary, 9, 6);
    y += 4;

    // ── 7. Compression Opportunity ────────────────────────────────────────
    if (compressionDelta > 0) {
      sectionTitle("Compression Opportunity");
      checkY(40);
      sf(C.amberBg);
      ss(C.amberBdr);
      doc.setLineWidth(0.5);
      doc.rect(MARGIN, y - 4, COL_W, 36, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      sc(C.amber);
      doc.text(`~${compressionDelta.toFixed(0)}%`, MARGIN + 10, y + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      sc(C.secondary);
      doc.text("token reduction available via rule-based compression", MARGIN + 46, y + 12);
      doc.setFontSize(8);
      doc.text("Estimated savings reflected in Scale Simulation below.", MARGIN + 10, y + 25);
      y += 42;
    }

    // ── 8. Scale Simulation ───────────────────────────────────────────────
    sectionTitle("Scale Simulation");

    const REQ_DAY   = 10_000;
    const DAYS_MO   = 30;
    const monthly   = analysis.estimatedCostTotal * REQ_DAY * DAYS_MO;
    const yearly    = monthly * 12;

    fieldRow("Assumptions", `${formatNumber(REQ_DAY)} req/day × ${DAYS_MO} days/month`);
    fieldRow("Monthly cost", formatCost(monthly), true);
    totalRow("Yearly cost", formatCost(yearly));

    if (compressionDelta > 0) {
      const compCost     = analysis.estimatedCostTotal * (1 - compressionDelta / 100);
      const compMonthly  = compCost * REQ_DAY * DAYS_MO;
      const savings      = monthly - compMonthly;

      y += 4;
      subLabel("With Compression");
      fieldRow("Compressed monthly cost", formatCost(compMonthly));
      fieldRow("Monthly savings", formatCost(savings), true);
    }

    // ── Footer on every page ──────────────────────────────────────────────
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const host = new URL(siteUrl).host;

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      ss(C.rule);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, PAGE_H - 36, MARGIN + COL_W, PAGE_H - 36);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      sc(C.muted);
      doc.text(`CostGuardAI — ${host}`, MARGIN, PAGE_H - 24);
      doc.text(
        `Page ${i} of ${totalPages}`,
        PAGE_W - MARGIN,
        PAGE_H - 24,
        { align: "right" }
      );
    }

    const filename = `costguard-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  }

  return (
    <button
      onClick={handleExport}
      className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
    >
      Export PDF
    </button>
  );
}
