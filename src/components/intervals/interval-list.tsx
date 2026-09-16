"use client";

import { LockIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTimeZone, useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAction } from "@/components/use-action";
import { formatDuration, formatIsoDate, formatMoney, formatTime } from "@/lib/format";
import { MS_PER_HOUR, toIsoDate, type IsoDate } from "@/lib/time";
import { deleteInterval } from "@/server/actions/intervals";
import { IntervalDialog, type EditableInterval } from "./interval-dialog";

export interface IntervalDto {
  id: string;
  startedAt: number;
  endedAt: number | null;
  rate: number;
  note: string;
  locked: boolean;
}

interface IntervalListProps {
  projectId: string;
  intervals: IntervalDto[];
  currency: string;
  defaultRate: number;
  canEdit: boolean;
  serverNow: number;
}

/** Intervals grouped by start day, newest first. */
export function IntervalList({ projectId, intervals, currency, defaultRate, canEdit, serverNow }: IntervalListProps) {
  const t = useTranslations("intervals");
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  const { pending, run } = useAction();
  const [editing, setEditing] = useState<EditableInterval | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const days = new Map<IsoDate, IntervalDto[]>();
  for (const interval of [...intervals].sort((a, b) => b.startedAt - a.startedAt)) {
    const date = toIsoDate(interval.startedAt, timeZone);
    days.set(date, [...(days.get(date) ?? []), interval]);
  }

  return (
    <div className="grid gap-5">
      {editing ? (
        <IntervalDialog
          key={editing.id}
          projectId={projectId}
          defaultRate={defaultRate}
          interval={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                deleting &&
                run(() => deleteInterval(projectId, deleting), {
                  success: t("deleted"),
                  onSuccess: () => setDeleting(null),
                })
              }
            >
              {t("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {[...days.entries()].map(([date, rows]) => {
        const dayTotal = rows.reduce((sum, row) => sum + ((row.endedAt ?? serverNow) - row.startedAt), 0);
        return (
          <section key={date} className="grid gap-2">
            <header className="flex items-baseline justify-between px-1 text-sm">
              <h3 className="font-medium">{formatIsoDate(date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
              <span className="text-muted-foreground tabular-nums">{formatDuration(dayTotal)}</span>
            </header>
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {rows.map((row) => {
                const duration = (row.endedAt ?? serverNow) - row.startedAt;
                const crossesMidnight = row.endedAt !== null && toIsoDate(row.endedAt, timeZone) !== date;
                return (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <p className="flex items-center gap-2 text-sm tabular-nums">
                        {formatTime(row.startedAt, locale, timeZone)} – {row.endedAt ? formatTime(row.endedAt, locale, timeZone) : t("running")}
                        {crossesMidnight ? <span className="text-xs text-muted-foreground">+1</span> : null}
                        {row.locked ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <LockIcon className="size-3.5 text-muted-foreground" aria-label={t("locked")} />
                            </TooltipTrigger>
                            <TooltipContent>{t("lockedHint")}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </p>
                      {row.note ? <p className="truncate text-sm text-muted-foreground">{row.note}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{formatDuration(duration)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(Math.round((duration * row.rate) / MS_PER_HOUR), currency, locale)}
                      </p>
                    </div>
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("actions")}
                            disabled={row.locked || row.endedAt === null}
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing({ ...row, endedAt: row.endedAt ?? serverNow })}>
                            <PencilIcon />
                            {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(row.id)}>
                            <Trash2Icon />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
