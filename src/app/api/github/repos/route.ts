/**
 * GET /api/github/repos
 *
 * Returns the list of repositories accessible to the user's GitHub App
 * installation(s).
 *
 * Flow:
 *   1. Verify user session.
 *   2. Look up installation_id(s) for this user in github_installations.
 *   3. For each installation, exchange a GitHub App JWT for an installation
 *      access token, then call:
 *        GET /user/installations/{installation_id}/repositories
 *   4. Return deduplicated repo list.
 *
 * Requires:
 *   GITHUB_APP_ID          — GitHub App ID (numeric, stored as string)
 *   GITHUB_APP_PRIVATE_KEY — RSA private key PEM (literal \n ok for Vercel)
 *
 * Falls back gracefully: if env vars are missing, returns [] (not an error)
 * so the dashboard degrades to the empty state rather than erroring.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { getInstallationToken } from "@/lib/github/app-auth";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 8_000;

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  updated_at: string | null;
}

interface InstallationReposResponse {
  repositories: GitHubRepo[];
}

async function fetchReposForInstallation(
  installationId: number,
  appId: string,
  privateKeyPem: string
): Promise<GitHubRepo[]> {
  const token = await getInstallationToken(
    String(installationId),
    appId,
    privateKeyPem
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GITHUB_API}/user/installations/${installationId}/repositories?per_page=100`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!res.ok) {
      console.error(
        `[github/repos] GitHub API ${res.status} for installation ${installationId}`
      );
      return [];
    }

    const json = (await res.json()) as InstallationReposResponse;
    return json.repositories ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  // 1. Auth check
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Look up installations for this user
  const { data: rows, error: dbError } = await supabase
    .from("github_installations")
    .select("installation_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ repos: [] });
  }

  // 3. Fetch repos — requires GitHub App credentials
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !rawKey) {
    // Credentials not configured — return empty (dashboard shows CTA)
    return NextResponse.json({ repos: [] });
  }

  const privateKeyPem = rawKey.replace(/\\n/g, "\n");

  // Fetch repos for all installations, deduplicate by repo id
  const seen = new Set<number>();
  const repos: GitHubRepo[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const repoList = await fetchReposForInstallation(
          row.installation_id,
          appId,
          privateKeyPem
        );
        for (const repo of repoList) {
          if (!seen.has(repo.id)) {
            seen.add(repo.id);
            repos.push(repo);
          }
        }
      } catch (err) {
        console.error(
          `[github/repos] Failed for installation ${row.installation_id}:`,
          err
        );
      }
    })
  );

  // Sort alphabetically
  repos.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return NextResponse.json({ repos });
}
