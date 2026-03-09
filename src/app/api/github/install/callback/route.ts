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

  // Upsert: if this installation_id is already linked (e.g. user reinstalls),
  // update the user_id so it's always current.
  const { error } = await supabase.from("github_installations").upsert(
    {
      user_id: user.id,
      installation_id: installationId,
    },
    {
      onConflict: "installation_id",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error("[github/install/callback] DB upsert failed:", error.message);
    return NextResponse.redirect(
      new URL(`${DASHBOARD_URL}?github_install=error`, req.url)
    );
  }

  // Backfill account metadata from GitHub API — deterministic, keyed by installation_id.
  // Failure is non-fatal: log and continue so the install flow always completes.
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const hasAppId = Boolean(appId);
  const hasKey = Boolean(rawKey);

  if (!hasAppId || !hasKey) {
    console.warn(
      `[github_install_backfill] skip installation_id=${installationId} hasAppId=${hasAppId} hasKey=${hasKey} reason=missing_env_vars`
    );
  } else {
    try {
      const privateKeyPem = rawKey!.replace(/\\n/g, "\n");
      const result = await getInstallationDetails(installationId, appId!, privateKeyPem);

      if (!result.ok) {
        console.error(
          `[github_install_backfill] fail installation_id=${installationId} status=${result.status} reason=${result.message}`
        );
      } else {
        const meta = result.data;
        const { error: metaError } = await supabase.from("github_installations").upsert(
          {
            installation_id: installationId,
            account_login: meta.account_login,
            account_id: meta.account_id,
            account_type: meta.account_type,
            repository_selection: meta.repository_selection,
          },
          { onConflict: "installation_id", ignoreDuplicates: false }
        );

        if (metaError) {
          console.error(
            `[github_install_backfill] upsert_fail installation_id=${installationId} error=${metaError.message}`
          );
        } else {
          console.log(
            `[github_install_backfill] ok installation_id=${installationId} login=${meta.account_login} account_id=${meta.account_id} account_type=${meta.account_type}`
          );
        }
      }
    } catch (err) {
      console.error("[github_install_backfill] unexpected:", err);
    }
  }

  return NextResponse.redirect(
    new URL(`${DASHBOARD_URL}?github_install=success`, req.url)
  );
}
