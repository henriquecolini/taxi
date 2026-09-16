import { getTranslations } from "next-intl/server";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireProjectOwner } from "@/lib/authz";

export default async function ImportPage({ params }: PageProps<"/projects/[projectId]/import">) {
  const { project } = await requireProjectOwner((await params).projectId);
  const t = await getTranslations("import");
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ImportWizard projectId={project.id} currency={project.currency} defaultRate={project.hourlyRate} />
    </div>
  );
}
