/**
 * /api/github/install/callback
 *
 * GitHub App installation callback.
 *
 * GitHub redirects here after the user installs the CostGuardAI GitHub App:
 *   https://github.com/apps/costguard-ai/installations/new
 *
 * Query params sent by GitHub:
 *   installation_id  — numeric ID of the installation
 *   setup_action     — "install" | "update" | "delete"
 *
 * This route:
 *   1. Verifies the user is authenticated.
 *   2. Upserts the installation_id → user_id link in github_installations.
 *   3. Redirects back to /dashboard.
 *
 * To activate this flow, set the GitHub App's "Setup URL" to:
 *   https://<your-domain>/api/github/install/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getInstallationDetails } from "@/lib/github/app-auth";

export const dynamic = "force-dynamic";

const DASHBOARD_URL = "/dashboard";
const LOGIN_URL = "/upgrade";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawInstallationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action") ?? "install";

  // Ignore delete events — nothing to store
  if (setupAction === "delete") {
    return NextResponse.redirect(new URL(DASHBOARD_URL, req.url));
  }

  // Validate installation_id
  const installationId = rawInstallationId ? parseInt(rawInstallationId, 10) : NaN;
  if (!rawInstallationId || isNaN(installationId) || installationId <= 0) {
    return NextResponse.redirect(
      new URL(`${DASHBOARD_URL}?github_install=error`, req.url)
    );
  }

  // Verify session
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in — send to login, then back here after auth
    const callbackParam = encodeURIComponent(req.url);
    return NextResponse.redirect(
      new URL(`${LOGIN_URL}?next=${callbackParam}`, req.url)
    );
  }

  // Fetch GitHub installation metadata before the single upsert so we can
  // include all fields in one write. Failure is non-fatal — we still persist
  // the installation_id + user_id link so the user isn't blocked.
  let meta: { account_login: string; account_id: number; account_type: string; repository_selection: string } | null = null;
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !rawKey) {
    console.warn(
      `[github_install_backfill] skip installation_id=${installationId} reason=missing_env_vars`
    );
  } else {
    try {
      const privateKeyPem = rawKey.replace(/\\n/g, "\n");
      const result = await getInstallationDetails(installationId, appId, privateKeyPem);
      if (!result.ok) {
        console.error(
          `[github_install_backfill] fail installation_id=${installationId} user_id=${user.id} status=${result.status} reason=${result.message}`
        );
      } else {
        meta = result.data;
      }
    } catch (err) {
      console.error("[github_install_backfill] unexpected:", err);
    }
  }

  // ONE final admin upsert — always includes installation_id + user_id;
  // includes account fields only when non-null to prevent clobbering.
  const row: Record<string, unknown> = {
    installation_id: installationId,
    user_id: user.id,
    ...(meta?.account_login != null && { account_login: meta.account_login }),
    ...(meta?.account_id != null && { account_id: meta.account_id }),
    ...(meta?.account_type != null && { account_type: meta.account_type }),
    ...(meta?.repository_selection != null && { repository_selection: meta.repository_selection }),
  };

  const { error } = await getSupabaseAdmin()
    .from("github_installations")
    .upsert(row, { onConflict: "installation_id" });

  if (error) {
    console.error(
      `[github_install_backfill] upsert_fail installation_id=${installationId} user_id=${user.id} error=${error.message}`
    );
    return NextResponse.redirect(
      new URL(`${DASHBOARD_URL}?github_install=error`, req.url)
    );
  }

  console.log(
    `[github_install_backfill] ok installation_id=${installationId} user_id=${user.id}` +
    ` login=${meta?.account_login ?? "none"} account_id=${meta?.account_id ?? "none"} account_type=${meta?.account_type ?? "none"}`
  );

  return NextResponse.redirect(
    new URL(`${DASHBOARD_URL}?github_install=success`, req.url)
  );
}
