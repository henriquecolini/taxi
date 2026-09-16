"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isGitLabConfigured } from "@/env";
import { requireProjectOwner } from "@/lib/authz";
import { runAction, UserError } from "../action";
import { syncProjectCommits } from "../gitlab-sync";
import { getOpenPeriod } from "../queries/periods";

export async function syncCommits(projectId: string) {
  return runAction(async () => {
    const { project } = await requireProjectOwner(z.string().parse(projectId));
    if (!isGitLabConfigured()) throw new UserError("gitlabNotConfigured");
    try {
      await syncProjectCommits(project.id, getOpenPeriod(project.id));
    } catch (error) {
      console.error("GitLab sync failed", error);
      throw new UserError("gitlabError");
    }
    revalidatePath("/", "layout");
  });
}
