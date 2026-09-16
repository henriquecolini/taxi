import { ClockIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AddIntervalButton } from "@/components/intervals/interval-dialog";
import { IntervalList } from "@/components/intervals/interval-list";
import { EmptyState } from "@/components/layout/page-header";
import { PeriodSelect } from "@/components/projects/period-select";
import { requireProjectAccess } from "@/lib/authz";
import { isLocked, summarize } from "@/lib/billing";
import { formatDuration, formatMoney, formatPeriodRange } from "@/lib/format";
import { getIntervalsInPeriod, getLatestInvoiceDate, requestNow, timeZone } from "@/server/queries/periods";
import { resolvePeriodSelection } from "@/server/queries/selection";

export default async function IntervalsPage({ params, searchParams }: PageProps<"/projects/[projectId]/intervals">) {
  const { project, role } = await requireProjectAccess((await params).projectId);
  const { invoice } = await searchParams;
  const t = await getTranslations("intervals");
  const locale = await getLocale();
  const now = requestNow();

  const selection = resolvePeriodSelection(project.id, invoice, locale);
  const rows = getIntervalsInPeriod(project.id, selection.period);
  const latestInvoiceDate = getLatestInvoiceDate(project.id);
  const summary = summarize(rows, { timeZone: timeZone(), now });
  const range = formatPeriodRange(selection.period, locale);
  const canEdit = role === "owner";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PeriodSelect options={selection.options} selected={selection.invoiceId} />
        {canEdit && !project.archivedAt ? <AddIntervalButton projectId={project.id} defaultRate={project.hourlyRate} /> : null}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {range.start ? t("range", { start: range.start, end: range.end }) : t("rangeUntil", { end: range.end })}
        </span>
        <span className="flex gap-4 font-medium tabular-nums">
          <span>{formatDuration(summary.durationMs)}</span>
          <span>{formatMoney(summary.subtotal, project.currency, locale)}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ClockIcon />} title={t("empty")} description={canEdit ? t("emptyHint") : undefined} />
      ) : (
        <IntervalList
          projectId={project.id}
          currency={project.currency}
          defaultRate={project.hourlyRate}
          canEdit={canEdit}
          serverNow={now}
          intervals={rows.map((row) => ({
            id: row.id,
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            rate: row.rate,
            note: row.note,
            locked: isLocked(row.startedAt, latestInvoiceDate, timeZone()),
          }))}
        />
      )}
    </div>
  );
}
