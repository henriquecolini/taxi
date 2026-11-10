import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { requireProjectOwner } from "@/lib/authz";
import { getInvoiceDetail } from "@/server/queries/invoices";
import { todayIso } from "@/server/queries/periods";

export default async function EditInvoicePage({ params }: PageProps<"/projects/[projectId]/invoices/[invoiceId]/edit">) {
  const { projectId, invoiceId } = await params;
  const { project } = await requireProjectOwner(projectId);
  const invoice = getInvoiceDetail(project.id, invoiceId);
  if (!invoice) notFound();
  const t = await getTranslations("invoiceForm");

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("editTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("editDescription")}</p>
      </div>
      <InvoiceForm
        projectId={project.id}
        currency={project.currency}
        today={todayIso()}
        defaultName={invoice.name}
        defaultItems={invoice.items}
        invoice={{ id: invoice.id, date: invoice.period.through, dateEditable: invoice.isLatest }}
      />
    </div>
  );
}
