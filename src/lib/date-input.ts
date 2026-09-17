/**
 * Locale-aware text formats for date and time inputs.
 *
 * Native `<input type="date">` fields are formatted by the browser's own
 * locale, not the app's, so the app renders text inputs and uses these
 * helpers instead. The day/month/year order and separator come from `Intl`,
 * e.g. `16/09/2026` for pt-BR and `09/16/2026` for en.
 */
import { isIsoDate, type IsoDate } from "./time";

type DatePart = "day" | "month" | "year";

interface DatePattern {
  order: DatePart[];
  separator: string;
}

const patternCache = new Map<string, DatePattern>();

export function datePattern(locale: string): DatePattern {
  const cached = patternCache.get(locale);
  if (cached) return cached;
  const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(
    new Date(Date.UTC(2026, 10, 22)),
  );
  const pattern: DatePattern = {
    order: parts.filter((part) => part.type === "day" || part.type === "month" || part.type === "year").map((part) => part.type as DatePart),
    separator: parts.find((part) => part.type === "literal")?.value.trim() || "/",
  };
  patternCache.set(locale, pattern);
  return pattern;
}

const PART_LENGTH: Record<DatePart, number> = { day: 2, month: 2, year: 4 };

/** `2026-09-16` → `16/09/2026` (pt-BR) or `09/16/2026` (en). */
export function formatDateInput(date: IsoDate | "", locale: string): string {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  const values: Record<DatePart, string> = { day, month, year };
  const { order, separator } = datePattern(locale);
  return order.map((part) => values[part]).join(separator);
}

/** Parses a typed date in the locale's order. Returns `null` when incomplete or invalid. */
export function parseDateInput(text: string, locale: string): IsoDate | null {
  const { order } = datePattern(locale);
  const pieces = text.trim().split(/\D+/).filter(Boolean);
  if (pieces.length !== 3) return null;
  const values = Object.fromEntries(order.map((part, index) => [part, pieces[index]])) as Record<DatePart, string>;
  if (values.year.length !== 4 || values.day.length > 2 || values.month.length > 2) return null;
  const iso = `${values.year}-${values.month.padStart(2, "0")}-${values.day.padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/** Formats digits as they are typed, inserting separators: `1609` → `16/09`. */
export function maskDateInput(text: string, locale: string): string {
  const { order, separator } = datePattern(locale);
  const digits = text.replace(/\D/g, "").slice(0, 8);
  const pieces: string[] = [];
  let position = 0;
  for (const part of order) {
    if (position >= digits.length) break;
    pieces.push(digits.slice(position, position + PART_LENGTH[part]));
    position += PART_LENGTH[part];
  }
  // Keep a trailing separator the user just typed, so `16/` doesn't snap back to `16`.
  const complete = pieces.length > 0 && pieces.length < order.length && pieces.at(-1)!.length === PART_LENGTH[order[pieces.length - 1]];
  const typedSeparator = /\D$/.test(text);
  return pieces.join(separator) + (complete && typedSeparator ? separator : "");
}

/** Localized placeholder, given translated part names, e.g. `dd/mm/aaaa`. */
export function datePlaceholder(locale: string, names: Record<DatePart, string>): string {
  const { order, separator } = datePattern(locale);
  return order.map((part) => names[part]).join(separator);
}

/** Whether the locale writes times with AM/PM (12-hour clock). */
export function uses12HourClock(locale: string): boolean {
  const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions();
  return hourCycle === "h11" || hourCycle === "h12";
}

/** `14:05` → `2:05 PM` (12-hour locales) or `14:05`. */
export function formatTimeInput(time: string, locale: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return "";
  if (!uses12HourClock(locale)) return time;
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * Parses a typed time into 24-hour `HH:mm`. Accepts `14:05`, `1405`, `2:05 pm`,
 * `2pm`, in any locale. Returns `null` when invalid.
 */
export function parseTimeInput(text: string): string | null {
  const match = /^\s*(\d{1,2})(?:[:h.]?(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(text);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "p" ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
