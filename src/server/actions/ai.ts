"use server";

import { and, asc, eq, gte, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { gitlabCommits, invoices, invoiceSummaries, projectRepositories } from "@/db/schema";
import { env, isAiConfigured, isGitLabConfigured } from "@/env";
import { AiError, summarizeInvoice, type CommitForSummary } from "@/lib/ai";
import { requireProjectOwner } from "@/lib/authz";
import { periodBounds, periodFor, summarize } from "@/lib/billing";
import { periodStartDate } from "@/lib/format";
import { toIsoDate, weekStartOf } from "@/lib/time";
import { runAction, UserError } from "../action";
import { syncProjectCommits } from "../gitlab-sync";
import { getIntervalsInPeriod, getPreviousInvoiceDate, timeZone } from "../queries/periods";

/**
 * Generates (or regenerates) the weekly and overall AI summaries of an
 * invoice, replacing any previous or manually edited ones.
 */
export async function generateInvoiceSummaries(projectId: string, invoiceId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    if (!isAiConfigured()) throw new UserError("aiNotConfigured");
    if (!project.aiEnabled) throw new UserError("aiDisabled");

    const db = getDb();
    const invoice = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, z.string().parse(invoiceId)), eq(invoices.projectId, project.id)))
      .get();
    if (!invoice) throw new UserError("invalidInput");

    const tz = timeZone();
    const period = periodFor(getPreviousInvoiceDate(project.id, invoice.date), invoice.date);
    const intervals = getIntervalsInPeriod(project.id, period);
    const summary = summarize(intervals, { timeZone: tz, now: Date.now() });

    if (isGitLabConfigured()) {
      try {
        await syncProjectCommits(project.id, period);
      } catch (error) {
        console.error("GitLab sync before AI summary failed", error);
      }
    }
    const commits = loadCommits(project.id, period);

    // Collect everything per week: hours, interval notes and commits.
    const weeks = new Map<string, { durationMs: number; notes: string[]; commits: CommitForSummary[] }>();
    const weekOf = (instant: number) => weekStartOf(toIsoDate(instant, tz));
    const entry = (weekStart: string) => {
      const existing = weeks.get(weekStart) ?? { durationMs: 0, notes: [], commits: [] };
      weeks.set(weekStart, existing);
      return existing;
    };
    for (const week of summary.weeks) entry(week.weekStart).durationMs = week.durationMs;
    for (const interval of intervals) if (interval.note) entry(weekOf(interval.startedAt)).notes.push(interval.note);
    for (const commit of commits) entry(weekOf(commit.authoredAt)).commits.push(commit);

    const projectContext = {
      name: project.name,
      clientName: project.clientName,
      description: project.description,
      locale: project.aiLocale,
    };

    try {
      const { overall, weeks: weekly } = await summarizeInvoice(projectContext, {
        from: periodStartDate(period),
        through: period.through,
        durationMs: summary.durationMs,
        weeks: [...weeks.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([weekStart, week]) => ({ weekStart, ...week })),
      });

      const model = env().ANTHROPIC_MODEL;
      db.transaction((tx) => {
        tx.delete(invoiceSummaries).where(eq(invoiceSummaries.invoiceId, invoice.id)).run();
        const rows = [
          ...(overall ? [{ scope: "overall", ...overall }] : []),
          ...weekly.map(({ weekStart, ...rest }) => ({ scope: weekStart, ...rest })),
        ];
        if (rows.length > 0) {
          tx.insert(invoiceSummaries)
            .values(rows.map((row) => ({ invoiceId: invoice.id, model, ...row })))
            .run();
        }
      });
    } catch (error) {
      if (error instanceof AiError) {
        console.error("AI summary generation failed", error);
        throw new UserError("aiError");
      }
      throw error;
    }

    revalidatePath("/", "layout");
  });
}

function loadCommits(projectId: string, period: ReturnType<typeof periodFor>): CommitForSummary[] {
  const { start, end } = periodBounds(period, timeZone());
  const authors = env().GITLAB_AUTHOR_EMAILS;
  return getDb()
    .select({
      gitlabProjectId: projectRepositories.gitlabProjectId,
      repository: projectRepositories.path,
      sha: gitlabCommits.sha,
      title: gitlabCommits.title,
      message: gitlabCommits.message,
      authoredAt: gitlabCommits.authoredAt,
      additions: gitlabCommits.additions,
      deletions: gitlabCommits.deletions,
      branches: gitlabCommits.branches,
      authorEmail: gitlabCommits.authorEmail,
    })
    .from(gitlabCommits)
    .innerJoin(projectRepositories, eq(gitlabCommits.repositoryId, projectRepositories.id))
    .where(
      and(
        eq(projectRepositories.projectId, projectId),
        start === null ? undefined : gte(gitlabCommits.authoredAt, start),
        lt(gitlabCommits.authoredAt, end),
      ),
    )
    .orderBy(asc(gitlabCommits.authoredAt))
    .all()
    .filter((commit) => authors.length === 0 || authors.includes(commit.authorEmail));
}
