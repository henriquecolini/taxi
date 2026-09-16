/**
 * Parsing for importing the old spreadsheet (CSV exports).
 * Pure functions: parsing runs in the browser for a live preview, and the
 * server re-validates everything it receives.
 */
import Papa from "papaparse";
import { parseMoney } from "./money";
import { isIsoDate, zonedInstant, type IsoDate } from "./time";

export const DATE_FORMATS = ["dmy", "mdy", "iso"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export type ImportIssueKey = "invalidDate" | "missingEnd" | "endBeforeStart" | "invalidRate" | "overlap" | "missingName" | "duplicateDate";

export interface ImportIssue {
  /** 1-based line number in the CSV, counting the header. */
  line: number;
  key: ImportIssueKey;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): CsvTable {
  const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
  const [headers = [], ...rows] = result.data;
  return { headers: headers.map((header) => header.trim()), rows };
}

interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DATE_TIME_RE = {
  iso: /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/,
  slashed: /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
};

function parseParts(value: string, format: DateFormat): DateTimeParts | null {
  const text = value.trim();
  let match: RegExpExecArray | null;
  let year: number, month: number, day: number;
  let rest: (string | undefined)[];

  if (format === "iso") {
    match = DATE_TIME_RE.iso.exec(text);
    if (!match) return null;
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    rest = match.slice(4);
  } else {
    match = DATE_TIME_RE.slashed.exec(text);
    if (!match) return null;
    const [first, second] = [Number(match[1]), Number(match[2])];
    [day, month] = format === "dmy" ? [first, second] : [second, first];
    year = Number(match[3]);
    rest = match.slice(4);
  }

  const [hour = 0, minute = 0, second = 0] = rest.map((part) => (part === undefined ? undefined : Number(part)));
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isIsoDate(iso) || hour > 23 || minute > 59 || second > 59) return null;
  return { year, month, day, hour, minute, second };
}

export function parseDateTime(value: string, format: DateFormat, timeZone: string): number | null {
  const parts = parseParts(value, format);
  return parts ? zonedInstant(parts, timeZone) : null;
}

export function parseDate(value: string, format: DateFormat): IsoDate | null {
  const parts = parseParts(value, format);
  return parts
    ? `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
    : null;
}

/** Guesses the date format from sample values. Defaults to day/month/year. */
export function detectDateFormat(samples: string[]): DateFormat {
  const values = samples.map((sample) => sample.trim()).filter(Boolean);
  if (values.length > 0 && values.every((value) => DATE_TIME_RE.iso.test(value))) return "iso";
  for (const value of values) {
    const match = DATE_TIME_RE.slashed.exec(value);
    if (!match) continue;
    if (Number(match[1]) > 12) return "dmy";
    if (Number(match[2]) > 12) return "mdy";
  }
  return "dmy";
}

/** Index of the first header matching a pattern, or -1. */
export function guessColumn(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(header));
}

export const COLUMN_PATTERNS = {
  start: /start|in[ií]cio|come[cç]o|begin|entrada/i,
  end: /end|fim|t[eé]rmino|stop|sa[ií]da|final/i,
  rate: /rate|taxa|valor|pre[cç]o|price/i,
  date: /date|data|dia/i,
  name: /name|nome|descri|title|t[ií]tulo/i,
};

export interface TimeRow {
  startedAt: number;
  endedAt: number;
  /** Cents. */
  rate: number;
}

export function parseTimeRows(
  table: CsvTable,
  columns: { start: number; end: number; rate: number | null },
  options: { format: DateFormat; timeZone: string; defaultRate: number },
): { rows: (TimeRow & { line: number })[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const parsed: (TimeRow & { line: number })[] = [];

  table.rows.forEach((cells, index) => {
    const line = index + 2;
    const cell = (column: number) => (cells[column] ?? "").trim();
    if (cells.every((value) => !value.trim())) return;

    const startedAt = parseDateTime(cell(columns.start), options.format, options.timeZone);
    if (startedAt === null) return issues.push({ line, key: "invalidDate" });
    if (!cell(columns.end)) return issues.push({ line, key: "missingEnd" });
    const endedAt = parseDateTime(cell(columns.end), options.format, options.timeZone);
    if (endedAt === null) return issues.push({ line, key: "invalidDate" });
    if (endedAt <= startedAt) return issues.push({ line, key: "endBeforeStart" });

    const rate = columns.rate === null ? options.defaultRate : parseMoney(cell(columns.rate));
    if (rate === null || rate < 0) return issues.push({ line, key: "invalidRate" });

    parsed.push({ line, startedAt, endedAt, rate });
  });

  // Intervals must not overlap each other (a single timer runs at a time).
  parsed.sort((a, b) => a.startedAt - b.startedAt);
  const rows: typeof parsed = [];
  for (const row of parsed) {
    const previous = rows.at(-1);
    if (previous && row.startedAt < previous.endedAt) issues.push({ line: row.line, key: "overlap" });
    else rows.push(row);
  }

  issues.sort((a, b) => a.line - b.line);
  return { rows, issues };
}

export interface InvoiceRow {
  date: IsoDate;
  name: string;
}

export function parseInvoiceRows(
  table: CsvTable,
  columns: { date: number; name: number | null },
  options: { format: DateFormat },
): { rows: (InvoiceRow & { line: number })[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const rows: (InvoiceRow & { line: number })[] = [];
  const seen = new Set<string>();

  table.rows.forEach((cells, index) => {
    const line = index + 2;
    if (cells.every((value) => !value.trim())) return;
    const date = parseDate((cells[columns.date] ?? "").trim(), options.format);
    if (!date) return issues.push({ line, key: "invalidDate" });
    if (seen.has(date)) return issues.push({ line, key: "duplicateDate" });
    const name = columns.name === null ? date : (cells[columns.name] ?? "").trim();
    if (!name) return issues.push({ line, key: "missingName" });
    seen.add(date);
    rows.push({ line, date, name: name.slice(0, 120) });
  });

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { rows, issues };
}
