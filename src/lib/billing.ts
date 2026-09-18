/**
 * Billing rules — pure functions shared by the server and the UI.
 *
 * The model mirrors the original spreadsheet:
 * - Each interval stores its own hourly rate.
 * - An interval belongs to the calendar day on which it STARTS (in the app
 *   timezone), even when it ends after midnight.
 * - An invoice dated D covers every interval whose start date is after the
 *   previous invoice's date and on or before D. The invoice date is inclusive.
 * - Intervals covered by an invoice are locked.
 */
import {
  addIsoDays,
  isoDaysBetween,
  MS_PER_HOUR,
  startOfIsoDate,
  toIsoDate,
  weekStartOf,
  type IsoDate,
} from "./time";

export interface BillableInterval {
  startedAt: number;
  /** `null` while running; `now` is used instead. */
  endedAt: number | null;
  /** Hourly rate in cents. */
  rate: number;
}

export interface ExtraItem {
  description: string;
  /** Amount in cents. */
  amount: number;
}

/** Range of start dates covered by an invoice: `(after, through]`. */
export interface Period {
  /** Date of the previous invoice (exclusive), or `null` for the first invoice. */
  after: IsoDate | null;
  /** Date of this invoice (inclusive), or today for the open period. */
  through: IsoDate;
}

export interface RateBreakdown {
  rate: number;
  durationMs: number;
  amount: number;
}

export interface DayBreakdown {
  date: IsoDate;
  durationMs: number;
  amount: number;
}

export interface WeekBreakdown {
  /** Monday of the week. */
  weekStart: IsoDate;
  durationMs: number;
  amount: number;
  intervalCount: number;
}

export interface PeriodSummary {
  durationMs: number;
  /** Sum of `byRate` amounts, in cents. */
  subtotal: number;
  extrasTotal: number;
  total: number;
  intervalCount: number;
  byRate: RateBreakdown[];
  weeks: WeekBreakdown[];
  days: DayBreakdown[];
}

export function periodFor(previousInvoiceDate: IsoDate | null, through: IsoDate): Period {
  return { after: previousInvoiceDate, through };
}

/** Whether a start date falls inside a period. */
export function isDateInPeriod(date: IsoDate, period: Period): boolean {
  return (period.after === null || date > period.after) && date <= period.through;
}

/**
 * Instant bounds of a period for database queries:
 * `startedAt >= start` (when not null) and `startedAt < end`.
 */
export function periodBounds(period: Period, timeZone: string): { start: number | null; end: number } {
  return {
    start: period.after === null ? null : startOfIsoDate(addIsoDays(period.after, 1), timeZone),
    end: startOfIsoDate(addIsoDays(period.through, 1), timeZone),
  };
}

/** Whether an interval starting at `startedAt` is covered by the latest invoice. */
export function isLocked(startedAt: number, latestInvoiceDate: IsoDate | null, timeZone: string): boolean {
  return latestInvoiceDate !== null && toIsoDate(startedAt, timeZone) <= latestInvoiceDate;
}

export function durationOf(interval: BillableInterval, now: number): number {
  return Math.max(0, (interval.endedAt ?? now) - interval.startedAt);
}

/** Unrounded value of a duration at an hourly rate, in cents. */
function exactAmount(durationMs: number, rate: number): number {
  return (durationMs * rate) / MS_PER_HOUR;
}

/** Aggregates intervals into totals and per-rate, per-week and per-day breakdowns. */
export function summarize(
  intervals: readonly BillableInterval[],
  options: { timeZone: string; now: number; extras?: readonly ExtraItem[] },
): PeriodSummary {
  const { timeZone, now, extras = [] } = options;
  const byRate = new Map<number, number>();
  const days = new Map<IsoDate, { durationMs: number; exact: number }>();
  const weeks = new Map<IsoDate, { durationMs: number; exact: number; intervalCount: number }>();
  let durationMs = 0;

  for (const interval of intervals) {
    const duration = durationOf(interval, now);
    const exact = exactAmount(duration, interval.rate);
    const date = toIsoDate(interval.startedAt, timeZone);
    const weekStart = weekStartOf(date);

    durationMs += duration;
    byRate.set(interval.rate, (byRate.get(interval.rate) ?? 0) + duration);

    const day = days.get(date) ?? { durationMs: 0, exact: 0 };
    day.durationMs += duration;
    day.exact += exact;
    days.set(date, day);

    const week = weeks.get(weekStart) ?? { durationMs: 0, exact: 0, intervalCount: 0 };
    week.durationMs += duration;
    week.exact += exact;
    week.intervalCount += 1;
    weeks.set(weekStart, week);
  }

  const rates = [...byRate.entries()]
    .map(([rate, duration]) => ({
      rate,
      durationMs: duration,
      amount: Math.round(exactAmount(duration, rate)),
    }))
    .sort((a, b) => b.rate - a.rate);

  const subtotal = rates.reduce((sum, row) => sum + row.amount, 0);
  const extrasTotal = extras.reduce((sum, item) => sum + item.amount, 0);

  return {
    durationMs,
    subtotal,
    extrasTotal,
    total: subtotal + extrasTotal,
    intervalCount: intervals.length,
    byRate: rates,
    weeks: [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, week]) => ({
        weekStart,
        durationMs: week.durationMs,
        amount: Math.round(week.exact),
        intervalCount: week.intervalCount,
      })),
    days: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => ({ date, durationMs: day.durationMs, amount: Math.round(day.exact) })),
  };
}

/** Default length of a billing period, used to estimate when the next invoice is due. */
export const ESTIMATE_PERIOD_DAYS = 30;

export interface InvoiceEstimate {
  /** Estimated invoice date (inclusive end of the open period). */
  date: IsoDate;
  /** Whether the owner picked the date instead of the default. */
  custom: boolean;
  /** Projected subtotal at that date, in cents. */
  amount: number;
}

/**
 * Projects the open period's subtotal to its estimated end, assuming work
 * continues at the average amount per calendar day so far.
 *
 * The period starts the day after the latest invoice (or on the first worked
 * day when there is none) and, by default, ends 30 days after that invoice.
 * A date picked by the owner is used only while it is after the latest invoice.
 */
export function estimateInvoice(input: {
  latestInvoiceDate: IsoDate | null;
  /** First worked day of the open period, if any. */
  firstWorkedDate: IsoDate | null;
  today: IsoDate;
  chosenDate: IsoDate | null;
  /** Subtotal of the open period so far, in cents. */
  subtotal: number;
}): InvoiceEstimate {
  const { latestInvoiceDate, today, chosenDate, subtotal } = input;
  const start = latestInvoiceDate
    ? addIsoDays(latestInvoiceDate, 1)
    : [input.firstWorkedDate ?? today, today].sort()[0];
  const custom = chosenDate !== null && (latestInvoiceDate === null || chosenDate > latestInvoiceDate);
  const date = custom ? chosenDate : addIsoDays(start, ESTIMATE_PERIOD_DAYS - 1);

  if (date <= today) return { date, custom, amount: subtotal };
  const elapsedDays = isoDaysBetween(start, today) + 1;
  const totalDays = isoDaysBetween(start, date) + 1;
  return { date, custom, amount: Math.round((subtotal * totalDays) / elapsedDays) };
}

export type InvoiceDateError =
  | "invoiceDateNotAfterPrevious"
  | "invoiceDateInFuture"
  | "invoiceRunningTimer";

/** Validates the date of a new invoice. Returns an error key, or `null` when valid. */
export function validateInvoiceDate(input: {
  date: IsoDate;
  latestInvoiceDate: IsoDate | null;
  today: IsoDate;
  /** Start of the running timer of this project, if any. */
  runningStartedAt: number | null;
  timeZone: string;
}): InvoiceDateError | null {
  if (input.latestInvoiceDate !== null && input.date <= input.latestInvoiceDate) {
    return "invoiceDateNotAfterPrevious";
  }
  if (input.date > input.today) return "invoiceDateInFuture";
  if (
    input.runningStartedAt !== null &&
    toIsoDate(input.runningStartedAt, input.timeZone) <= input.date
  ) {
    return "invoiceRunningTimer";
  }
  return null;
}

/** Whether two half-open ranges `[start, end)` overlap. */
export function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}
