"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { syncCommits } from "@/server/actions/gitlab";

export function SyncButton({ projectId }: { projectId: string }) {
  const t = useTranslations("activity");
  const { pending, run } = useAction();
  return (
    <Button variant="outline" disabled={pending} onClick={() => run(() => syncCommits(projectId), { success: t("synced") })}>
      <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
      {t("sync")}
    </Button>
  );
}
