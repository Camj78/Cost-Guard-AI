"use client";

import type { RiskAssessment } from "@/lib/risk";
import type { ModelConfig } from "@/config/models";
import { formatCost, formatNumber } from "@/lib/formatters";

interface PdfExportButtonProps {
  analysis: RiskAssessment;
  model: ModelConfig;
  prompt: string;
  compressionDelta: number;
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

    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const lineHeight = 14;
    const sectionGap = 20;

    function addLine(text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
      const size = opts?.size ?? 10;
      doc.setFontSize(size);
      doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
      if (opts?.color) {
        doc.setTextColor(...opts.color);
      } else {
        doc.setTextColor(30, 30, 30);
      }

      const lines = doc.splitTextToSize(text, contentWidth);
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += size * 1.4;
      }
    }

    function addSectionTitle(title: string) {
      y += sectionGap * 0.5;
      addLine(title, { bold: true, size: 10, color: [80, 80, 80] });
      // Underline
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 2, margin + contentWidth, y - 2);
      y += 6;
    }

    function addField(label: string, value: string) {
      addLine(`${label}: ${value}`, { size: 10 });
      y += 2;
    }

    // ── Header ──────────────────────────────────────────────────────────────
    addLine("CostGuard Preflight Report", { bold: true, size: 18, color: [0, 0, 0] });
    y += 4;
    addLine(new Date().toLocaleString(), { size: 9, color: [120, 120, 120] });
    y += sectionGap;

    // ── Prompt summary ──────────────────────────────────────────────────────
    addSectionTitle("Prompt Summary");
    const promptSummary =
      prompt.length > 500 ? prompt.slice(0, 500) + "…" : prompt;
    addLine(promptSummary, { size: 9, color: [60, 60, 60] });
    y += sectionGap * 0.5;

    // ── Model ───────────────────────────────────────────────────────────────
    addSectionTitle("Model");
    addField("Name", model.name);
    addField("Provider", model.provider);
    y += sectionGap * 0.5;

    // ── Tokens ──────────────────────────────────────────────────────────────
    addSectionTitle("Tokens");
    addField("Input tokens", formatNumber(analysis.inputTokens));
    addField("Output tokens (expected)", formatNumber(analysis.expectedOutputTokens));
    addField(
      "Token count",
      analysis.isEstimated ? "Estimated" : "Exact"
    );
    y += sectionGap * 0.5;

    // ── Cost breakdown ───────────────────────────────────────────────────────
    addSectionTitle("Cost Breakdown");
    addField("Input cost", formatCost(analysis.estimatedCostInput));
    addField("Output cost", formatCost(analysis.estimatedCostOutput));
    addField("Total per request", formatCost(analysis.estimatedCostTotal));
    y += sectionGap * 0.5;

    // ── Risk ─────────────────────────────────────────────────────────────────
    addSectionTitle("Risk Assessment");
    addField("Risk score", `${analysis.riskScore} / 100`);
    addField("Risk level", analysis.riskLevel.charAt(0).toUpperCase() + analysis.riskLevel.slice(1));
    addLine("Top risk factors:", { size: 10 });
    y += 3;
    addLine(analysis.riskExplanation, { size: 9, color: [80, 80, 80] });
    y += sectionGap * 0.5;

    // ── Compression ──────────────────────────────────────────────────────────
    if (compressionDelta > 0) {
      addSectionTitle("Compression Suggestion");
      addLine(
        `Prompt is reducible by ~${compressionDelta.toFixed(0)}% using rule-based compression.`,
        { size: 10 }
      );
      y += sectionGap * 0.5;
    }

    // ── Scale simulation ─────────────────────────────────────────────────────
    addSectionTitle("Scale Simulation");
    const defaultRequestsPerDay = 10_000;
    const defaultDaysPerMonth = 30;
    const monthlyCost =
      analysis.estimatedCostTotal * defaultRequestsPerDay * defaultDaysPerMonth;
    const yearlyCost = monthlyCost * 12;
    addField("Assumptions", `${formatNumber(defaultRequestsPerDay)} req/day × ${defaultDaysPerMonth} days/month`);
    addField("Monthly cost", formatCost(monthlyCost));
    addField("Yearly cost", formatCost(yearlyCost));

    // ── Footer ────────────────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 160, 160);
      doc.text(
        `CostGuard — costguardai.com — Page ${i} of ${totalPages}`,
        margin,
        doc.internal.pageSize.getHeight() - 24
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
