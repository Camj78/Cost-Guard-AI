/**
 * GitHub App configuration — single source of truth.
 *
 * App slug: read from NEXT_PUBLIC_GITHUB_APP_SLUG env var.
 * Falls back to "costguardai" for local dev / unset environments.
 *
 * To configure the full installation flow:
 *   1. Set NEXT_PUBLIC_GITHUB_APP_SLUG in your environment.
 *   2. In your GitHub App settings, set the "Setup URL" to:
 *        https://<your-domain>/api/github/install/callback
 *      This is the URL GitHub redirects to after the user installs the App.
 *   3. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY (server-only) so the
 *      /api/github/repos route can fetch repository lists.
 */

const APP_SLUG =
  process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "costguard-ai";

/** URL that opens the GitHub App installation page. */
export const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${APP_SLUG}/installations/new`;

/** App slug (useful for constructing per-repo app links). */
export const GITHUB_APP_SLUG = APP_SLUG;
