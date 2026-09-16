import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { intervals, invoices, type Interval } from "@/db/schema";
import { env } from "@/env";
import { periodBounds, periodFor, type Period } from "@/lib/billing";
import { toIsoDate, type IsoDate } from "@/lib/time";

export const timeZone = () => env().TIMEZONE;

/** The instant the current request is rendered at, shared by all components of the request. */
export const requestNow = cache((): number => Date.now());

export function todayIso(now = Date.now()): IsoDate {
  return toIsoDate(now, timeZone());
}

/** Date of the most recent invoice of a project; everything up to it is locked. */
export function getLatestInvoiceDate(projectId: string): IsoDate | null {
  const row = getDb()
    .select({ date: invoices.date })
    .from(invoices)
    .where(eq(invoices.projectId, projectId))
    .orderBy(desc(invoices.date))
    .get();
  return row?.date ?? null;
}

/** Date of the invoice immediately before `date`, or `null`. */
export function getPreviousInvoiceDate(projectId: string, date: IsoDate): IsoDate | null {
  const row = getDb()
    .select({ date: invoices.date })
    .from(invoices)
    .where(and(eq(invoices.projectId, projectId), lt(invoices.date, date)))
    .orderBy(desc(invoices.date))
    .get();
  return row?.date ?? null;
}

/** The period not yet invoiced: from the latest invoice until today. */
export function getOpenPeriod(projectId: string, now = Date.now()): Period {
  return periodFor(getLatestInvoiceDate(projectId), todayIso(now));
}

/** Intervals whose start date falls in the period, oldest first. */
export function getIntervalsInPeriod(projectId: string, period: Period): Interval[] {
  const { start, end } = periodBounds(period, timeZone());
  return getDb()
    .select()
    .from(intervals)
    .where(
      and(
        eq(intervals.projectId, projectId),
        start === null ? undefined : gte(intervals.startedAt, start),
        lt(intervals.startedAt, end),
      ),
    )
    .orderBy(asc(intervals.startedAt))
    .all();
}

/** The single running interval of the whole app, if any. */
export function getRunningInterval(): Interval | undefined {
  return getDb().select().from(intervals).where(isNull(intervals.endedAt)).get();
}
