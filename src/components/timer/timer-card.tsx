"use client";

import { PlayIcon, SquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTimeZone, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/components/use-action";
import { formatClock, formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { startTimer, stopTimer } from "@/server/actions/timer";
import type { TimerStateDto } from "@/server/queries/projects";
import { useNow } from "./use-now";

const DAY_MS = 86_400_000;

interface TimerCardProps {
  projects: { id: string; name: string }[];
  timer: TimerStateDto;
  /** Pre-selected project (e.g. on a project page). */
  projectId?: string;
  /** Hide the project picker when the card belongs to a single project. */
  fixedProject?: boolean;
}

export function TimerCard({ projects, timer, projectId, fixedProject = false }: TimerCardProps) {
  const t = useTranslations("timer");
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  const now = useNow(timer.serverNow);
  const { pending, run } = useAction();

  const running = timer.running;
  const [selectedId, setSelectedId] = useState(
    projectId ?? running?.projectId ?? projects[0]?.id ?? "",
  );
  const runningHere = running !== null && running.projectId === selectedId;
  const elapsed = running ? now - running.startedAt : 0;
  const runningName = projects.find((p) => p.id === running?.projectId)?.name;

  // Totals of intervals that started today (the day an interval belongs to is its start day).
  const runningToday = running && running.startedAt >= timer.todayStart ? elapsed : 0;
  const todayByProject = projects
    .map((project) => ({
      ...project,
      ms: (timer.todayFinishedMs[project.id] ?? 0) + (running?.projectId === project.id ? runningToday : 0),
    }))
    .filter((project) => project.ms > 0);
  const todayTotal = todayByProject.reduce((sum, project) => sum + project.ms, 0);
  const shownToday = fixedProject ? (todayByProject.find((p) => p.id === selectedId)?.ms ?? 0) : todayTotal;

  // Show the running clock in the browser tab.
  useEffect(() => {
    if (!running) return;
    const previous = document.title;
    document.title = `▶ ${formatClock(elapsed)} · ${runningName ?? ""}`;
    return () => {
      document.title = previous;
    };
  }, [running, elapsed, runningName]);

  // Past midnight the "today" totals are stale: fetch fresh ones.
  const router = useRouter();
  const isStaleDay = now >= timer.todayStart + DAY_MS;
  useEffect(() => {
    if (isStaleDay) router.refresh();
  }, [isStaleDay, router]);

  const toggle = () => {
    if (runningHere) run(() => stopTimer());
    else if (selectedId) run(() => startTimer(selectedId));
  };

  return (
    <Card className={cn("gap-0 py-0 transition-shadow", running && "ring-2 ring-brand/70")}>
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span
                className={cn(
                  "size-2 rounded-full",
                  running ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              {running
                ? t("runningSince", { project: runningName ?? "", time: formatTime(running.startedAt, locale, timeZone) })
                : t("idle")}
            </p>
            <p
              className="font-mono text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
              aria-live="off"
            >
              {formatClock(elapsed)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("today")}</p>
            <p className="text-xl font-semibold tabular-nums">{formatDuration(shownToday)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {fixedProject ? null : (
            <Select value={selectedId} onValueChange={setSelectedId} disabled={projects.length === 0}>
              <SelectTrigger className="h-12 w-full text-base sm:flex-1" aria-label={t("project")}>
                <SelectValue placeholder={t("chooseProject")} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="lg"
            onClick={toggle}
            disabled={pending || !selectedId}
            variant={runningHere ? "destructive" : "default"}
            className={cn("h-12 gap-2 px-6 text-base sm:min-w-40", fixedProject && "w-full")}
          >
            {runningHere ? <SquareIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
            {runningHere ? t("stop") : running ? t("switch") : t("start")}
          </Button>
        </div>

        {!fixedProject && todayByProject.length > 1 ? (
          <ul className="grid gap-1.5 border-t pt-4 text-sm">
            {todayByProject.map((project) => (
              <li key={project.id} className="flex justify-between gap-4">
                <span className="truncate text-muted-foreground">{project.name}</span>
                <span className="tabular-nums">{formatDuration(project.ms)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
