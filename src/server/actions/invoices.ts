"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { invoiceItems, invoices, invoiceSummaries, projects } from "@/db/schema";
import { requireProjectOwner } from "@/lib/authz";
import { periodFor, summarize, validateInvoiceDate, type Period, type PeriodSummary } from "@/lib/billing";
import { parseMoney } from "@/lib/money";
import { isIsoDate, type IsoDate } from "@/lib/time";
import { runAction, UserError } from "../action";
import { getIntervalsInPeriod, getLatestInvoiceDate, getRunningInterval, timeZone, todayIso } from "../queries/periods";

const isoDate = z.string().refine(isIsoDate);

const itemsInput = z
  .array(
    z.object({
      description: z.string().trim().min(1).max(200),
      amount: z.string().min(1),
    }),
  )
  .max(20)
  .default([]);

function parseItems(raw: z.input<typeof itemsInput>) {
  return itemsInput.parse(raw).map((item) => {
    const amount = parseMoney(item.amount);
    if (amount === null) throw new UserError("invalidInput");
    return { description: item.description, amount };
  });
}

/**
 * Validates an invoice date for a project and computes its breakdown.
 * Shared by the live preview and invoice creation.
 */
function computeInvoice(
  projectId: string,
  date: IsoDate,
  extras: { description: string; amount: number }[],
): { period: Period; summary: PeriodSummary } {
  const latestInvoiceDate = getLatestInvoiceDate(projectId);
  const running = getRunningInterval();
  const error = validateInvoiceDate({
    date,
    latestInvoiceDate,
    today: todayIso(),
    runningStartedAt: running?.projectId === projectId ? running.startedAt : null,
    timeZone: timeZone(),
  });
  if (error) throw new UserError(error);

  const period = periodFor(latestInvoiceDate, date);
  const summary = summarize(getIntervalsInPeriod(projectId, period), {
    timeZone: timeZone(),
    now: Date.now(),
    extras,
  });
  return { period, summary };
}

export async function previewInvoice(
  projectId: string,
  rawDate: string,
  rawItems: z.input<typeof itemsInput>,
) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    return computeInvoice(project.id, isoDate.parse(rawDate), parseItems(rawItems));
  });
}

const createInput = z.object({
  projectId: z.string().min(1),
  date: isoDate,
  name: z.string().trim().min(1).max(120),
  items: itemsInput,
});

/** Creates an invoice and returns its id. */
export async function createInvoice(raw: z.input<typeof createInput>) {
  return runAction(async () => {
    const input = createInput.parse(raw);
    const { project } = await requireProjectOwner(input.projectId);
    const items = parseItems(input.items);

    const id = getDb().transaction((tx) => {
      // Recomputed inside the transaction so the snapshot matches what is locked.
      const { summary } = computeInvoice(project.id, input.date, items);
      if (summary.intervalCount === 0 && items.length === 0) throw new UserError("invoiceEmpty");

      const [invoice] = tx
        .insert(invoices)
        .values({
          projectId: project.id,
          date: input.date,
          name: input.name,
          durationMs: summary.durationMs,
          subtotal: summary.subtotal,
          extrasTotal: summary.extrasTotal,
          total: summary.total,
        })
        .returning({ id: invoices.id })
        .all();

      if (items.length > 0) {
        tx.insert(invoiceItems)
          .values(items.map((item, position) => ({ ...item, invoiceId: invoice.id, position })))
          .run();
      }
      // The estimate was for the period just invoiced.
      tx.update(projects).set({ estimatedInvoiceDate: null }).where(eq(projects.id, project.id)).run();
      return invoice.id;
    });
    revalidatePath("/", "layout");
    return id;
  });
}

/** Deletes an invoice. Only the latest one can be deleted, unlocking its period. */
export async function deleteInvoice(projectId: string, invoiceId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const invoice = findInvoice(getDb(), project.id, z.string().parse(invoiceId));
    const latest = getDb()
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.projectId, project.id))
      .orderBy(desc(invoices.date))
      .get();
    if (latest?.id !== invoice.id) throw new UserError("invoiceNotLatest");
    getDb().transaction((tx) => {
      tx.delete(invoices).where(eq(invoices.id, invoice.id)).run();
      tx.update(projects).set({ estimatedInvoiceDate: null }).where(eq(projects.id, project.id)).run();
    });
    revalidatePath("/", "layout");
  });
}

const summaryInput = z.object({
  scope: z.union([z.literal("overall"), isoDate]),
  headline: z.string().trim().max(200).default(""),
  content: z.string().trim().max(20_000),
});

/** Lets the owner edit (or write from scratch) an overall or weekly summary. */
export async function saveInvoiceSummary(
  projectId: string,
  invoiceId: string,
  raw: z.input<typeof summaryInput>,
) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const invoice = findInvoice(getDb(), project.id, z.string().parse(invoiceId));
    const input = summaryInput.parse(raw);

    if (input.content === "") {
      getDb()
        .delete(invoiceSummaries)
        .where(and(eq(invoiceSummaries.invoiceId, invoice.id), eq(invoiceSummaries.scope, input.scope)))
        .run();
    } else {
      getDb()
        .insert(invoiceSummaries)
        .values({ invoiceId: invoice.id, ...input })
        .onConflictDoUpdate({
          target: [invoiceSummaries.invoiceId, invoiceSummaries.scope],
          set: { headline: input.headline, content: input.content, generatedAt: new Date() },
        })
        .run();
    }
    revalidatePath("/", "layout");
  });
}

function findInvoice(db: Db, projectId: string, invoiceId: string) {
  const invoice = db
    .select({ id: invoices.id, date: invoices.date })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, projectId)))
    .get();
  if (!invoice) throw new UserError("invalidInput");
  return invoice;
}
