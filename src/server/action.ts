import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionResult, ErrorKey } from "@/lib/action-result";

export type { ActionResult, ErrorKey };

/** A business rule violation that should be reported to the user. */
export class UserError extends Error {
  constructor(readonly key: ErrorKey) {
    super(key);
    this.name = "UserError";
  }
}

/**
 * Runs a Server Action body, converting expected failures (validation and
 * business rules) into a typed result. Unexpected errors and Next.js control
 * flow (redirect, notFound) propagate unchanged.
 */
export async function runAction<T>(fn: () => T | Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof UserError) return { ok: false, error: error.key };
    if (error instanceof z.ZodError) return { ok: false, error: "invalidInput" };
    throw error;
  }
}
