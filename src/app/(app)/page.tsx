import { FolderPlusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { TimerCard } from "@/components/timer/timer-card";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/authz";
import { requestNow } from "@/server/queries/periods";
import { getTimerState, listProjectsForViewer } from "@/server/queries/projects";

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const t = await getTranslations("dashboard");
  const now = requestNow();
  const projects = listProjectsForViewer(viewer, now);
  const active = projects.filter((project) => !project.archived);
  const archived = projects.filter((project) => project.archived);

  return (
    <div className="space-y-8">
      <PageHeader
        title={viewer.isOwner ? t("titleOwner") : t("titleClient")}
        description={t("greeting", { name: viewer.name.split(" ")[0] ?? "" })}
        actions={
          viewer.isOwner ? (
            <Button asChild>
              <Link href="/projects/new">
                <PlusIcon />
                {t("newProject")}
              </Link>
            </Button>
          ) : null
        }
      />

      {viewer.isOwner && active.length > 0 ? (
        <TimerCard projects={active.map(({ id, name }) => ({ id, name }))} timer={getTimerState(now)} />
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlusIcon />}
          title={viewer.isOwner ? t("emptyOwner") : t("emptyClient")}
          description={viewer.isOwner ? t("emptyOwnerHint") : undefined}
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("projects")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("archivedProjects")}</h2>
          <div className="grid gap-4 opacity-75 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
