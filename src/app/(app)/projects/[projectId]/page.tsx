import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ColumnChart, CumulativeChart } from "@/components/charts/charts";
import { StatTile } from "@/components/charts/stat-tile";
import { IntervalList } from "@/components/intervals/interval-list";
import { EstimateDateButton } from "@/components/projects/estimate-date-button";
import { LiveBadge } from "@/components/timer/live-badge";
import { TimerCard } from "@/components/timer/timer-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireProjectAccess } from "@/lib/authz";
import { estimateInvoice, summarize } from "@/lib/billing";
import { formatDuration, formatIsoDate, formatMoney, formatPeriodRange, periodStartDate } from "@/lib/format";
import { groupCommitsByWeek, listCommitsInPeriod } from "@/server/queries/commits";
import { getIntervalsInPeriod, getOpenPeriod, getRunningInterval, requestNow, timeZone, todayIso } from "@/server/queries/periods";
import { getTimerState } from "@/server/queries/projects";
import { buildDailySeries } from "@/server/queries/reports";

export default async function ProjectOverviewPage({ params }: PageProps<"/projects/[projectId]">) {
  const { project, role } = await requireProjectAccess((await params).projectId);
  const t = await getTranslations("overview");
  const locale = await getLocale();
  const now = requestNow();

  const period = getOpenPeriod(project.id, now);
  const intervals = getIntervalsInPeriod(project.id, period);
  const summary = summarize(intervals, { timeZone: timeZone(), now });
  const commitsByWeek = groupCommitsByWeek(listCommitsInPeriod(project.id, period));
  const commitCount = [...commitsByWeek.values()].reduce((sum, week) => sum + week.commits.length, 0);
  const series = buildDailySeries(period, summary, project.currency, locale);
  const range = formatPeriodRange(period, locale);
  const daysWorked = summary.days.length;
  const estimate = estimateInvoice({
    latestInvoiceDate: period.after,
    firstWorkedDate: summary.days[0]?.date ?? null,
    today: todayIso(now),
    chosenDate: project.estimatedInvoiceDate,
    subtotal: summary.subtotal,
  });
  const running = getRunningInterval();
  const money = (cents: number) => formatMoney(cents, project.currency, locale);

  const weekStarts = [...new Set([...summary.weeks.map((w) => w.weekStart), ...commitsByWeek.keys()])].sort().reverse();
  const weeks = new Map(summary.weeks.map((week) => [week.weekStart, week]));

  return (
    <div className="grid gap-6">
      {role === "owner" && !project.archivedAt ? (
        <TimerCard projects={[{ id: project.id, name: project.name }]} timer={getTimerState(now)} projectId={project.id} fixedProject />
      ) : running?.projectId === project.id ? (
        <LiveBadge startedAt={running.startedAt} serverNow={now} />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("currentPeriod")}</h2>
          <p className="text-sm text-muted-foreground">
            {range.start ? t("range", { start: range.start, end: range.end }) : t("rangeUntil", { end: range.end })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{t("rate", { rate: money(project.hourlyRate) })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={t("hours")} value={<span className="tabular-nums">{formatDuration(summary.durationMs)}</span>} />
        <StatTile label={t("amount")} value={<span className="tabular-nums">{money(summary.subtotal)}</span>} />
        <StatTile
          label={t("estimatedAmount")}
          value={<span className="tabular-nums">{money(estimate.amount)}</span>}
          hint={
            <span className="inline-flex items-center gap-1">
              {t("estimateUntil", { date: formatIsoDate(estimate.date, locale) })}
              {role === "owner" ? (
                <EstimateDateButton
                  projectId={project.id}
                  date={estimate.date}
                  custom={estimate.custom}
                  min={periodStartDate(period) ?? undefined}
                />
              ) : null}
            </span>
          }
        />
        <StatTile
          label={t("daysWorked")}
          value={daysWorked}
          hint={daysWorked > 0 ? t("averagePerDay", { duration: formatDuration(summary.durationMs / daysWorked) }) : undefined}
        />
        <StatTile label={t("commits")} value={commitCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dailyHours")}</CardTitle>
            <CardDescription>{t("dailyHoursDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart data={series.hours} formatTick="hours" locale={locale} ariaLabel={t("dailyHours")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("cumulativeAmount")}</CardTitle>
            <CardDescription>{t("cumulativeAmountDescription", { currency: project.currency })}</CardDescription>
          </CardHeader>
          <CardContent>
            <CumulativeChart data={series.cumulativeAmount} formatTick="compact" locale={locale} ariaLabel={t("cumulativeAmount")} />
          </CardContent>
        </Card>
      </div>

      {weekStarts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("weekly")}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("week")}</TableHead>
                  <TableHead className="text-right">{t("hours")}</TableHead>
                  <TableHead className="pr-4 text-right sm:pr-2">{t("amount")}</TableHead>
                  <TableHead className="hidden pr-4 text-right sm:table-cell">{t("commits")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekStarts.map((weekStart) => (
                  <TableRow key={weekStart}>
                    <TableCell className="pl-4">{t("weekOf", { date: formatIsoDate(weekStart, locale) })}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDuration(weeks.get(weekStart)?.durationMs ?? 0)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums sm:pr-2">{money(weeks.get(weekStart)?.amount ?? 0)}</TableCell>
                    <TableCell className="hidden pr-4 text-right tabular-nums sm:table-cell">{commitsByWeek.get(weekStart)?.commits.length ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {intervals.length > 0 ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{t("recent")}</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${project.id}/intervals`}>
                {t("seeAll")}
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>
          <IntervalList
            projectId={project.id}
            currency={project.currency}
            defaultRate={project.hourlyRate}
            canEdit={role === "owner"}
            serverNow={now}
            intervals={intervals.slice(-6).map((row) => ({
              id: row.id,
              startedAt: row.startedAt,
              endedAt: row.endedAt,
              rate: row.rate,
              note: row.note,
              locked: false,
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}
