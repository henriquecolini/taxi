import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projectMembers } from "@/db/schema";
import { env } from "@/env";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === env().OWNER_EMAIL;
}

/** An email may sign in if it belongs to the owner or to a member of any project. */
export function isEmailAllowed(email: string): boolean {
  if (isOwnerEmail(email)) return true;
  const membership = getDb()
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(eq(projectMembers.email, normalizeEmail(email)))
    .get();
  return membership !== undefined;
}
