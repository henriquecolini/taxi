"use server";

import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { intervals } from "@/db/schema";
import { requireProjectOwner } from "@/lib/authz";
import { isLocked } from "@/lib/billing";
import { parseMoney } from "@/lib/money";
import { fromDateTimeLocal, parseDuration } from "@/lib/time";
import { runAction, UserError } from "../action";
import { getLatestInvoiceDate, timeZone } from "../queries/periods";

const intervalInput = z.object({
  projectId: z.string().min(1),
  /** `datetime-local` value in the app timezone. */
  start: z.string().min(1),
  /** Either an end (`datetime-local`)... */
  end: z.string().optional(),
  /** ...or a duration such as `1:30`. */
  duration: z.string().optional(),
  /** Hourly rate, e.g. `85.50`. */
  rate: z.string().min(1),
  note: z.string().max(500).default(""),
});

export type IntervalInput = z.input<typeof intervalInput>;

/** Parses and validates an interval against the lock and overlap rules. */
function resolveInterval(input: z.infer<typeof intervalInput>, excludeId?: string) {
  const tz = timeZone();
  const startedAt = fromDateTimeLocal(input.start, tz);
  if (startedAt === null) throw new UserError("invalidInput");

  let endedAt: number | null = null;
  if (input.end) {
    endedAt = fromDateTimeLocal(input.end, tz);
  } else if (input.duration) {
    const duration = parseDuration(input.duration);
    endedAt = duration === null ? null : startedAt + duration;
  }
  if (endedAt === null) throw new UserError("invalidInput");
  if (endedAt <= startedAt) throw new UserError("endBeforeStart");
  if (endedAt > Date.now()) throw new UserError("invalidInput");

  const rate = parseMoney(input.rate);
  if (rate === null || rate < 0) throw new UserError("invalidInput");

  if (isLocked(startedAt, getLatestInvoiceDate(input.projectId), tz)) throw new UserError("locked");

  // Only one timer runs at a time, so intervals never overlap, across all projects.
  const overlapping = getDb()
    .select({ id: intervals.id })
    .from(intervals)
    .where(
      and(
        excludeId ? ne(intervals.id, excludeId) : undefined,
        lt(intervals.startedAt, endedAt),
        or(isNull(intervals.endedAt), gt(intervals.endedAt, startedAt)),
      ),
    )
    .get();
  if (overlapping) throw new UserError("overlap");

  return { startedAt, endedAt, rate, note: input.note.trim() };
}

/** Retroactively adds an interval with an end time or a duration. */
export async function createInterval(raw: IntervalInput) {
  return runAction(async () => {
    const input = intervalInput.parse(raw);
    const { project } = await requireProjectOwner(input.projectId);
    const values = resolveInterval(input);
    getDb().insert(intervals).values({ projectId: project.id, ...values }).run();
    revalidatePath("/", "layout");
  });
}

export async function updateInterval(intervalId: string, raw: IntervalInput) {
  return runAction(async () => {
    const input = intervalInput.parse(raw);
    const { project } = await requireProjectOwner(input.projectId);
    const existing = findEditableInterval(project.id, z.string().parse(intervalId));
    if (existing.endedAt === null) throw new UserError("invalidInput");
    const values = resolveInterval(input, existing.id);
    getDb().update(intervals).set(values).where(eq(intervals.id, existing.id)).run();
    revalidatePath("/", "layout");
  });
}

export async function deleteInterval(projectId: string, intervalId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    const existing = findEditableInterval(project.id, z.string().parse(intervalId));
    getDb().delete(intervals).where(eq(intervals.id, existing.id)).run();
    revalidatePath("/", "layout");
  });
}

/** Loads an interval of the project that is not covered by an invoice. */
function findEditableInterval(projectId: string, intervalId: string) {
  const existing = getDb()
    .select()
    .from(intervals)
    .where(and(eq(intervals.id, intervalId), eq(intervals.projectId, projectId)))
    .get();
  if (!existing) throw new UserError("invalidInput");
  if (isLocked(existing.startedAt, getLatestInvoiceDate(projectId), timeZone())) {
    throw new UserError("locked");
  }
  return existing;
}
