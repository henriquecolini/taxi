import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatMoney, formatPeriodRange } from "@/lib/format";
import type { ProjectCardDto } from "@/server/queries/projects";
import { ProjectLogo } from "./project-logo";

export async function ProjectCard({ project }: { project: ProjectCardDto }) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const range = formatPeriodRange(project.openPeriod, locale);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <ProjectLogo name={project.name} logoUrl={project.logoUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{project.name}</p>
          <p className="truncate text-sm text-muted-foreground">{project.clientName || " "}</p>
        </div>
        {project.isRunning ? (
          <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t("live")}
          </Badge>
        ) : project.archived ? (
          <Badge variant="secondary">{t("archived")}</Badge>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-4 border-t pt-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {range.start ? t("since", { date: range.start }) : t("allTime")}
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatDuration(project.openDurationMs)}</p>
        </div>
        <p className="text-lg font-semibold tabular-nums">
          {formatMoney(project.openAmount, project.currency, locale)}
        </p>
      </div>
    </Link>
  );
}
