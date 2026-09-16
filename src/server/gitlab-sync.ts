import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { gitlabCommits, projectRepositories } from "@/db/schema";
import { env, isGitLabConfigured } from "@/env";
import { periodBounds, type Period } from "@/lib/billing";
import { getCommitBranches, getProject, listCommits, mapWithConcurrency } from "@/lib/gitlab";
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
  const since = new Date(start ?? now - MAX_LOOKBACK_MS);
  const until = new Date(Math.min(end, now));
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

    const commits = (await listCommits(gitlabProjectId, since, until)).filter(
      (commit) => authors.length === 0 || authors.includes(commit.author_email.toLowerCase()),
    );

    const known = new Set(
      db
        .select({ sha: gitlabCommits.sha })
        .from(gitlabCommits)
        .where(eq(gitlabCommits.repositoryId, repository.id))
        .all()
        .map((row) => row.sha),
    );
    const fresh = commits.filter((commit) => !known.has(commit.id));
    const branches = await mapWithConcurrency(fresh, 5, (commit) => getCommitBranches(gitlabProjectId, commit.id));

    db.transaction((tx) => {
      fresh.forEach((commit, index) => {
        tx.insert(gitlabCommits)
          .values({
            repositoryId: repository.id,
            sha: commit.id,
            title: commit.title,
            message: commit.message,
            authorName: commit.author_name,
            authorEmail: commit.author_email.toLowerCase(),
            authoredAt: Date.parse(commit.authored_date),
            webUrl: commit.web_url,
            additions: commit.stats?.additions ?? 0,
            deletions: commit.stats?.deletions ?? 0,
            branches: branches[index],
          })
          .onConflictDoNothing()
          .run();
      });
      tx.update(projectRepositories)
        .set({ lastSyncedAt: new Date(now) })
        .where(and(eq(projectRepositories.id, repository.id), eq(projectRepositories.projectId, projectId)))
        .run();
    });
  }
}
