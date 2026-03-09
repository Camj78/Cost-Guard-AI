/**
 * CostGuardAI — Founder Analytics Dashboard
 *
 * Private route. Access restricted to emails listed in FOUNDER_EMAIL env var
 * (comma-separated). Redirects all other users to home.
 *
 * Data sourced from:
 *   - Supabase (service role, bypasses RLS) — analyses, users, CVEs, installs
 *   - Filesystem — benchmark summary
 *   - Environment — health checks
 *
 * Privacy: never exposes raw prompts, pattern hashes, or user PII.
 */

export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatNumber } from "@/lib/formatters";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = "Healthy" | "Watch" | "Needs Attention" | "Not Configured";
type LaunchHealth = "Healthy" | "Watch" | "Needs Attention";
type IssueSeverity = "high" | "medium";

interface Issue {
  severity: IssueSeverity;
  title: string;
  what: string;
  action: string;
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: HealthStatus }) {
  const colors: Record<HealthStatus, string> = {
    Healthy: "bg-green-500",
    Watch: "bg-amber-500",
    "Needs Attention": "bg-red-500",
    "Not Configured": "bg-zinc-500",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]} shrink-0`}
    />
  );
}

function StatusLabel({ status }: { status: HealthStatus }) {
  const colors: Record<HealthStatus, string> = {
    Healthy: "text-green-400",
    Watch: "text-amber-400",
    "Needs Attention": "text-red-400",
    "Not Configured": "text-zinc-500",
  };
  return <span className={`text-xs font-mono ${colors[status]}`}>{status}</span>;
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="glass-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-semibold tracking-tight font-mono tabular-nums mt-2">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}

// ── Admin client factory ──────────────────────────────────────────────────────

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FounderPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // ── Auth ────────────────────────────────────────────────────────────────────

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const founderEmails = (process.env.FOUNDER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (
    founderEmails.length > 0 &&
    !founderEmails.includes(user.email?.toLowerCase() ?? "")
  ) {
    redirect("/");
  }

  // ── Date range ──────────────────────────────────────────────────────────────

  const params = await searchParams;
  const rawDays = parseInt(params.days ?? "7", 10);
  const days = [1, 7, 30].includes(rawDays) ? rawDays : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const dayLabel = days === 1 ? "today" : `last ${days} days`;

  // ── Admin client ────────────────────────────────────────────────────────────

  const admin = getAdminClient();

  type AnalysisRow = {
    id: string;
    risk_score: number;
    cost_total: number;
    model_id: string;
    created_at: string;
  };
  type CveRow = {
    cve_id: string;
    severity: string;
    incident_count: number;
    description: string;
  };
  type BillingRow = { plan: string; status: string };
  type UsageEventRow = {
    ts: string;
    endpoint: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
  };

  let totalUsers = 0;
  let analysesPeriod: AnalysisRow[] = [];
  let totalAnalyses = 0;
  let totalShareLinks = 0;
  let cveList: CveRow[] = [];
  let githubInstalls = 0;
  let billingRows: BillingRow[] = [];
  let usageEvents: UsageEventRow[] = [];
  let totalIncidents = 0;
  let dbHealthy = false;

  if (admin) {
    const [
      totalUsersRes,
      analysesPeriodRes,
      analysesTotalRes,
      shareLinksAllRes,
      cveRes,
      githubInstallsRes,
      billingRes,
      incidentRes,
      usageEventsRes,
    ] = await Promise.all([
      admin.from("users").select("id", { count: "exact", head: true }),
      admin
        .from("analysis_history")
        .select("id, risk_score, cost_total, model_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      admin
        .from("analysis_history")
        .select("id", { count: "exact", head: true }),
      admin.from("share_links").select("id", { count: "exact", head: true }),
      admin
        .from("prompt_cve_registry")
        .select("cve_id, severity, incident_count, description")
        .order("incident_count", { ascending: false }),
      admin
        .from("github_installations")
        .select("id", { count: "exact", head: true }),
      admin.from("billing_accounts").select("plan, status"),
      admin
        .from("prompt_incidents")
        .select("id", { count: "exact", head: true }),
      admin
        .from("ai_usage_events")
        .select("ts, endpoint, model, tokens_in, tokens_out")
        .gte("ts", since)
        .order("ts", { ascending: false })
        .limit(1000),
    ]);

    dbHealthy = !totalUsersRes.error;
    totalUsers = totalUsersRes.count ?? 0;
    analysesPeriod = (analysesPeriodRes.data ?? []) as AnalysisRow[];
    totalAnalyses = analysesTotalRes.count ?? 0;
    totalShareLinks = shareLinksAllRes.count ?? 0;
    cveList = (cveRes.data ?? []) as CveRow[];
    githubInstalls = githubInstallsRes.count ?? 0;
    billingRows = (billingRes.data ?? []) as BillingRow[];
    totalIncidents = incidentRes.count ?? 0;
    usageEvents = (usageEventsRes.data ?? []) as UsageEventRow[];
  }

  // ── Derived metrics ─────────────────────────────────────────────────────────

  // Plan distribution
  const planCounts: Record<string, number> = {};
  for (const row of billingRows) {
    const plan = row.plan ?? "free";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }
  const paidUsers =
    (planCounts["pro"] ?? 0) +
    (planCounts["team"] ?? 0) +
    (planCounts["enterprise"] ?? 0);

  // Risk stats
  const avgRisk =
    analysesPeriod.length > 0
      ? Math.round(
          analysesPeriod.reduce((s, r) => s + (r.risk_score ?? 0), 0) /
            analysesPeriod.length
        )
      : null;
  const highRiskCount = analysesPeriod.filter((r) => r.risk_score >= 70).length;

  // API usage stats
  const totalApiCalls = usageEvents.length;
  const totalTokens = usageEvents.reduce(
    (s, e) => s + (e.tokens_in ?? 0) + (e.tokens_out ?? 0),
    0
  );

  // Model distribution
  const modelMap: Record<string, number> = {};
  for (const e of usageEvents) {
    if (e.model) modelMap[e.model] = (modelMap[e.model] ?? 0) + 1;
  }
  const topModels = Object.entries(modelMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // CVE severity breakdown
  const cveSeverity: Record<string, number> = {};
  for (const cve of cveList) {
    cveSeverity[cve.severity] = (cveSeverity[cve.severity] ?? 0) + 1;
  }

  // Benchmark
  let benchmarkStatus: HealthStatus = "Not Configured";
  let benchmarkPassRate: number | null = null;
  let benchmarkFixtures = 0;
  let benchmarkTimestamp: string | null = null;
  try {
    const raw = readFileSync(
      join(process.cwd(), "artifacts/benchmarks/1.0.0-summary.json"),
      "utf-8"
    );
    const b = JSON.parse(raw);
    benchmarkPassRate = b.pass_rate ?? null;
    benchmarkFixtures = b.fixture_count ?? 0;
    benchmarkTimestamp = b.timestamp ?? null;
    benchmarkStatus =
      b.pass_rate >= 1 ? "Healthy" : b.pass_rate > 0 ? "Watch" : "Needs Attention";
  } catch {
    // benchmark file not found — mark unknown
  }

  // Score changelog entries
  let scoreChangelogCount = 0;
  try {
    const files = readdirSync(join(process.cwd(), "docs/score-changelog"));
    scoreChangelogCount = files.filter((f) => f.endsWith(".md")).length;
  } catch {}

  // Example library count (content/examples/)
  let exampleCount = 0;
  const exampleNames: string[] = [];
  try {
    const files = readdirSync(join(process.cwd(), "content/examples"));
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    exampleCount = jsonFiles.length;
    const nameMap: Record<string, string> = {
      "safe-structured": "Safe Structured",
      "injection-vulnerable": "Injection Vulnerable",
      "jailbreak-attempt": "Jailbreak Attempt",
      "token-explosion": "Token Explosion",
      "tool-abuse": "Tool Abuse",
    };
    for (const f of jsonFiles) {
      const key = f.replace(".json", "");
      exampleNames.push(nameMap[key] ?? key);
    }
  } catch {}

  // Env check
  const envVarsToCheck = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "GITHUB_APP_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "CRON_SECRET",
    "NEXT_PUBLIC_POSTHOG_KEY",
    "SENTRY_DSN",
  ];
  const missingEnv = envVarsToCheck.filter((k) => !process.env[k]);
  const githubConfigured = !!(
    process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY
  );
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const postHogConfigured = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const sentryConfigured = !!process.env.SENTRY_DSN;

  // Health statuses
  const analyzeApiStatus: HealthStatus =
    totalApiCalls > 0
      ? "Healthy"
      : admin
      ? "Watch"
      : "Needs Attention";
  const supabaseStatus: HealthStatus = dbHealthy ? "Healthy" : "Needs Attention";
  const githubStatus: HealthStatus = githubConfigured
    ? githubInstalls > 0
      ? "Healthy"
      : "Watch"
    : "Not Configured";
  const stripeStatus: HealthStatus = stripeConfigured ? "Healthy" : "Not Configured";
  const envStatus: HealthStatus =
    missingEnv.length === 0
      ? "Healthy"
      : missingEnv.length <= 2
      ? "Watch"
      : "Needs Attention";

  // Badge adoption signal
  // Proxy: share_links count (each report can generate badge requests)
  const badgeSignal: "No signal yet" | "Early signal" | "Active usage" =
    totalShareLinks === 0
      ? "No signal yet"
      : totalShareLinks < 5
      ? "Early signal"
      : "Active usage";

  // Issues list
  const issues: Issue[] = [];

  if (!dbHealthy && admin) {
    issues.push({
      severity: "high",
      title: "Database connection issue",
      what: "Could not reach the Supabase database.",
      action: "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly.",
    });
  }

  if (benchmarkStatus === "Needs Attention") {
    issues.push({
      severity: "high",
      title: "Benchmark verification failing",
      what: `Safety Score benchmark is not passing all ${benchmarkFixtures} fixtures.`,
      action: "Run `pnpm benchmark` to diagnose the scoring engine.",
    });
  }

  if (missingEnv.length > 0) {
    issues.push({
      severity: missingEnv.length > 3 ? "high" : "medium",
      title: `${missingEnv.length} env variable${missingEnv.length === 1 ? "" : "s"} not configured`,
      what: `Missing: ${missingEnv.join(", ")}.`,
      action: "Add missing variables in your deployment environment settings.",
    });
  }

  if (!githubConfigured) {
    issues.push({
      severity: "medium",
      title: "GitHub App not configured",
      what: "GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is missing.",
      action: "Add GitHub App credentials to enable PR analysis and badge generation.",
    });
  } else if (githubInstalls === 0) {
    issues.push({
      severity: "medium",
      title: "No GitHub integrations connected",
      what: "No users have installed the GitHub App yet.",
      action: "Share the GitHub App install link with early users.",
    });
  }

  if (cveList.length === 0) {
    issues.push({
      severity: "medium",
      title: "CVE registry is empty",
      what: "The Prompt CVE Registry has no published entries yet.",
      action:
        "Run `POST /api/admin/intelligence/weekly` with CRON_SECRET to seed CVE records.",
    });
  }

  if (analysesPeriod.length === 0 && days <= 7) {
    issues.push({
      severity: "medium",
      title: "No analyses in this period",
      what: "No prompt analyses were run in the last 7 days.",
      action: "Drive traffic to the app or run a test analysis.",
    });
  }

  const topIssues = issues.slice(0, 5);

  // Launch health
  const hasHighIssue = topIssues.some((i) => i.severity === "high");
  const hasMediumIssue = topIssues.some((i) => i.severity === "medium");
  const launchHealth: LaunchHealth = hasHighIssue
    ? "Needs Attention"
    : hasMediumIssue
    ? "Watch"
    : "Healthy";

  const launchHealthColor: Record<LaunchHealth, string> = {
    Healthy: "text-green-400",
    Watch: "text-amber-400",
    "Needs Attention": "text-red-400",
  };

  // Funnel
  // Users → Analyses → Reports → CVE interest → GitHub (badge)
  const funnelSteps = [
    { label: "Registered Users", value: totalUsers },
    { label: "Analyses Run (all-time)", value: totalAnalyses },
    { label: "Reports Created", value: totalShareLinks },
    { label: "CVE Records Published", value: cveList.length },
    { label: "GitHub Integrations", value: githubInstalls },
  ];

  // Founder summary lines
  const summaryLines: string[] = [];
  summaryLines.push(
    launchHealth === "Healthy"
      ? "Launch is healthy."
      : launchHealth === "Watch"
      ? "Launch is progressing — a few things to watch."
      : "Launch needs attention — review the issues below."
  );
  if (analysesPeriod.length > 0) {
    summaryLines.push(
      `${analysesPeriod.length} ${analysesPeriod.length === 1 ? "analysis" : "analyses"} run in the ${dayLabel}.`
    );
  } else {
    summaryLines.push(`No analyses have been run in the ${dayLabel}.`);
  }
  if (totalUsers > 0) {
    summaryLines.push(
      `${totalUsers} registered ${totalUsers === 1 ? "user" : "users"} total${
        paidUsers > 0 ? `, ${paidUsers} on a paid plan` : ""
      }.`
    );
  }
  summaryLines.push(
    cveList.length > 0
      ? `${cveList.length} CVE ${cveList.length === 1 ? "record" : "records"} published in the registry.`
      : "CVE registry has no entries yet."
  );
  summaryLines.push(
    githubInstalls > 0
      ? `GitHub App connected by ${githubInstalls} ${githubInstalls === 1 ? "user" : "users"}.`
      : "GitHub App has not been connected by any user yet."
  );
  if (!postHogConfigured) {
    summaryLines.push(
      "Page view analytics unavailable — PostHog not configured for server-side queries."
    );
  }
  if (topIssues.length === 0) {
    summaryLines.push("No critical issues detected.");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Breadcrumb */}
      <div className="border-b border-white/5 bg-white/[0.02] px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <Link
            href="/dashboard"
            className="hover:text-foreground transition-colors"
          >
            &larr; Dashboard
          </Link>
          <span className="text-border">·</span>
          <span>Founder Analytics</span>
          <span className="text-border">·</span>
          <span className="text-xs text-zinc-600">Private</span>
        </div>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-10">

          {/* Page heading + date range */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Founder Dashboard
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Launch performance, product health, and user engagement.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { label: "Today", value: 1 },
                { label: "7D", value: 7 },
                { label: "30D", value: 30 },
              ].map(({ label, value }) => (
                <Link
                  key={value}
                  href={`/founder?days=${value}`}
                  className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                    days === value
                      ? "border-border bg-white/10 text-foreground"
                      : "border-white/10 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* ── 1. Founder Summary ────────────────────────────────────────── */}
          <div className="glass-card p-6 border-l-2 border-l-primary">
            <SectionHeading>Founder Summary</SectionHeading>
            <div className="mt-4 space-y-1.5">
              {summaryLines.map((line, i) => (
                <p key={i} className="text-sm text-foreground">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* ── 2. KPI Bar ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeading>Key Numbers</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                label="Registered Users"
                value={totalUsers}
                sub={paidUsers > 0 ? `${paidUsers} paid` : "All free tier"}
              />
              <KpiCard
                label={`Analyses (${dayLabel})`}
                value={analysesPeriod.length}
                sub={
                  totalAnalyses > 0
                    ? `${formatNumber(totalAnalyses)} all-time`
                    : undefined
                }
              />
              <KpiCard
                label="Reports Created"
                value={totalShareLinks}
                sub="All-time share links"
              />
              <KpiCard
                label="Launch Health"
                value={launchHealth}
                sub={`${topIssues.length} active issue${topIssues.length === 1 ? "" : "s"}`}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                label="CVE Records"
                value={cveList.length}
                sub={
                  cveList.length > 0
                    ? `${cveSeverity["critical"] ?? 0} critical, ${cveSeverity["high"] ?? 0} high`
                    : "Registry empty"
                }
              />
              <KpiCard
                label="GitHub Integrations"
                value={githubInstalls}
                sub={githubConfigured ? "App configured" : "App not configured"}
              />
              <KpiCard
                label={`API Calls (${dayLabel})`}
                value={totalApiCalls}
                sub={
                  totalTokens > 0
                    ? `${formatNumber(totalTokens)} tokens`
                    : undefined
                }
              />
              <KpiCard
                label="Badge Signal"
                value={badgeSignal}
                sub={`${formatNumber(totalShareLinks)} share links`}
              />
            </div>
          </div>

          {/* ── 3. Launch Funnel ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeading>Launch Funnel</SectionHeading>
            <div className="glass-card p-6">
              <div className="space-y-0">
                {funnelSteps.map((step, i) => {
                  const prev = i > 0 ? funnelSteps[i - 1].value : null;
                  const pct =
                    prev !== null && prev > 0
                      ? Math.round((step.value / prev) * 100)
                      : null;
                  const barWidth =
                    funnelSteps[0].value > 0
                      ? Math.max(
                          4,
                          Math.round((step.value / funnelSteps[0].value) * 100)
                        )
                      : 0;

                  return (
                    <div key={step.label}>
                      <div className="flex items-center gap-4 py-3">
                        <div className="w-48 shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {step.label}
                          </p>
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <p className="text-sm font-mono tabular-nums text-right w-12 shrink-0">
                            {formatNumber(step.value)}
                          </p>
                          {pct !== null && (
                            <p className="text-xs text-muted-foreground w-16 text-right shrink-0">
                              {pct}% of prev
                            </p>
                          )}
                        </div>
                      </div>
                      {i < funnelSteps.length - 1 && (
                        <div className="border-b border-white/5" />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Funnel is derived from DB counts — not session-based analytics.
              </p>
            </div>
          </div>

          {/* ── 4. What Developers Care About ────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeading>What Developers Are Using</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Model usage */}
              <div className="glass-card p-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  Top Models ({dayLabel})
                </p>
                {topModels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No API calls in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {topModels.map(([model, count]) => (
                      <div key={model} className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono text-foreground truncate">{model}</p>
                        <p className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                          {formatNumber(count)} calls
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Risk distribution */}
              <div className="glass-card p-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  Risk Distribution ({dayLabel})
                </p>
                {analysesPeriod.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No analyses in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {[
                      { label: "High risk (70+)", count: highRiskCount, color: "text-red-400" },
                      {
                        label: "Medium risk (40–69)",
                        count: analysesPeriod.filter(
                          (r) => r.risk_score >= 40 && r.risk_score < 70
                        ).length,
                        color: "text-amber-400",
                      },
                      {
                        label: "Low risk (<40)",
                        count: analysesPeriod.filter((r) => r.risk_score < 40).length,
                        color: "text-green-400",
                      },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <p className={`text-xs ${color}`}>{label}</p>
                        <p className="text-xs font-mono tabular-nums text-foreground">
                          {formatNumber(count)}
                        </p>
                      </div>
                    ))}
                    {avgRisk !== null && (
                      <div className="pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Avg risk score</p>
                          <p className="text-xs font-mono tabular-nums text-foreground">
                            {avgRisk}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CVE interest */}
              <div className="glass-card p-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  CVE Interest
                </p>
                {cveList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No CVEs published yet. Run the weekly intelligence job.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Total CVEs</p>
                      <p className="text-xs font-mono tabular-nums">{cveList.length}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Total incidents</p>
                      <p className="text-xs font-mono tabular-nums">
                        {formatNumber(totalIncidents)}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Most active
                      </p>
                      {cveList.slice(0, 3).map((cve) => (
                        <div key={cve.cve_id} className="flex items-center justify-between">
                          <Link
                            href={`/vulnerabilities/${cve.cve_id}`}
                            className="text-xs font-mono text-primary hover:underline truncate max-w-[160px]"
                          >
                            {cve.cve_id}
                          </Link>
                          <p className="text-xs text-muted-foreground shrink-0">
                            {cve.incident_count} incidents
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Badge adoption */}
              <div className="glass-card p-6 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  Badge Adoption Signal
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Signal</p>
                    <p
                      className={`text-xs font-mono ${
                        badgeSignal === "Active usage"
                          ? "text-green-400"
                          : badgeSignal === "Early signal"
                          ? "text-amber-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {badgeSignal}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Share links created</p>
                    <p className="text-xs font-mono tabular-nums">
                      {formatNumber(totalShareLinks)}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Badge adoption signal is inferred from share link creation. Direct
                  badge endpoint tracking requires server-side analytics.
                </p>
              </div>

            </div>

            {/* Example library */}
            <div className="glass-card p-6 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                Example Library ({exampleCount} examples published)
              </p>
              {exampleNames.length === 0 ? (
                <p className="text-xs text-muted-foreground">No examples found.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {exampleNames.map((name) => (
                    <Link
                      key={name}
                      href="/examples"
                      className="px-2.5 py-1 text-xs font-mono border border-white/10 rounded hover:border-white/20 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Example page view analytics require PostHog server-side config
                (POSTHOG_PROJECT_ID + POSTHOG_PERSONAL_API_KEY).
              </p>
            </div>
          </div>

          {/* ── 5. Trust Surfaces ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeading>Trust Surface Status</SectionHeading>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-6 font-medium text-muted-foreground">
                        Surface
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Route
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-right py-3 px-6 font-medium text-muted-foreground">
                        Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        surface: "Safety Score Methodology",
                        route: "/methodology",
                        status: "Healthy" as HealthStatus,
                        detail: "Published",
                      },
                      {
                        surface: "Calibration Report",
                        route: "/methodology/calibration",
                        status: "Healthy" as HealthStatus,
                        detail: "Published",
                      },
                      {
                        surface: "Score Change Log",
                        route: "/methodology/changes",
                        status: "Healthy" as HealthStatus,
                        detail: `${scoreChangelogCount} entr${scoreChangelogCount === 1 ? "y" : "ies"}`,
                      },
                      {
                        surface: "Vulnerability Registry",
                        route: "/vulnerabilities",
                        status:
                          cveList.length > 0
                            ? ("Healthy" as HealthStatus)
                            : ("Watch" as HealthStatus),
                        detail:
                          cveList.length > 0
                            ? `${cveList.length} CVEs`
                            : "Empty — run weekly job",
                      },
                      {
                        surface: "Example Library",
                        route: "/examples",
                        status:
                          exampleCount > 0
                            ? ("Healthy" as HealthStatus)
                            : ("Watch" as HealthStatus),
                        detail: `${exampleCount} examples`,
                      },
                      {
                        surface: "Benchmark Integrity",
                        route: "/methodology/calibration",
                        status: benchmarkStatus,
                        detail:
                          benchmarkPassRate !== null
                            ? `${Math.round(benchmarkPassRate * 100)}% pass (${benchmarkFixtures} fixtures)`
                            : "No data",
                      },
                    ].map(({ surface, route, status, detail }) => (
                      <tr
                        key={surface}
                        className="border-b border-border last:border-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-6 text-foreground">{surface}</td>
                        <td className="py-3 px-4">
                          <Link
                            href={route}
                            className="font-mono text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {route}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <StatusDot status={status} />
                            <StatusLabel status={status} />
                          </div>
                        </td>
                        <td className="py-3 px-6 text-right text-muted-foreground">
                          {detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── 6. Application Health ─────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeading>Application Health</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                {
                  label: "Analyze API",
                  status: analyzeApiStatus,
                  detail:
                    totalApiCalls > 0
                      ? `${formatNumber(totalApiCalls)} calls recorded`
                      : "No recent calls",
                },
                {
                  label: "Supabase",
                  status: supabaseStatus,
                  detail: dbHealthy ? "Connected" : "Connection failed",
                },
                {
                  label: "GitHub Integration",
                  status: githubStatus,
                  detail: githubConfigured
                    ? `${githubInstalls} install${githubInstalls === 1 ? "" : "s"}`
                    : "GITHUB_APP_ID / PRIVATE_KEY missing",
                },
                {
                  label: "Stripe",
                  status: stripeStatus,
                  detail: stripeConfigured
                    ? "Credentials configured"
                    : "STRIPE_SECRET_KEY missing",
                },
                {
                  label: "Benchmarks",
                  status: benchmarkStatus,
                  detail:
                    benchmarkPassRate !== null
                      ? `${Math.round(benchmarkPassRate * 100)}% pass${
                          benchmarkTimestamp
                            ? ` · ${new Date(benchmarkTimestamp).toLocaleDateString()}`
                            : ""
                        }`
                      : "No benchmark file found",
                },
                {
                  label: "Env Configuration",
                  status: envStatus,
                  detail:
                    missingEnv.length === 0
                      ? "All checked variables present"
                      : `${missingEnv.length} missing`,
                },
                {
                  label: "Error Monitoring",
                  status: sentryConfigured
                    ? ("Healthy" as HealthStatus)
                    : ("Not Configured" as HealthStatus),
                  detail: sentryConfigured
                    ? "Sentry configured — check dashboard"
                    : "SENTRY_DSN missing",
                },
                {
                  label: "Analytics",
                  status: postHogConfigured
                    ? ("Healthy" as HealthStatus)
                    : ("Not Configured" as HealthStatus),
                  detail: postHogConfigured
                    ? "PostHog active"
                    : "NEXT_PUBLIC_POSTHOG_KEY missing",
                },
              ].map(({ label, status, detail }) => (
                <div key={label} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusDot status={status} />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {label}
                    </p>
                  </div>
                  <StatusLabel status={status} />
                  <p className="text-xs text-muted-foreground mt-1">{detail}</p>
                </div>
              ))}
            </div>

            {/* Missing env details */}
            {missingEnv.length > 0 && (
              <div className="glass-card p-5 border border-amber-500/20">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400 mb-2">
                  Missing Variables
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingEnv.map((v) => (
                    <code
                      key={v}
                      className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10 text-amber-300"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 7. Needs Attention ────────────────────────────────────────── */}
          {topIssues.length > 0 && (
            <div className="space-y-3">
              <SectionHeading>Needs Attention Now</SectionHeading>
              <div className="space-y-3">
                {topIssues.map((issue, i) => (
                  <div
                    key={i}
                    className={`glass-card p-5 border-l-2 ${
                      issue.severity === "high"
                        ? "border-l-red-500"
                        : "border-l-amber-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                          issue.severity === "high"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {issue.severity}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {issue.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{issue.what}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="text-foreground font-medium">
                            Next action:{" "}
                          </span>
                          {issue.action}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topIssues.length === 0 && (
            <div className="glass-card p-6 text-center">
              <p className="text-sm text-green-400 font-medium">
                No active issues detected.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All monitored systems are healthy.
              </p>
            </div>
          )}

          {/* Footer note */}
          <div className="border-t border-white/5 pt-6">
            <p className="text-[10px] text-muted-foreground text-center">
              Founder dashboard &mdash; private. Data sourced from Supabase (service role), filesystem, and environment variables. Page view analytics require PostHog server-side configuration.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
