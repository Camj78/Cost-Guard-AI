import { resolveGitHubToken } from "./app-auth";

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 10_000;

/** Maximum diff bytes to retrieve — prevents runaway memory on giant PRs. */
export const MAX_DIFF_BYTES = 200_000;

// ─── Extra interfaces for virality flow ─────────────────────────────────────

export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  head: { sha: string };
  node_id: string;
}

export interface GitHubPRFile {
  filename: string;
  status: string;
}

export interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
}

// ─── Token-aware request helper (for dynamic installation IDs) ───────────────

async function githubRequestWithToken(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Virality API helpers ────────────────────────────────────────────────────

/** List open pull requests (up to 10) for a repo. */
export async function listOpenPullRequests(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubPR[]> {
  const res = await githubRequestWithToken(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=10`,
    token
  );
  return (await res.json()) as GitHubPR[];
}

/** List files changed in a pull request (up to 100). */
export async function getPullRequestFiles(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<GitHubPRFile[]> {
  const res = await githubRequestWithToken(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    token
  );
  return (await res.json()) as GitHubPRFile[];
}

/** Return the flat file tree for the default branch of a repo. */
export async function getRepoTree(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubTreeItem[]> {
  // 1. Resolve default branch
  const repoRes = await githubRequestWithToken(
    `${GITHUB_API}/repos/${owner}/${repo}`,
    token
  );
  const repoData = (await repoRes.json()) as { default_branch: string };
  const branch = repoData.default_branch ?? "main";

  // 2. Fetch recursive tree (GitHub truncates at ~100 k items — plenty for our purposes)
  const treeRes = await githubRequestWithToken(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token
  );
  const treeData = (await treeRes.json()) as { tree: GitHubTreeItem[] };
  return treeData.tree ?? [];
}

/** Create a GitHub issue and return its number. */
export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  token: string
): Promise<number> {
  const res = await githubRequestWithToken(
    `${GITHUB_API}/repos/${owner}/${repo}/issues`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    }
  );
  const data = (await res.json()) as { number: number };
  return data.number;
}

async function githubRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await resolveGitHubToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface GitHubComment {
  id: number;
  body: string;
  user: { login: string; type: string };
}

export async function listIssueComments(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubComment[]> {
  const res = await githubRequest(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`
  );
  return (await res.json()) as GitHubComment[];
}

export async function createIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await githubRequest(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
}

export async function updateIssueComment(
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<void> {
  await githubRequest(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
}

/** Delete a single issue comment. GitHub returns 204 No Content on success. */
export async function deleteIssueComment(
  owner: string,
  repo: string,
  commentId: number
): Promise<void> {
  await githubRequest(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/comments/${commentId}`,
    { method: "DELETE" }
  );
}

/**
 * Fetch the unified diff for a PR (Accept: application/vnd.github.v3.diff).
 * Returns at most MAX_DIFF_BYTES characters.
 */
export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const token = await resolveGitHubToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3.diff",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GitHub API diff error ${res.status}: ${text}`);
    }

    const text = await res.text();
    return text.length > MAX_DIFF_BYTES ? text.slice(0, MAX_DIFF_BYTES) : text;
  } finally {
    clearTimeout(timer);
  }
}
