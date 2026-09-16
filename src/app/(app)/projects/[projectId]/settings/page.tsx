import { FileUpIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProjectForm } from "@/components/projects/project-form";
import { DangerZone } from "@/components/settings/danger-zone";
import { LogoForm } from "@/components/settings/logo-form";
import { MembersForm, RepositoriesForm } from "@/components/settings/project-access-forms";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { isAiConfigured, isGitLabConfigured } from "@/env";
import { requireProjectOwner } from "@/lib/authz";
import { getProjectSettings } from "@/server/queries/projects";

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[projectId]/settings">) {
  const { project } = await requireProjectOwner((await params).projectId);
  const settings = getProjectSettings(project);
  const t = await getTranslations("settings");

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <SettingsSection title={t("general")}>
        <ProjectForm project={settings} aiConfigured={isAiConfigured()} />
      </SettingsSection>

      <SettingsSection title={t("logo")}>
        <LogoForm projectId={settings.id} name={settings.name} logoUrl={settings.logoUrl} />
      </SettingsSection>

      <SettingsSection title={t("members")} description={t("membersDescription")}>
        <MembersForm projectId={settings.id} members={settings.members} />
      </SettingsSection>

      <SettingsSection
        title={t("repositories")}
        description={isGitLabConfigured() ? t("repositoriesDescription") : t("gitlabNotConfigured")}
      >
        <RepositoriesForm projectId={settings.id} repositories={settings.repositories} />
      </SettingsSection>

      <SettingsSection title={t("import")} description={t("importDescription")}>
        <Button variant="outline" asChild>
          <Link href={`/projects/${settings.id}/import`}>
            <FileUpIcon />
            {t("importAction")}
          </Link>
        </Button>
      </SettingsSection>

      <SettingsSection title={t("dangerZone")} description={t("dangerZoneDescription")}>
        <DangerZone projectId={settings.id} name={settings.name} archived={settings.archived} />
      </SettingsSection>
    </div>
  );
}
