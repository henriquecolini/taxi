/**
 * Timezone-aware calendar helpers.
 *
 * Instants are epoch milliseconds. Calendar days are `YYYY-MM-DD` strings
 * ("ISO dates") in a given IANA timezone. ISO dates sort lexicographically,
 * so plain string comparison works for ranges.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfWeek } from "date-fns";

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;

export type IsoDate = string;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Calendar date on which the instant falls in `timeZone`. */
export function toIsoDate(instant: number, timeZone: string): IsoDate {
  return format(new TZDate(instant, timeZone), "yyyy-MM-dd");
}

/** First instant (00:00:00.000) of a calendar date in `timeZone`. */
export function startOfIsoDate(date: IsoDate, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new TZDate(y, m - 1, d, timeZone).getTime();
}

/** Adds whole calendar days to an ISO date (timezone independent). */
export function addIsoDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), days), "yyyy-MM-dd");
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function isoDaysBetween(from: IsoDate, to: IsoDate): number {
  const utc = (date: IsoDate) => {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: IsoDate): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  return format(startOfWeek(new Date(y, m - 1, d), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Every ISO date from `from` to `to`, both inclusive. */
export function isoDateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = from; date <= to; date = addIsoDays(date, 1)) dates.push(date);
  return dates;
}

/**
 * Converts wall-clock components in `timeZone` to an instant.
 * Months are 1-based.
 */
export function zonedInstant(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): number {
  return new TZDate(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    timeZone,
  ).getTime();
}

/** Value for an `<input type="datetime-local">` showing `instant` in `timeZone`. */
export function toDateTimeLocal(instant: number, timeZone: string): string {
  return format(new TZDate(instant, timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** Parses an `<input type="datetime-local">` value as wall-clock time in `timeZone`. */
export function fromDateTimeLocal(value: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (!isIsoDate(value.slice(0, 10))) return null;
  return zonedInstant({ year, month, day, hour, minute, second: second || 0 }, timeZone);
}

/** Parses a duration like `1:30`, `1h30`, `1.5` or `90m` into milliseconds. */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase().replace(",", ".");
  let match = /^(\d+):([0-5]?\d)$/.exec(value);
  if (match) return (Number(match[1]) * 60 + Number(match[2])) * MS_PER_MINUTE;
  match = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/.exec(value);
  if (match && (match[1] || match[2])) {
    return (Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * MS_PER_MINUTE;
  }
  match = /^(\d+(?:\.\d+)?)$/.exec(value);
  if (match) return Math.round(Number(match[1]) * MS_PER_HOUR);
  return null;
}

/** `h:mm:ss` clock display, e.g. `12:05:09`. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Compact duration display, e.g. `12h 05m`. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function msToHours(ms: number): number {
  return ms / MS_PER_HOUR;
}
