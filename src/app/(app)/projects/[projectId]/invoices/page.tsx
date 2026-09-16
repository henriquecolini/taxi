import { ChevronRightIcon, FilePlus2Icon, ReceiptTextIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireProjectAccess } from "@/lib/authz";
import { summarize } from "@/lib/billing";
import { formatDuration, formatMoney, formatPeriodRange } from "@/lib/format";
import { listInvoices } from "@/server/queries/invoices";
import { getIntervalsInPeriod, getOpenPeriod, requestNow, timeZone } from "@/server/queries/periods";

export default async function InvoicesPage({ params }: PageProps<"/projects/[projectId]/invoices">) {
  const { project, role } = await requireProjectAccess((await params).projectId);
  const t = await getTranslations("invoices");
  const locale = await getLocale();
  const money = (cents: number) => formatMoney(cents, project.currency, locale);

  const invoices = listInvoices(project.id);
  const openPeriod = getOpenPeriod(project.id);
  const open = summarize(getIntervalsInPeriod(project.id, openPeriod), { timeZone: timeZone(), now: requestNow() });
  const openRange = formatPeriodRange(openPeriod, locale);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {t("notInvoiced")} · {openRange.start ? t("since", { date: openRange.start }) : t("allTime")}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-2xl font-semibold tabular-nums">
            <span>{formatDuration(open.durationMs)}</span>
            <span className="text-muted-foreground">{money(open.subtotal)}</span>
          </p>
        </div>
        {role === "owner" ? (
          <Button size="lg" asChild>
            <Link href={`/projects/${project.id}/invoices/new`}>
              <FilePlus2Icon />
              {t("create")}
            </Link>
          </Button>
        ) : null}
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={<ReceiptTextIcon />} title={t("empty")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {invoices.map((invoice) => {
            const range = formatPeriodRange(invoice.period, locale);
            return (
              <li key={invoice.id}>
                <Link
                  href={`/projects/${project.id}/invoices/${invoice.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{invoice.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {range.start ? `${range.start} – ${range.end}` : t("until", { date: range.end })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(invoice.total)}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{formatDuration(invoice.durationMs)}</p>
                  </div>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
