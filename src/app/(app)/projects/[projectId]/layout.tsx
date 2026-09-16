import type { Metadata } from "next";
import { ProjectLogo } from "@/components/projects/project-logo";
import { ProjectNav } from "@/components/projects/project-nav";
import { requireProjectAccess } from "@/lib/authz";
import { toProjectDto } from "@/server/queries/projects";

export async function generateMetadata({ params }: LayoutProps<"/projects/[projectId]">): Promise<Metadata> {
  const { project } = await requireProjectAccess((await params).projectId);
  return { title: project.name };
}

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const { project, role } = await requireProjectAccess((await params).projectId);
  const dto = toProjectDto(project);

  return (
    <div className="space-y-6">
      <div className="space-y-5 print:hidden">
        <div className="flex items-center gap-4">
          <ProjectLogo name={dto.name} logoUrl={dto.logoUrl} className="size-12 sm:size-14" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{dto.name}</h1>
            {dto.clientName ? <p className="truncate text-sm text-muted-foreground">{dto.clientName}</p> : null}
          </div>
        </div>
        <ProjectNav projectId={dto.id} isOwner={role === "owner"} />
      </div>
      {children}
    </div>
  );
}
