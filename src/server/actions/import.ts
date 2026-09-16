"use server";

import { and, gt, isNull, lt, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { intervals, invoices } from "@/db/schema";
import { requireProjectOwner } from "@/lib/authz";
import { isLocked, periodFor, summarize } from "@/lib/billing";
import { isIsoDate } from "@/lib/time";
import { runAction, UserError } from "../action";
import { getIntervalsInPeriod, getLatestInvoiceDate, getRunningInterval, timeZone, todayIso } from "../queries/periods";

const MAX_ROWS = 50_000;

const importInput = z.object({
  intervals: z
    .array(
      z.object({
        startedAt: z.number().int().positive(),
        endedAt: z.number().int().positive(),
        rate: z.number().int().min(0),
      }),
    )
    .max(MAX_ROWS),
  invoices: z
    .array(z.object({ date: z.string().refine(isIsoDate), name: z.string().trim().min(1).max(120) }))
    .max(MAX_ROWS),
});

export type ImportInput = z.input<typeof importInput>;

/**
 * Imports historical intervals and invoices in a single transaction.
 * Everything is validated again here: nothing from the browser is trusted.
 */
export async function importData(projectId: string, raw: ImportInput) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const input = importInput.parse(raw);
    const tz = timeZone();
    const now = Date.now();
    const db = getDb();

    const rows = [...input.intervals].sort((a, b) => a.startedAt - b.startedAt);
    const invoiceRows = [...input.invoices].sort((a, b) => a.date.localeCompare(b.date));

    const result = db.transaction((tx) => {
      const latest = getLatestInvoiceDate(project.id);

      rows.forEach((row, index) => {
        if (row.endedAt <= row.startedAt || row.endedAt > now) throw new UserError("importInvalid");
        if (isLocked(row.startedAt, latest, tz)) throw new UserError("locked");
        if (index > 0 && row.startedAt < rows[index - 1].endedAt) throw new UserError("overlap");
        const clash = tx
          .select({ id: intervals.id })
          .from(intervals)
          .where(
            and(
              lt(intervals.startedAt, row.endedAt),
              or(isNull(intervals.endedAt), gt(intervals.endedAt, row.startedAt)),
            ),
          )
          .get();
        if (clash) throw new UserError("overlap");
      });

      for (let i = 0; i < rows.length; i += 500) {
        tx.insert(intervals)
          .values(rows.slice(i, i + 500).map((row) => ({ projectId: project.id, ...row })))
          .run();
      }

      const running = getRunningInterval();
      let previous = latest;
      for (const invoice of invoiceRows) {
        if ((previous !== null && invoice.date <= previous) || invoice.date > todayIso(now)) {
          throw new UserError("importInvalid");
        }
        if (running?.projectId === project.id && isLocked(running.startedAt, invoice.date, tz)) {
          throw new UserError("invoiceRunningTimer");
        }
        const period = periodFor(previous, invoice.date);
        const summary = summarize(getIntervalsInPeriod(project.id, period), { timeZone: tz, now });
        tx.insert(invoices)
          .values({
            projectId: project.id,
            date: invoice.date,
            name: invoice.name,
            durationMs: summary.durationMs,
            subtotal: summary.subtotal,
            extrasTotal: 0,
            total: summary.subtotal,
          })
          .run();
        previous = invoice.date;
      }

      return { intervals: rows.length, invoices: invoiceRows.length };
    });

    revalidatePath("/", "layout");
    return result;
  });
}
