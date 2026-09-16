import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { requireProjectOwner } from "@/lib/authz";
import { formatIsoDate } from "@/lib/format";
import { getLatestInvoiceItems } from "@/server/queries/invoices";
import { todayIso } from "@/server/queries/periods";

export default async function NewInvoicePage({ params }: PageProps<"/projects/[projectId]/invoices/new">) {
  const { project } = await requireProjectOwner((await params).projectId);
  const t = await getTranslations("invoiceForm");
  const locale = await getLocale();
  const today = todayIso();

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <InvoiceForm
        projectId={project.id}
        currency={project.currency}
        today={today}
        defaultName={t("defaultName", { month: formatIsoDate(today, locale, { month: "long", year: "numeric" }) })}
        defaultItems={getLatestInvoiceItems(project.id)}
      />
    </div>
  );
}
