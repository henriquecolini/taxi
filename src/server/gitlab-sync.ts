import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { gitlabCommits, projectRepositories } from "@/db/schema";
import { env, isGitLabConfigured } from "@/env";
import { periodBounds, type Period } from "@/lib/billing";
import { getProject, listBranchCommits, listBranches, mapWithConcurrency, type GitLabCommit } from "@/lib/gitlab";
import { timeZone } from "./queries/periods";

/** How far back to look when a period has no lower bound (no invoices yet). */
const MAX_LOOKBACK_MS = 180 * 86_400_000;
/** Owner page views re-sync in the background after this long. */
export const SYNC_STALE_MS = 15 * 60_000;

const inFlight = new Map<string, Promise<void>>();

/**
 * Fetches commits of every repository of a project for a period and caches
 * their metadata (title, message, stats, branches). Concurrent calls for the
 * same project and period share one run.
 *
 * How it works, and why:
 * - Each branch with activity since the period start is listed separately.
 *   GitLab's `all=true` shortcut silently skips commits, and listing branches
 *   also tells us which branches contain each commit, with no extra requests.
 * - GitLab filters by commit date while reports group by authored date, so the
 *   listing runs up to *now*: commits authored in the period but rebased or
 *   amended later are still found.
 * - Cached commits authored in the period that no branch contains anymore
 *   (e.g. the pre-rebase copies) are removed, so reports don't show duplicates.
 */
export function syncProjectCommits(projectId: string, period: Period): Promise<void> {
  const key = `${projectId}:${period.after}:${period.through}`;
  const running = inFlight.get(key);
  if (running) return running;
  const run = doSync(projectId, period).finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

/** Whether any repository of the project hasn't been synced recently. */
export function isSyncStale(projectId: string, now = Date.now()): boolean {
  if (!isGitLabConfigured()) return false;
  return getDb()
    .select({ lastSyncedAt: projectRepositories.lastSyncedAt })
    .from(projectRepositories)
    .where(eq(projectRepositories.projectId, projectId))
    .all()
    .some((repo) => !repo.lastSyncedAt || now - repo.lastSyncedAt.getTime() > SYNC_STALE_MS);
}

async function doSync(projectId: string, period: Period): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const { start, end } = periodBounds(period, timeZone());
  const since = start ?? now - MAX_LOOKBACK_MS;
  const authors = env().GITLAB_AUTHOR_EMAILS;

  const repositories = db.select().from(projectRepositories).where(eq(projectRepositories.projectId, projectId)).all();

  for (const repository of repositories) {
    let gitlabProjectId = repository.gitlabProjectId;
    if (gitlabProjectId === null) {
      const project = await getProject(repository.path);
      gitlabProjectId = project.id;
      db.update(projectRepositories)
        .set({ gitlabProjectId: project.id, webUrl: project.web_url })
        .where(eq(projectRepositories.id, repository.id))
        .run();
    }

    // A branch whose latest commit predates the period can't contain newer commits.
    const branches = (await listBranches(gitlabProjectId)).filter(
      (branch) => Date.parse(branch.commit.committed_date) >= since,
    );
    const listings = await mapWithConcurrency(branches, 4, async (branch) => ({
      branch: branch.name,
      commits: await listBranchCommits(gitlabProjectId, branch.name, new Date(since), new Date(now)),
    }));

    const found = new Map<string, { commit: GitLabCommit; branches: string[] }>();
    for (const { branch, commits } of listings) {
      for (const commit of commits) {
        if (authors.length > 0 && !authors.includes(commit.author_email.toLowerCase())) continue;
        const entry = found.get(commit.id) ?? { commit, branches: [] };
        entry.branches.push(branch);
        found.set(commit.id, entry);
      }
    }

    const inPeriod = and(
      eq(gitlabCommits.repositoryId, repository.id),
      gte(gitlabCommits.authoredAt, since),
      lt(gitlabCommits.authoredAt, Math.min(end, now)),
    );

    db.transaction((tx) => {
      for (const { commit, branches: names } of found.values()) {
        const values = {
          title: commit.title,
          message: commit.message,
          authorName: commit.author_name,
          authorEmail: commit.author_email.toLowerCase(),
          authoredAt: Date.parse(commit.authored_date),
          webUrl: commit.web_url,
          additions: commit.stats?.additions ?? 0,
          deletions: commit.stats?.deletions ?? 0,
          branches: names.sort(),
        };
        tx.insert(gitlabCommits)
          .values({ repositoryId: repository.id, sha: commit.id, ...values })
          .onConflictDoUpdate({ target: [gitlabCommits.repositoryId, gitlabCommits.sha], set: values })
          .run();
      }

      // Drop cached commits of this period that are no longer on any branch.
      for (const { id, sha } of tx.select({ id: gitlabCommits.id, sha: gitlabCommits.sha }).from(gitlabCommits).where(inPeriod).all()) {
        if (!found.has(sha)) tx.delete(gitlabCommits).where(eq(gitlabCommits.id, id)).run();
      }

      tx.update(projectRepositories)
        .set({ lastSyncedAt: new Date(now) })
        .where(eq(projectRepositories.id, repository.id))
        .run();
    });
  }
}
