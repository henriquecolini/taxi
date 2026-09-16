"use server";

import { and, eq, gte, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { AI_LOCALES, intervals, projectMembers, projectRepositories, projects } from "@/db/schema";
import { isOwnerEmail, normalizeEmail } from "@/lib/access";
import { requireOwner, requireProjectOwner } from "@/lib/authz";
import { periodBounds } from "@/lib/billing";
import { parseMoney } from "@/lib/money";
import { runAction, UserError } from "../action";
import { getOpenPeriod, timeZone } from "../queries/periods";

const projectInput = z.object({
  name: z.string().trim().min(1).max(100),
  clientName: z.string().trim().max(100).default(""),
  description: z.string().trim().max(2000).default(""),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .refine(isSupportedCurrency),
  hourlyRate: z.string().min(1),
  aiEnabled: z.boolean().default(false),
  aiLocale: z.enum(AI_LOCALES).default("en"),
});

export type ProjectInput = z.input<typeof projectInput>;

function isSupportedCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

function parseProject(raw: ProjectInput) {
  const { hourlyRate, ...input } = projectInput.parse(raw);
  const rate = parseMoney(hourlyRate);
  if (rate === null || rate < 0) throw new UserError("invalidInput");
  return { ...input, hourlyRate: rate };
}

/** Creates a project and returns its id. */
export async function createProject(raw: ProjectInput) {
  return runAction(async () => {
    await requireOwner();
    const [created] = getDb().insert(projects).values(parseProject(raw)).returning({ id: projects.id }).all();
    revalidatePath("/", "layout");
    return created.id;
  });
}

export async function updateProject(
  projectId: string,
  raw: ProjectInput & { applyRateToOpenPeriod?: boolean },
) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const values = parseProject(raw);
    const db = getDb();

    db.transaction((tx) => {
      tx.update(projects).set(values).where(eq(projects.id, project.id)).run();
      if (raw.applyRateToOpenPeriod === true) {
        // Only unlocked, finished intervals of the open period are repriced.
        const { start } = periodBounds(getOpenPeriod(project.id), timeZone());
        tx.update(intervals)
          .set({ rate: values.hourlyRate })
          .where(
            and(
              eq(intervals.projectId, project.id),
              start === null ? undefined : gte(intervals.startedAt, start),
              isNotNull(intervals.endedAt),
            ),
          )
          .run();
      }
    });

    revalidatePath("/", "layout");
  });
}

const LOGO_MAX_BYTES = 512 * 1024;

/** Detects PNG, JPEG and WebP from magic bytes. SVG is rejected on purpose (XSS). */
function detectImageMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

export async function uploadLogo(projectId: string, formData: FormData) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0 || file.size > LOGO_MAX_BYTES) {
      throw new UserError("invalidLogo");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(bytes);
    if (!mime) throw new UserError("invalidLogo");

    getDb().update(projects).set({ logo: bytes, logoMime: mime }).where(eq(projects.id, project.id)).run();
    revalidatePath("/", "layout");
  });
}

export async function removeLogo(projectId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    getDb().update(projects).set({ logo: null, logoMime: null }).where(eq(projects.id, project.id)).run();
    revalidatePath("/", "layout");
  });
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    getDb()
      .update(projects)
      .set({ archivedAt: z.boolean().parse(archived) ? new Date() : null })
      .where(eq(projects.id, project.id))
      .run();
    revalidatePath("/", "layout");
  });
}

export async function deleteProject(projectId: string, confirmationName: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    if (z.string().parse(confirmationName).trim() !== project.name) throw new UserError("invalidInput");
    getDb().delete(projects).where(eq(projects.id, project.id)).run();
    revalidatePath("/", "layout");
  });
}

export async function addMember(projectId: string, rawEmail: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const email = normalizeEmail(z.email().parse(rawEmail.trim()));
    if (isOwnerEmail(email)) throw new UserError("memberIsOwner");

    const result = getDb()
      .insert(projectMembers)
      .values({ projectId: project.id, email })
      .onConflictDoNothing()
      .run();
    if (result.changes === 0) throw new UserError("memberExists");
    revalidatePath("/", "layout");
  });
}

export async function removeMember(projectId: string, memberId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    getDb()
      .delete(projectMembers)
      .where(and(eq(projectMembers.id, z.string().parse(memberId)), eq(projectMembers.projectId, project.id)))
      .run();
    revalidatePath("/", "layout");
  });
}

const repositoryPath = z
  .string()
  .trim()
  // Accept a pasted URL like https://gitlab.com/group/repo(.git)
  .transform((value) => value.replace(/^https?:\/\/[^/]+\//, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, ""))
  .pipe(z.string().regex(/^[\w.-]+(\/[\w.-]+)+$/));

export async function addRepository(projectId: string, rawPath: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const path = repositoryPath.parse(rawPath);
    const result = getDb()
      .insert(projectRepositories)
      .values({ projectId: project.id, path })
      .onConflictDoNothing()
      .run();
    if (result.changes === 0) throw new UserError("repositoryExists");
    revalidatePath("/", "layout");
  });
}

export async function removeRepository(projectId: string, repositoryId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    getDb()
      .delete(projectRepositories)
      .where(
        and(
          eq(projectRepositories.id, z.string().parse(repositoryId)),
          eq(projectRepositories.projectId, project.id),
        ),
      )
      .run();
    revalidatePath("/", "layout");
  });
}
