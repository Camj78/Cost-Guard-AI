/**
 * GitHub App authentication helpers.
 *
 * Resolution order:
 *   1. GitHub App Installation token
 *      (requires GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + GITHUB_APP_INSTALLATION_ID)
 *   2. Personal Access Token (GITHUB_TOKEN) — kept for local dev / migration window
 *
 * Implementation uses Node.js built-in `crypto` (RS256 JWT signing).
 * No external JWT library required.
 */

import { createSign } from "crypto";

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 10_000;

interface CachedToken {
  token: string;
  expiresAt: number; // Unix ms
}

// In-process cache — reset on cold start, reused across warm invocations.
// Exported only for test teardown.
export const _tokenCache = new Map<string, CachedToken>();

export function clearTokenCache(): void {
  _tokenCache.clear();
}

/**
 * Sign a GitHub App JWT using RS256.
 *
 * Spec: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 *
 * - iss : GitHub App ID (string, as required by newer GitHub API versions)
 * - iat : now − 60 s  (60-second clock-skew buffer)
 * - exp : iat + 600 s (10-minute maximum; GitHub rejects longer tokens)
 * - alg : RS256
 *
 * Uses Node.js built-in crypto — no external library required.
 */
export function signJWT(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const iat = now - 60;
  const exp = iat + 600;

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");

  const payload = Buffer.from(
    JSON.stringify({ iat, exp, iss: appId })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;

  const signer = createSign("sha256WithRSAEncryption");
  signer.update(signingInput, "utf8");
  const sig = signer.sign(privateKeyPem, "base64url");

  return `${signingInput}.${sig}`;
}

/**
 * Exchange a GitHub App JWT for an Installation Access Token.
 *
 * Tokens are cached in-process. A new token is requested when less than
 * 5 minutes remain before expiry to avoid last-second races.
 */
export async function getInstallationToken(
  installationId: string,
  appId: string,
  privateKeyPem: string
): Promise<string> {
  const SAFETY_MS = 5 * 60 * 1000;
  const cached = _tokenCache.get(installationId);
  if (cached && cached.expiresAt - SAFETY_MS > Date.now()) {
    return cached.token;
  }

  const jwt = signJWT(appId, privateKeyPem);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `GitHub App token exchange failed (${res.status}): ${body}`
      );
    }

    const json = (await res.json()) as { token: string; expires_at: string };
    const expiresAt = new Date(json.expires_at).getTime();
    _tokenCache.set(installationId, { token: json.token, expiresAt });
    return json.token;
  } finally {
    clearTimeout(timer);
  }
}

interface InstallationAccount {
  account_login: string;
  account_id: number;
  account_type: string;
  repository_selection: string;
}

/**
 * Fetch installation details from GitHub using App-level JWT auth.
 *
 * Calls GET /app/installations/{installation_id} — requires App JWT, not
 * an installation token. Returns deterministic account metadata.
 *
 * Returns null on any error so callers can degrade gracefully.
 */
export async function getInstallationDetails(
  installationId: number,
  appId: string,
  privateKeyPem: string
): Promise<InstallationAccount | null> {
  const jwt = signJWT(appId, privateKeyPem);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GITHUB_API}/app/installations/${installationId}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[github/app-auth] getInstallationDetails ${installationId} failed (${res.status}): ${body}`
      );
      return null;
    }

    const json = (await res.json()) as {
      account: { login: string; id: number; type: string };
      repository_selection: string;
    };

    return {
      account_login: json.account.login,
      account_id: json.account.id,
      account_type: json.account.type,
      repository_selection: json.repository_selection,
    };
  } catch (err) {
    console.error("[github/app-auth] getInstallationDetails threw:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a GitHub API bearer token.
 *
 * GITHUB_APP_PRIVATE_KEY may contain literal `\n` separators (Vercel env
 * format) or real newlines — both are normalised before use.
 *
 * Throws if neither App credentials nor PAT are configured.
 */
export async function resolveGitHubToken(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (appId && rawKey && installationId) {
    const privateKeyPem = rawKey.replace(/\\n/g, "\n");
    return getInstallationToken(installationId, appId, privateKeyPem);
  }

  const pat = process.env.GITHUB_TOKEN;
  if (pat) return pat;

  throw new Error(
    "GitHub auth not configured. " +
      "Set GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY + GITHUB_APP_INSTALLATION_ID " +
      "for GitHub App auth, or GITHUB_TOKEN for PAT fallback."
  );
}
