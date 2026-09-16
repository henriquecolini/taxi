import "server-only";
import { and, asc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { intervals, projectMembers, projectRepositories, projects } from "@/db/schema";
import { projectColumns, type ProjectRecord } from "@/lib/authz";
import { summarize, type Period } from "@/lib/billing";
import type { Viewer } from "@/lib/session";
import { startOfIsoDate } from "@/lib/time";
import { getIntervalsInPeriod, getOpenPeriod, getRunningInterval, timeZone, todayIso } from "./periods";

/** Minimal project data for headers, cards and client components. */
export interface ProjectSummaryDto {
  id: string;
  name: string;
  clientName: string;
  description: string;
  currency: string;
  hourlyRate: number;
  logoUrl: string | null;
  archived: boolean;
}

export function toProjectDto(project: ProjectRecord): ProjectSummaryDto {
  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    description: project.description,
    currency: project.currency,
    hourlyRate: project.hourlyRate,
    logoUrl: project.logoMime
      ? `/api/projects/${project.id}/logo?v=${project.updatedAt.getTime()}`
      : null,
    archived: project.archivedAt !== null,
  };
}

export interface ProjectCardDto extends ProjectSummaryDto {
  openPeriod: Period;
  openDurationMs: number;
  openAmount: number;
  isRunning: boolean;
}

/** Projects visible to the viewer, with their open-period totals. */
export function listProjectsForViewer(viewer: Viewer, now = Date.now()): ProjectCardDto[] {
  const db = getDb();
  const rows = viewer.isOwner
    ? db.select(projectColumns).from(projects).orderBy(asc(projects.name)).all()
    : db
        .select(projectColumns)
        .from(projects)
        .where(
          inArray(
            projects.id,
            db
              .select({ id: projectMembers.projectId })
              .from(projectMembers)
              .where(eq(projectMembers.email, viewer.email)),
          ),
        )
        .orderBy(asc(projects.name))
        .all();

  const running = getRunningInterval();
  return rows.map((project) => {
    const openPeriod = getOpenPeriod(project.id, now);
    const summary = summarize(getIntervalsInPeriod(project.id, openPeriod), { timeZone: timeZone(), now });
    return {
      ...toProjectDto(project),
      openPeriod,
      openDurationMs: summary.durationMs,
      openAmount: summary.subtotal,
      isRunning: running?.projectId === project.id,
    };
  });
}

export interface TimerStateDto {
  running: { projectId: string; startedAt: number } | null;
  /** Finished time per project for intervals that started today. */
  todayFinishedMs: Record<string, number>;
  /** Start of today in the app timezone. */
  todayStart: number;
  serverNow: number;
}

/** Owner-only timer state: the running interval and today's totals. */
export function getTimerState(now = Date.now()): TimerStateDto {
  const todayStart = startOfIsoDate(todayIso(now), timeZone());
  const todays = getDb()
    .select({ projectId: intervals.projectId, startedAt: intervals.startedAt, endedAt: intervals.endedAt })
    .from(intervals)
    .where(and(gte(intervals.startedAt, todayStart), isNotNull(intervals.endedAt)))
    .all();

  const todayFinishedMs: Record<string, number> = {};
  for (const row of todays) {
    todayFinishedMs[row.projectId] = (todayFinishedMs[row.projectId] ?? 0) + (row.endedAt! - row.startedAt);
  }

  const running = getRunningInterval();
  return {
    running: running ? { projectId: running.projectId, startedAt: running.startedAt } : null,
    todayFinishedMs,
    todayStart,
    serverNow: now,
  };
}

export interface ProjectSettingsDto extends ProjectSummaryDto {
  aiEnabled: boolean;
  aiLocale: ProjectRecord["aiLocale"];
  members: { id: string; email: string }[];
  repositories: { id: string; path: string; webUrl: string | null; lastSyncedAt: number | null }[];
}

export function getProjectSettings(project: ProjectRecord): ProjectSettingsDto {
  const db = getDb();
  return {
    ...toProjectDto(project),
    aiEnabled: project.aiEnabled,
    aiLocale: project.aiLocale,
    members: db
      .select({ id: projectMembers.id, email: projectMembers.email })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, project.id))
      .orderBy(asc(projectMembers.email))
      .all(),
    repositories: db
      .select({
        id: projectRepositories.id,
        path: projectRepositories.path,
        webUrl: projectRepositories.webUrl,
        lastSyncedAt: projectRepositories.lastSyncedAt,
      })
      .from(projectRepositories)
      .where(eq(projectRepositories.projectId, project.id))
      .orderBy(asc(projectRepositories.path))
      .all()
      .map((repo) => ({ ...repo, lastSyncedAt: repo.lastSyncedAt?.getTime() ?? null })),
  };
}
