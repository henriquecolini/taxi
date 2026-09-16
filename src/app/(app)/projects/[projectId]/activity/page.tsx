import { GitBranchIcon, GitCommitHorizontalIcon } from "lucide-react";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { SyncButton } from "@/components/activity/sync-button";
import { StatTile } from "@/components/charts/stat-tile";
import { CommitList } from "@/components/invoices/commit-list";
import { EmptyState } from "@/components/layout/page-header";
import { PeriodSelect } from "@/components/projects/period-select";
import { Badge } from "@/components/ui/badge";
import { isGitLabConfigured } from "@/env";
import { requireProjectAccess } from "@/lib/authz";
import { formatIsoDate } from "@/lib/format";
import { toIsoDate, type IsoDate } from "@/lib/time";
import { isSyncStale, syncProjectCommits } from "@/server/gitlab-sync";
import { listCommitsInPeriod } from "@/server/queries/commits";
import { timeZone } from "@/server/queries/periods";
import { resolvePeriodSelection } from "@/server/queries/selection";

export default async function ActivityPage({ params, searchParams }: PageProps<"/projects/[projectId]/activity">) {
  const { project, role } = await requireProjectAccess((await params).projectId);
  const { invoice } = await searchParams;
  const t = await getTranslations("activity");
  const locale = await getLocale();
  const tz = timeZone();

  const selection = resolvePeriodSelection(project.id, invoice, locale);
  const commits = listCommitsInPeriod(project.id, selection.period);

  // Keep the cache fresh for the owner without blocking the page. Clients never trigger GitLab calls.
  if (role === "owner" && selection.invoiceId === null && isSyncStale(project.id)) {
    after(() => syncProjectCommits(project.id, selection.period).catch((error) => console.error("Background GitLab sync failed", error)));
  }

  const branches = [...new Set(commits.flatMap((commit) => commit.branches))].sort();
  const additions = commits.reduce((sum, commit) => sum + commit.additions, 0);
  const deletions = commits.reduce((sum, commit) => sum + commit.deletions, 0);
  const byDay = new Map<IsoDate, typeof commits>();
  for (const commit of commits) {
    const date = toIsoDate(commit.authoredAt, tz);
    byDay.set(date, [...(byDay.get(date) ?? []), commit]);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PeriodSelect options={selection.options} selected={selection.invoiceId} />
        {role === "owner" && isGitLabConfigured() ? <SyncButton projectId={project.id} /> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("commits")} value={commits.length} />
        <StatTile label={t("branches")} value={branches.length} />
        <StatTile label={t("additions")} value={<span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{additions}</span>} />
        <StatTile label={t("deletions")} value={<span className="tabular-nums text-red-700 dark:text-red-400">−{deletions}</span>} />
      </div>

      {branches.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {branches.map((branch) => (
            <Badge key={branch} variant="secondary" className="gap-1 font-mono font-normal">
              <GitBranchIcon className="size-3" />
              {branch}
            </Badge>
          ))}
        </div>
      ) : null}

      {commits.length === 0 ? (
        <EmptyState
          icon={<GitCommitHorizontalIcon />}
          title={t("empty")}
          description={role === "owner" ? (isGitLabConfigured() ? t("emptyHint") : t("notConfigured")) : undefined}
        />
      ) : (
        <div className="grid gap-5">
          {[...byDay.entries()].map(([date, dayCommits]) => (
            <section key={date} className="grid gap-2">
              <h3 className="px-1 text-sm font-medium">
                {formatIsoDate(date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h3>
              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <CommitList commits={dayCommits} locale={locale} timeZone={tz} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
