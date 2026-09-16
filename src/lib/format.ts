/**
 * Locale-aware display helpers usable on the server and in the browser.
 * Calendar dates (`YYYY-MM-DD`) are formatted in UTC so they never shift.
 */
import type { Period } from "./billing";
import { addIsoDays, MS_PER_HOUR, type IsoDate } from "./time";

export { formatMoney } from "./money";
export { formatClock, formatDuration } from "./time";

function isoToUtcDate(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDate(
  date: IsoDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(isoToUtcDate(date));
}

export function formatTime(instant: number, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(instant);
}

export function formatDateTime(instant: number, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(instant);
}

/** Decimal hours, e.g. `12.5 h`. */
export function formatHours(ms: number, locale: string): string {
  const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(
    ms / MS_PER_HOUR,
  );
  return `${hours} h`;
}

/** First day covered by a period, or `null` for an unbounded first period. */
export function periodStartDate(period: Period): IsoDate | null {
  return period.after === null ? null : addIsoDays(period.after, 1);
}

/** `16 Dec 2025 – 15 Jan 2026`. For an unbounded period, only the end date. */
export function formatPeriodRange(period: Period, locale: string): { start: string | null; end: string } {
  const start = periodStartDate(period);
  return {
    start: start ? formatIsoDate(start, locale) : null,
    end: formatIsoDate(period.through, locale),
  };
}
