"use client";

import { useTranslations } from "next-intl";
import { formatClock } from "@/lib/format";
import { useNow } from "./use-now";

/** Read-only "working now" indicator shown to clients while a timer runs. */
export function LiveBadge({ startedAt, serverNow }: { startedAt: number; serverNow: number }) {
  const t = useTranslations("timer");
  const now = useNow(serverNow);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-emerald-800 ring-1 ring-emerald-500/20 dark:text-emerald-300">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        {t("workingNow")}
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums">{formatClock(now - startedAt)}</span>
    </div>
  );
}
