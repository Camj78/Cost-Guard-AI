// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = "high" | "medium" | "low";

export interface DerivedAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  repo: string;
  detail: string;
  detectedAt: string; // ISO timestamp
}

/** Minimal analysis record shape required by this module. */
export interface AnalysisRecord {
  id: string;
  input_tokens: number;
  output_tokens: number;
  cost_total: number;
  risk_score: number;
  created_at: string;
}

export interface DeriveAlertsInput {
  analysisHistory: AnalysisRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGH_RISK_THRESHOLD = 70;
const TOKEN_SPIKE_MULTIPLIER = 2;
const COST_SPIKE_MULTIPLIER = 1.5;
const RUNAWAY_DAILY_MULTIPLIER = 3;

// Sliding windows
const RECENT_WINDOW = 3;
const BASELINE_WINDOW = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/** Average daily spend over the past `days` calendar days. */
function dailyAvgCost(records: AnalysisRecord[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = records.filter(
    (r) => new Date(r.created_at).getTime() >= cutoff
  );
  if (inWindow.length === 0) return 0;

  const byDay = new Map<string, number>();
  inWindow.forEach((r) => {
    const day = new Date(r.created_at).toDateString();
    byDay.set(day, (byDay.get(day) ?? 0) + r.cost_total);
  });

  return safeAvg(Array.from(byDay.values()));
}

// ─── deriveAlerts ─────────────────────────────────────────────────────────────

/**
 * Derives active alerts from user-scoped analysis history.
 * No demo data, no cross-user data. Empty array if no conditions fire.
 *
 * Alert order (descending severity):
 *   1. Runaway AI Cost Protection (high)
 *   2. High Prompt Risk            (high)
 *   3. Token Usage Spike           (medium)
 *   4. Projected Cost Spike        (medium)
 */
export function deriveAlerts({
  analysisHistory,
}: DeriveAlertsInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  if (analysisHistory.length === 0) return alerts;

  const sorted = [...analysisHistory].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const todayStr = new Date().toDateString();
  const todayCost = sorted
    .filter((r) => new Date(r.created_at).toDateString() === todayStr)
    .reduce((sum, r) => sum + r.cost_total, 0);

  const dailyBaseline = dailyAvgCost(sorted, 14);

  // ── Rule: Runaway AI Cost Protection (HIGH — always first) ────────────────
  if (dailyBaseline > 0 && todayCost > dailyBaseline * RUNAWAY_DAILY_MULTIPLIER) {
    alerts.push({
      id: "runaway-cost",
      severity: "high",
      title: "Runaway AI cost risk detected",
      repo: "your workspace",
      detail: `Today's spend ($${todayCost.toFixed(4)}) exceeds ${RUNAWAY_DAILY_MULTIPLIER}× the daily baseline. Projected monthly spend exceeds safe threshold.`,
      detectedAt: new Date().toISOString(),
    });
  }

  // ── Rule: High Prompt Risk ─────────────────────────────────────────────────
  const latestHighRisk = sorted.find((r) => r.risk_score >= HIGH_RISK_THRESHOLD);
  if (latestHighRisk) {
    alerts.push({
      id: `high-risk-${latestHighRisk.id}`,
      severity: "high",
      title: "High prompt risk detected",
      repo: "your workspace",
      detail: `Latest high-risk run scored ${latestHighRisk.risk_score}/100. Review before deploying.`,
      detectedAt: latestHighRisk.created_at,
    });
  }

  // ── Rule: Token Usage Spike ────────────────────────────────────────────────
  const recent = sorted.slice(0, RECENT_WINDOW);
  const baseline = sorted.slice(RECENT_WINDOW, RECENT_WINDOW + BASELINE_WINDOW);

  if (baseline.length >= 3 && recent.length > 0) {
    const recentAvg = safeAvg(
      recent.map((r) => r.input_tokens + r.output_tokens)
    );
    const baselineAvg = safeAvg(
      baseline.map((r) => r.input_tokens + r.output_tokens)
    );

    if (baselineAvg > 0 && recentAvg > baselineAvg * TOKEN_SPIKE_MULTIPLIER) {
      const pct = Math.round((recentAvg / baselineAvg - 1) * 100);
      alerts.push({
        id: "token-spike",
        severity: "medium",
        title: "Token usage spike detected",
        repo: "your workspace",
        detail: `Recent token usage is ${pct}% above 10-run baseline.`,
        detectedAt: sorted[0].created_at,
      });
    }
  }

  // ── Rule: Projected Cost Spike ─────────────────────────────────────────────
  const projectedMonthly = todayCost * 30;
  const baselineMonthly = dailyBaseline * 30;

  if (
    baselineMonthly > 0 &&
    projectedMonthly > baselineMonthly * COST_SPIKE_MULTIPLIER
  ) {
    alerts.push({
      id: "projected-cost-spike",
      severity: "medium",
      title: "Projected AI cost spike",
      repo: "your workspace",
      detail: `Projected monthly cost ($${projectedMonthly.toFixed(2)}) is ${COST_SPIKE_MULTIPLIER}× above trailing average.`,
      detectedAt: new Date().toISOString(),
    });
  }

  return alerts;
}

// ─── estimateCostSaved ────────────────────────────────────────────────────────

/**
 * Investor value KPI: estimated cost prevented by CostGuard flagging
 * high-risk prompts before production deployment.
 *
 * Heuristic: for each high-risk run (risk >= 70), the expected
 * failure-rerun cost is proportional to risk_score / 100. CostGuard's
 * flag allows devs to fix before deploying, preventing that loss.
 *
 * Returns 0 if no qualifying analyses exist.
 */
export function estimateCostSaved(analyses: AnalysisRecord[]): number {
  return analyses
    .filter((a) => a.risk_score >= HIGH_RISK_THRESHOLD)
    .reduce((sum, a) => sum + a.cost_total * (a.risk_score / 100), 0);
}
