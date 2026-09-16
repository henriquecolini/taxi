import "server-only";
import type { Period } from "@/lib/billing";
import { formatIsoDate } from "@/lib/format";
import type { PeriodOption } from "@/components/projects/period-select";
import { listInvoices } from "./invoices";
import { getOpenPeriod } from "./periods";

export interface PeriodSelection {
  period: Period;
  /** Selected invoice id, or `null` for the open period. */
  invoiceId: string | null;
  options: PeriodOption[];
}

/** Resolves the `?invoice=` search param of a project page into a period. */
export function resolvePeriodSelection(
  projectId: string,
  invoiceParam: string | string[] | undefined,
  locale: string,
): PeriodSelection {
  const invoices = listInvoices(projectId);
  const options = invoices.map((invoice) => ({
    id: invoice.id,
    label: `${invoice.name} · ${formatIsoDate(invoice.period.through, locale)}`,
  }));
  const selected = typeof invoiceParam === "string" ? invoices.find((invoice) => invoice.id === invoiceParam) : undefined;
  return selected
    ? { period: selected.period, invoiceId: selected.id, options }
    : { period: getOpenPeriod(projectId), invoiceId: null, options };
}
