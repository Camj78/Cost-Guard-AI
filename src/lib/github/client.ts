const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 10_000;

/** Maximum diff bytes to retrieve — prevents runaway memory on giant PRs. */
export const MAX_DIFF_BYTES = 200_000;

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  return token;
}

async function githubRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getToken()}`,
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

/**
 * Fetch the unified diff for a PR (Accept: application/vnd.github.v3.diff).
 * Returns at most MAX_DIFF_BYTES characters.
 */
export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${getToken()}`,
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
