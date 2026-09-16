import "server-only";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { gitlabCommits, projectRepositories } from "@/db/schema";
import { env } from "@/env";
import { periodBounds, type Period } from "@/lib/billing";
import { toIsoDate, weekStartOf, type IsoDate } from "@/lib/time";
import { timeZone } from "./periods";

export interface CommitDto {
  sha: string;
  title: string;
  message: string;
  authorName: string;
  authoredAt: number;
  webUrl: string;
  additions: number;
  deletions: number;
  branches: string[];
  repository: string;
}

/** Cached commits of a project authored within a period, newest first. */
export function listCommitsInPeriod(projectId: string, period: Period): CommitDto[] {
  const { start, end } = periodBounds(period, timeZone());
  const authors = env().GITLAB_AUTHOR_EMAILS;
  return getDb()
    .select({
      sha: gitlabCommits.sha,
      title: gitlabCommits.title,
      message: gitlabCommits.message,
      authorName: gitlabCommits.authorName,
      authoredAt: gitlabCommits.authoredAt,
      webUrl: gitlabCommits.webUrl,
      additions: gitlabCommits.additions,
      deletions: gitlabCommits.deletions,
      branches: gitlabCommits.branches,
      repository: projectRepositories.path,
    })
    .from(gitlabCommits)
    .innerJoin(projectRepositories, eq(gitlabCommits.repositoryId, projectRepositories.id))
    .where(
      and(
        eq(projectRepositories.projectId, projectId),
        start === null ? undefined : gte(gitlabCommits.authoredAt, start),
        lt(gitlabCommits.authoredAt, end),
        authors.length > 0 ? inArray(gitlabCommits.authorEmail, authors) : undefined,
      ),
    )
    .orderBy(desc(gitlabCommits.authoredAt))
    .all();
}

export interface WeekActivity {
  commits: CommitDto[];
  branches: string[];
  additions: number;
  deletions: number;
}

/** Groups commits by the Monday of the week they were authored in. */
export function groupCommitsByWeek(commits: CommitDto[]): Map<IsoDate, WeekActivity> {
  const tz = timeZone();
  const weeks = new Map<IsoDate, WeekActivity>();
  for (const commit of commits) {
    const week = weekStartOf(toIsoDate(commit.authoredAt, tz));
    const entry = weeks.get(week) ?? { commits: [], branches: [], additions: 0, deletions: 0 };
    entry.commits.push(commit);
    entry.additions += commit.additions;
    entry.deletions += commit.deletions;
    for (const branch of commit.branches) {
      if (!entry.branches.includes(branch)) entry.branches.push(branch);
    }
    weeks.set(week, entry);
  }
  return weeks;
}
