import { GitBranchIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ColumnChart } from "@/components/charts/charts";
import { StatTile } from "@/components/charts/stat-tile";
import { CommitList } from "@/components/invoices/commit-list";
import { Markdown } from "@/components/invoices/markdown";
import { ReportActions } from "@/components/invoices/report-actions";
import { SummaryBlock } from "@/components/invoices/summary-block";
import { ProjectLogo } from "@/components/projects/project-logo";
import { Badge } from "@/components/ui/badge";
import { isAiConfigured } from "@/env";
import { requireProjectAccess } from "@/lib/authz";
import { formatDuration, formatIsoDate, formatMoney, formatPeriodRange } from "@/lib/format";
import { addIsoDays, msToHours } from "@/lib/time";
import { groupCommitsByWeek, listCommitsInPeriod } from "@/server/queries/commits";
import { getInvoiceDetail } from "@/server/queries/invoices";
import { timeZone } from "@/server/queries/periods";
import { toProjectDto } from "@/server/queries/projects";

export default async function InvoiceReportPage({ params }: PageProps<"/projects/[projectId]/invoices/[invoiceId]">) {
  const { projectId, invoiceId } = await params;
  const { project, role } = await requireProjectAccess(projectId);
  const invoice = getInvoiceDetail(project.id, invoiceId);
  if (!invoice) notFound();

  const t = await getTranslations("report");
  const locale = await getLocale();
  const tz = timeZone();
  const isOwner = role === "owner";
  const dto = toProjectDto(project);
  const money = (cents: number) => formatMoney(cents, project.currency, locale);
  const range = formatPeriodRange(invoice.period, locale);

  const commitsByWeek = groupCommitsByWeek(listCommitsInPeriod(project.id, invoice.period));
  const commitCount = [...commitsByWeek.values()].reduce((sum, week) => sum + week.commits.length, 0);
  const summaries = new Map(invoice.summaries.map((summary) => [summary.scope, summary]));
  const overall = summaries.get("overall");
  const weeksByStart = new Map(invoice.summary.weeks.map((week) => [week.weekStart, week]));
  const weekStarts = [...new Set([...weeksByStart.keys(), ...commitsByWeek.keys()])].sort();

  const weeklyChart = weekStarts.map((weekStart) => {
    const durationMs = weeksByStart.get(weekStart)?.durationMs ?? 0;
    return {
      label: formatIsoDate(weekStart, locale, { day: "numeric", month: "short" }),
      title: t("weekOf", { date: formatIsoDate(weekStart, locale) }),
      value: msToHours(durationMs),
      display: formatDuration(durationMs),
    };
  });

  return (
    <div className="grid gap-6">
      <ReportActions
        projectId={project.id}
        invoiceId={invoice.id}
        isOwner={isOwner}
        canDelete={invoice.isLatest}
        canGenerate={isAiConfigured() && project.aiEnabled}
        hasSummaries={invoice.summaries.length > 0}
      />

      <article className="grid gap-8 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 sm:p-8 print:rounded-none print:p-0 print:ring-0">
        {/* Header */}
        <header className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <ProjectLogo name={dto.name} logoUrl={dto.logoUrl} className="size-14" />
            <div>
              <p className="text-lg font-semibold tracking-tight">{dto.name}</p>
              {dto.clientName ? <p className="text-sm text-muted-foreground">{dto.clientName}</p> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("invoice")}</p>
            <h1 className="text-xl font-semibold tracking-tight">{invoice.name}</h1>
            <p className="text-sm text-muted-foreground">
              {range.start ? `${range.start} – ${range.end}` : t("until", { date: range.end })}
            </p>
          </div>
        </header>

        {/* Hero total */}
        <section className="grid gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("total")}</p>
            <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {money(invoice.snapshot.total)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t("hours")} value={<span className="tabular-nums">{formatDuration(invoice.snapshot.durationMs)}</span>} />
            <StatTile label={t("daysWorked")} value={invoice.summary.days.length} />
            <StatTile label={t("commits")} value={commitCount} />
            <StatTile label={t("weeks")} value={weekStarts.length} />
          </div>
        </section>

        {/* Overall summary */}
        {overall || isOwner ? (
          <section className="grid gap-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold tracking-tight">{t("overview")}</h2>
            <SummaryBlock
              projectId={project.id}
              invoiceId={invoice.id}
              scope="overall"
              headline={overall?.headline ?? ""}
              content={overall?.content ?? ""}
              canEdit={isOwner}
            >
              {overall ? <Markdown>{overall.content}</Markdown> : null}
            </SummaryBlock>
          </section>
        ) : null}

        {/* Weekly breakdown */}
        {weekStarts.length > 0 ? (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{t("weekly")}</h2>
            {weekStarts.length > 1 ? (
              <div className="rounded-xl p-2 ring-1 ring-foreground/10 print:break-inside-avoid">
                <ColumnChart data={weeklyChart} formatTick="hours" locale={locale} ariaLabel={t("weeklyHoursChart")} />
              </div>
            ) : null}
            <ol className="grid gap-4">
              {weekStarts.map((weekStart) => {
                const week = weeksByStart.get(weekStart);
                const activity = commitsByWeek.get(weekStart);
                const summary = summaries.get(weekStart);
                return (
                  <li key={weekStart} className="grid gap-4 rounded-xl p-4 ring-1 ring-foreground/10 sm:p-5 print:break-inside-avoid">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-semibold">
                        {t("weekRange", {
                          start: formatIsoDate(weekStart, locale, { day: "numeric", month: "short" }),
                          end: formatIsoDate(addIsoDays(weekStart, 6), locale, { day: "numeric", month: "short", year: "numeric" }),
                        })}
                      </h3>
                      <p className="flex gap-4 text-sm tabular-nums">
                        <span>{formatDuration(week?.durationMs ?? 0)}</span>
                        <span className="text-muted-foreground">{money(week?.amount ?? 0)}</span>
                      </p>
                    </div>

                    <SummaryBlock
                      projectId={project.id}
                      invoiceId={invoice.id}
                      scope={weekStart}
                      headline={summary?.headline ?? ""}
                      content={summary?.content ?? ""}
                      canEdit={isOwner}
                    >
                      {summary ? <Markdown>{summary.content}</Markdown> : null}
                    </SummaryBlock>

                    {activity ? (
                      <div className="grid gap-3 border-t pt-4">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{t("commitCount", { count: activity.commits.length })}</span>
                          <span className="tabular-nums">
                            <span className="text-emerald-700 dark:text-emerald-400">+{activity.additions}</span>{" "}
                            <span className="text-red-700 dark:text-red-400">−{activity.deletions}</span>
                          </span>
                        </p>
                        {activity.branches.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {activity.branches.slice(0, 12).map((branch) => (
                              <Badge key={branch} variant="secondary" className="gap-1 font-mono font-normal">
                                <GitBranchIcon className="size-3" />
                                {branch}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <details className="group/commits print:hidden">
                          <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none hover:text-foreground">
                            {t("showCommits")}
                          </summary>
                          <div className="mt-3">
                            <CommitList commits={activity.commits} locale={locale} timeZone={tz} />
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {/* Line items */}
        <section className="grid gap-3 print:break-inside-avoid">
          <h2 className="text-lg font-semibold tracking-tight">{t("breakdown")}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t("item")}</th>
                <th className="py-2 text-right font-medium">{t("quantity")}</th>
                <th className="hidden py-2 text-right font-medium sm:table-cell">{t("unitPrice")}</th>
                <th className="py-2 text-right font-medium">{t("amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.summary.byRate.map((row) => (
                <tr key={row.rate}>
                  <td className="py-2.5">{t("hoursItem")}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatDuration(row.durationMs)}</td>
                  <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{t("perHour", { rate: money(row.rate) })}</td>
                  <td className="py-2.5 text-right tabular-nums">{money(row.amount)}</td>
                </tr>
              ))}
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2.5">{item.description}</td>
                  <td className="py-2.5 text-right text-muted-foreground">—</td>
                  <td className="hidden py-2.5 text-right text-muted-foreground sm:table-cell">—</td>
                  <td className="py-2.5 text-right tabular-nums">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/20 text-base font-semibold">
                <td className="pt-3" colSpan={2}>
                  {t("total")}
                </td>
                <td className="hidden sm:table-cell" />
                <td className="pt-3 text-right tabular-nums">{money(invoice.snapshot.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="border-t pt-4 text-xs text-muted-foreground">
          {t("issued", { date: formatIsoDate(invoice.period.through, locale, { dateStyle: "long" }) })}
        </footer>
      </article>
    </div>
  );
}
