import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoiceItems, invoices, invoiceSummaries } from "@/db/schema";
import { periodFor, summarize, type Period, type PeriodSummary } from "@/lib/billing";
import { getIntervalsInPeriod, getLatestInvoiceDate, getPreviousInvoiceDate, timeZone } from "./periods";

export interface InvoiceListItemDto {
  id: string;
  name: string;
  period: Period;
  durationMs: number;
  subtotal: number;
  extrasTotal: number;
  total: number;
}

/** Invoices of a project, newest first. */
export function listInvoices(projectId: string): InvoiceListItemDto[] {
  const rows = getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.projectId, projectId))
    .orderBy(asc(invoices.date))
    .all();

  return rows
    .map((row, index) => ({
      id: row.id,
      name: row.name,
      period: periodFor(rows[index - 1]?.date ?? null, row.date),
      durationMs: row.durationMs,
      subtotal: row.subtotal,
      extrasTotal: row.extrasTotal,
      total: row.total,
    }))
    .reverse();
}

export interface InvoiceItemDto {
  description: string;
  amount: number;
}

export interface InvoiceSummaryDto {
  scope: string;
  headline: string;
  content: string;
  generatedAt: number;
}

export interface InvoiceDetailDto {
  id: string;
  name: string;
  createdAt: number;
  period: Period;
  isLatest: boolean;
  items: InvoiceItemDto[];
  summaries: InvoiceSummaryDto[];
  /** Recomputed from the (locked) intervals, for the weekly breakdown. */
  summary: PeriodSummary;
  /** Snapshot stored when the invoice was created. */
  snapshot: { durationMs: number; subtotal: number; extrasTotal: number; total: number };
}

export function getInvoiceItems(invoiceId: string): InvoiceItemDto[] {
  return getDb()
    .select({ description: invoiceItems.description, amount: invoiceItems.amount })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.position))
    .all();
}

/** Extras of the latest invoice, used to pre-fill a new invoice. */
export function getLatestInvoiceItems(projectId: string): InvoiceItemDto[] {
  const latest = getDb()
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.projectId, projectId))
    .orderBy(desc(invoices.date))
    .get();
  return latest ? getInvoiceItems(latest.id) : [];
}

export function getInvoiceDetail(projectId: string, invoiceId: string): InvoiceDetailDto | null {
  const db = getDb();
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, projectId)))
    .get();
  if (!invoice) return null;

  const period = periodFor(getPreviousInvoiceDate(projectId, invoice.date), invoice.date);
  const items = getInvoiceItems(invoice.id);
  const summaries = db
    .select({
      scope: invoiceSummaries.scope,
      headline: invoiceSummaries.headline,
      content: invoiceSummaries.content,
      generatedAt: invoiceSummaries.generatedAt,
    })
    .from(invoiceSummaries)
    .where(eq(invoiceSummaries.invoiceId, invoice.id))
    .all()
    .map((row) => ({ ...row, generatedAt: row.generatedAt.getTime() }));

  return {
    id: invoice.id,
    name: invoice.name,
    createdAt: invoice.createdAt.getTime(),
    period,
    isLatest: getLatestInvoiceDate(projectId) === invoice.date,
    items,
    summaries,
    summary: summarize(getIntervalsInPeriod(projectId, period), {
      timeZone: timeZone(),
      now: Date.now(),
      extras: items,
    }),
    snapshot: {
      durationMs: invoice.durationMs,
      subtotal: invoice.subtotal,
      extrasTotal: invoice.extrasTotal,
      total: invoice.total,
    },
  };
}
