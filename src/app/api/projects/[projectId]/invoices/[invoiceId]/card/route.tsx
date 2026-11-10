import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProjectAccess } from "@/lib/authz";
import { formatDuration, formatIsoDate, formatMoney, formatPeriodRange } from "@/lib/format";
import { splitSources, summaryPoints } from "@/lib/invoice-card";
import { THEME_COOKIE } from "@/lib/theme";
import { initials } from "@/lib/utils";
import { listCommitsInPeriod } from "@/server/queries/commits";
import { getInvoiceDetail } from "@/server/queries/invoices";
import { getProjectLogoDataUri } from "@/server/queries/projects";
import { renderInvoiceCard, type CardRow } from "@/server/invoice-card";

/** ASCII-only, so it is safe in a `Content-Disposition` header. */
function fileSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** A PNG card with the essentials of an invoice. Readable by anyone who can view the project. */
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/invoices/[invoiceId]/card">) {
  const { projectId, invoiceId } = await params;
  const { project } = await requireProjectAccess(projectId);
  const invoice = getInvoiceDetail(project.id, invoiceId);
  if (!invoice) notFound();

  const t = await getTranslations("report");
  const app = await getTranslations("app");
  const locale = await getLocale();
  const money = (cents: number) => formatMoney(cents, project.currency, locale);
  const range = formatPeriodRange(invoice.period, locale);
  const theme = (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";

  const sources: CardRow[] = [
    ...invoice.summary.byRate.map((row) => ({
      label: t("hoursItem"),
      detail: `${formatDuration(row.durationMs)} × ${t("perHour", { rate: money(row.rate) })}`,
      amount: money(row.amount),
      cents: row.amount,
    })),
    ...invoice.items.map((item) => ({
      label: item.description,
      detail: null,
      amount: money(item.amount),
      cents: item.amount,
    })),
  ];
  const { shown, rolledUp } = splitSources(sources);
  if (rolledUp.length > 0) {
    const cents = rolledUp.reduce((sum, row) => sum + row.cents, 0);
    shown.push({ label: t("otherItems", { count: rolledUp.length }), detail: null, amount: money(cents), cents });
  }

  const commitCount = listCommitsInPeriod(project.id, invoice.period).length;
  const stats = [
    { value: formatDuration(invoice.snapshot.durationMs), label: t("hours") },
    { value: String(invoice.summary.days.length), label: t("daysWorked") },
    ...(commitCount > 0 ? [{ value: String(commitCount), label: t("commits") }] : []),
  ];

  const overall = invoice.summaries.find((summary) => summary.scope === "overall");
  const headline = overall?.headline.trim() ?? "";
  const points = overall ? summaryPoints(overall.content) : [];

  return renderInvoiceCard(
    {
      theme,
      project: {
        name: project.name,
        client: project.clientName,
        initials: initials(project.name),
        logo: getProjectLogoDataUri(project.id),
      },
      invoice: {
        label: t("invoice"),
        name: invoice.name,
        period: range.start ? `${range.start} – ${range.end}` : t("until", { date: range.end }),
      },
      total: { label: t("total"), value: money(invoice.snapshot.total) },
      stats,
      summary: headline || points.length ? { label: t("overview"), headline, points } : null,
      breakdown: { label: t("breakdown"), rows: shown },
      footer: {
        brand: app("name"),
        issued: t("issued", { date: formatIsoDate(invoice.period.through, locale, { dateStyle: "long" }) }),
      },
    },
    `${fileSlug(project.name) || "invoice"}-${fileSlug(invoice.name) || "card"}.png`,
  );
}
