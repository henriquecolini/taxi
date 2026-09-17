import "server-only";
import { env } from "@/env";

/**
 * Minimal typed client for the GitLab REST API v4.
 * Authenticates with a personal access token (`read_api` scope is enough).
 */

export class GitLabError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitLabError";
  }
}

export interface GitLabProject {
  id: number;
  path_with_namespace: string;
  web_url: string;
}

export interface GitLabCommit {
  id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  web_url: string;
  stats?: { additions: number; deletions: number; total: number };
}

export interface GitLabBranch {
  name: string;
  commit: { id: string; committed_date: string };
}

export interface GitLabDiff {
  old_path: string;
  new_path: string;
  diff?: string;
}

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PAGES = 50;

async function request(path: string, params: Record<string, string | number | boolean> = {}): Promise<Response> {
  const { GITLAB_URL, GITLAB_TOKEN } = env();
  if (!GITLAB_TOKEN) throw new GitLabError("GitLab is not configured");

  const url = new URL(`/api/v4${path}`, GITLAB_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const response = await fetch(url, {
    headers: { "PRIVATE-TOKEN": GITLAB_TOKEN, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new GitLabError(`GitLab request failed: ${response.status} ${path}`, response.status);
  }
  return response;
}

async function getJson<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  return (await request(path, params)).json() as Promise<T>;
}

/** Follows `x-next-page` pagination headers. */
async function getAllPages<T>(path: string, params: Record<string, string | number | boolean>): Promise<T[]> {
  const items: T[] = [];
  let page: string | null = "1";
  for (let count = 0; page && count < MAX_PAGES; count++) {
    const response = await request(path, { ...params, per_page: 100, page });
    items.push(...((await response.json()) as T[]));
    page = response.headers.get("x-next-page") || null;
  }
  return items;
}

const encodeProject = (idOrPath: number | string) => encodeURIComponent(String(idOrPath));

export function getProject(path: string): Promise<GitLabProject> {
  return getJson<GitLabProject>(`/projects/${encodeProject(path)}`);
}

export function listBranches(projectId: number): Promise<GitLabBranch[]> {
  return getAllPages<GitLabBranch>(`/projects/${projectId}/repository/branches`, {});
}

/**
 * Commits reachable from one branch, committed between two instants.
 *
 * Note: GitLab filters `since`/`until` by *commit* date, and its `all=true`
 * option silently misses commits, so callers list each branch instead.
 */
export function listBranchCommits(projectId: number, branch: string, since: Date, until: Date): Promise<GitLabCommit[]> {
  return getAllPages<GitLabCommit>(`/projects/${projectId}/repository/commits`, {
    ref_name: branch,
    with_stats: true,
    since: since.toISOString(),
    until: until.toISOString(),
  });
}

export function getCommitDiff(projectId: number, sha: string): Promise<GitLabDiff[]> {
  return getJson<GitLabDiff[]>(`/projects/${projectId}/repository/commits/${encodeURIComponent(sha)}/diff`, {
    per_page: 100,
  });
}

/** Runs async work over items with bounded concurrency. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
