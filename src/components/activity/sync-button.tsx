"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { syncCommits } from "@/server/actions/gitlab";

/** Syncs commits for an invoice's period, or the current period when `invoiceId` is null. */
export function SyncButton({ projectId, invoiceId = null }: { projectId: string; invoiceId?: string | null }) {
  const t = useTranslations("activity");
  const { pending, run } = useAction();
  return (
    <Button variant="outline" disabled={pending} onClick={() => run(() => syncCommits(projectId, invoiceId), { success: t("synced") })}>
      <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
      {t("sync")}
    </Button>
  );
}
