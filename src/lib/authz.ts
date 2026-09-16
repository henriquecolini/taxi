import "server-only";
import { and, eq, getTableColumns } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { projectMembers, projects } from "@/db/schema";
import { getViewer, type Viewer } from "./session";

/**
 * Authorization layer. Every page, route handler and Server Action must call
 * one of these functions before reading or writing data.
 *
 * Roles:
 * - owner:  the freelancer (OWNER_EMAIL). Full access to everything.
 * - client: a Google account listed in a project's members. Read-only access
 *           to that project only.
 *
 * Denials use `notFound()` so the existence of other projects never leaks.
 */

export type ProjectRole = "owner" | "client";

/** Project columns safe to load for every request (the logo blob is excluded). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `logo` is omitted on purpose
const { logo, ...projectColumns } = getTableColumns(projects);
export { projectColumns };

export type ProjectRecord = Omit<typeof projects.$inferSelect, "logo">;

export interface ProjectAccess {
  viewer: Viewer;
  project: ProjectRecord;
  role: ProjectRole;
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isOwner) notFound();
  return viewer;
}

/** Resolves the viewer's role on a project, or `null` without access. */
export function projectRoleFor(viewer: Viewer, projectId: string): ProjectRole | null {
  if (viewer.isOwner) return "owner";
  const membership = getDb()
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.email, viewer.email)))
    .get();
  return membership ? "client" : null;
}

/** Read access: the owner, or a client invited to this project. */
export async function requireProjectAccess(projectId: string): Promise<ProjectAccess> {
  const viewer = await requireViewer();
  if (typeof projectId !== "string") notFound();
  const role = projectRoleFor(viewer, projectId);
  if (!role) notFound();
  const project = getDb().select(projectColumns).from(projects).where(eq(projects.id, projectId)).get();
  if (!project) notFound();
  return { viewer, project, role };
}

/** Write access: the owner only. */
export async function requireProjectOwner(projectId: string): Promise<ProjectAccess> {
  const access = await requireProjectAccess(projectId);
  if (access.role !== "owner") notFound();
  return access;
}
