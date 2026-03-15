import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { RiskScore } from "@/components/risk-score";
import { TokenDisplay } from "@/components/token-display";
import { ContextBar } from "@/components/context-bar";
import { CostDisplay } from "@/components/cost-display";
import { TruncationWarning } from "@/components/truncation-warning";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { RevokeButton } from "./revoke-button";
import { UpgradeButton } from "@/components/upgrade-button";
import type { ShareSnapshot } from "@/lib/share-schema";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared Analysis | CostGuardAI",
  description: "Read-only view of a CostGuardAI preflight analysis.",
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1 align-middle" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function ErrorCard() {
  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Share link
          </p>
          <p className="text-base font-semibold">This link is no longer available.</p>
          <p className="text-sm text-muted-foreground">
            It may have been revoked or expired.
          </p>
          <Link
            href="/"
            className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            Run your own analysis
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default async function SharedAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Auth check for owner detection (doesn't gate the page — public read)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pro status check for conversion hook — non-fatal, defaults to free
  let isUserPro = false;
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("pro")
      .eq("id", user.id)
      .maybeSingle();
    isUserPro = userRow?.pro === true;
  }
  const isAuthedNotPro = !!user && !isUserPro;

  // RLS enforces revoked=false and expiry automatically
  const { data: shareLink } = await supabase
    .from("share_links")
    .select("id, snapshot, user_id")
    .eq("id", id)
    .single();

  if (!shareLink) {
    return <ErrorCard />;
  }

  const isOwner = !!user && user.id === shareLink.user_id;
  const snapshot = shareLink.snapshot as ShareSnapshot;
  const { analysis, modelName, pricingLastUpdated } = snapshot;

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-lg space-y-4">

          {/* Badge row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground border border-white/10 rounded-full px-3 py-1 bg-white/5">
                Read-only · Shared analysis
              </span>
              <span className="text-xs text-muted-foreground">{modelName}</span>
            </div>
            <span className="text-xs text-muted-foreground/60">
              Pricing as of {pricingLastUpdated}
            </span>
          </div>

          {/* CostGuardAI Safety Score */}
          <Card className="glass-card shadow-none relative">
            <div className="absolute top-0 left-6 right-6 h-px bg-primary/30" />
            <CardContent className="pt-5 pb-4">
              <RiskScore
                score={analysis.riskScore}
                level={analysis.riskLevel}
                explanation={analysis.riskExplanation}
                riskDrivers={analysis.riskDrivers}
              />
            </CardContent>
          </Card>

          {/* Token count */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Token count
                <InfoTooltip text="Your prompt may exceed model context limits, causing truncation or failure." />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <TokenDisplay
                tokens={analysis.inputTokens}
                isEstimated={analysis.isEstimated}
                usageRatio={analysis.usageRatio}
              />
            </CardContent>
          </Card>

          {/* Context usage */}
          <Card className="glass-card shadow-none">
            <CardContent className="pt-4 pb-4">
              <ContextBar
                inputTokens={analysis.inputTokens}
                contextWindow={analysis.contextWindow}
                usagePercent={analysis.usagePercent}
                riskLevel={analysis.riskLevel}
              />
            </CardContent>
          </Card>

          {/* Cost estimate */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Cost estimate
                <InfoTooltip text="Small inefficiencies multiply significantly at high request volume." />
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <CostDisplay
                estimatedCostInput={analysis.estimatedCostInput}
                estimatedCostOutput={analysis.estimatedCostOutput}
                estimatedCostTotal={analysis.estimatedCostTotal}
                isEstimated={analysis.isEstimated}
              />
            </CardContent>
          </Card>

          {/* Truncation warning */}
          <TruncationWarning truncation={analysis.truncation} />

          {/* Owner revoke */}
          {isOwner && (
            <div className="flex justify-end pt-2">
              <RevokeButton shareId={shareLink.id} />
            </div>
          )}
        </div>
      </main>

      {/* Conversion hook */}
      <div className="mx-auto max-w-lg w-full px-4 pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Link
          href="/?ref=share"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Run your own preflight →
        </Link>
        {isAuthedNotPro && (
          <UpgradeButton moment="share_cta" variant="outline" size="sm" />
        )}
      </div>

      <Footer />
    </div>
  );
}
