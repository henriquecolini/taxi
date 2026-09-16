"use server";

import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { intervals, projects } from "@/db/schema";
import { requireOwner, requireProjectOwner } from "@/lib/authz";
import { isLocked } from "@/lib/billing";
import { runAction, UserError } from "../action";
import { getLatestInvoiceDate, timeZone } from "../queries/periods";

/** Starts a timer on a project, stopping any timer that is already running. */
export async function startTimer(projectId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    if (project.archivedAt) throw new UserError("invalidInput");

    const now = Date.now();
    if (isLocked(now, getLatestInvoiceDate(project.id), timeZone())) throw new UserError("locked");

    const db = getDb();
    db.transaction((tx) => {
      tx.update(intervals).set({ endedAt: now }).where(isNull(intervals.endedAt)).run();
      const { hourlyRate } = tx
        .select({ hourlyRate: projects.hourlyRate })
        .from(projects)
        .where(eq(projects.id, project.id))
        .get()!;
      tx.insert(intervals).values({ projectId: project.id, startedAt: now, rate: hourlyRate }).run();
    });

    revalidatePath("/", "layout");
  });
}

/** Stops the running timer, if any. */
export async function stopTimer() {
  return runAction(async () => {
    await requireOwner();
    getDb().update(intervals).set({ endedAt: Date.now() }).where(isNull(intervals.endedAt)).run();
    revalidatePath("/", "layout");
  });
}
