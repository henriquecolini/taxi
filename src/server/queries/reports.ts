import "server-only";
import type { ChartPoint } from "@/components/charts/charts";
import type { Period, PeriodSummary } from "@/lib/billing";
import { formatDuration, formatIsoDate, formatMoney, periodStartDate } from "@/lib/format";
import { addIsoDays, isoDateRange, msToHours, type IsoDate } from "@/lib/time";

/** Longest range shown in daily charts, to keep them readable. */
const MAX_CHART_DAYS = 92;

export interface DailySeries {
  hours: ChartPoint[];
  cumulativeAmount: ChartPoint[];
}

/** Builds day-by-day chart series for a period, including days without work. */
export function buildDailySeries(
  period: Period,
  summary: PeriodSummary,
  currency: string,
  locale: string,
): DailySeries {
  const earliest = addIsoDays(period.through, -(MAX_CHART_DAYS - 1));
  let from: IsoDate = periodStartDate(period) ?? summary.days[0]?.date ?? period.through;
  if (from < earliest) from = earliest;

  const byDate = new Map(summary.days.map((day) => [day.date, day]));
  // Amounts before the visible window still count towards the running total.
  let cumulative = summary.days.filter((day) => day.date < from).reduce((sum, day) => sum + day.amount, 0);

  const hours: ChartPoint[] = [];
  const cumulativeAmount: ChartPoint[] = [];
  for (const date of isoDateRange(from, period.through)) {
    const day = byDate.get(date);
    const label = formatIsoDate(date, locale, { day: "numeric", month: "short" });
    const title = formatIsoDate(date, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    cumulative += day?.amount ?? 0;
    hours.push({
      label,
      title,
      value: msToHours(day?.durationMs ?? 0),
      display: formatDuration(day?.durationMs ?? 0),
    });
    cumulativeAmount.push({ label, title, value: cumulative / 100, display: formatMoney(cumulative, currency, locale) });
  }
  return { hours, cumulativeAmount };
}
