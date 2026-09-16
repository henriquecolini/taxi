import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardContent } from "@/components/ui/card";
import { isAiConfigured } from "@/env";
import { requireOwner } from "@/lib/authz";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projectForm");
  return { title: t("newTitle") };
}

export default async function NewProjectPage() {
  await requireOwner();
  const t = await getTranslations("projectForm");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      <Card>
        <CardContent>
          <ProjectForm aiConfigured={isAiConfigured()} />
        </CardContent>
      </Card>
    </div>
  );
}
