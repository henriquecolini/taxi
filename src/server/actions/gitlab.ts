"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { isGitLabConfigured } from "@/env";
import { requireProjectOwner } from "@/lib/authz";
import { periodFor } from "@/lib/billing";
import { runAction, UserError } from "../action";
import { syncProjectCommits } from "../gitlab-sync";
import { getOpenPeriod, getPreviousInvoiceDate } from "../queries/periods";

/**
 * Syncs GitLab commits for a period: the given invoice's period, or the
 * current (not yet invoiced) period when no invoice is given.
 */
export async function syncCommits(projectId: string, invoiceId: string | null = null) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    if (!isGitLabConfigured()) throw new UserError("gitlabNotConfigured");

    let period = getOpenPeriod(project.id);
    if (invoiceId !== null) {
      const invoice = getDb()
        .select({ date: invoices.date })
        .from(invoices)
        .where(and(eq(invoices.id, z.string().parse(invoiceId)), eq(invoices.projectId, project.id)))
        .get();
      if (!invoice) throw new UserError("invalidInput");
      period = periodFor(getPreviousInvoiceDate(project.id, invoice.date), invoice.date);
    }

    try {
      await syncProjectCommits(project.id, period);
    } catch (error) {
      console.error("GitLab sync failed", error);
      throw new UserError("gitlabError");
    }
    revalidatePath("/", "layout");
  });
}
