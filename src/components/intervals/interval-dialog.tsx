"use client";

import { PlusIcon } from "lucide-react";
import { useTimeZone, useTranslations } from "next-intl";
import { useState } from "react";
import { Field } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/components/use-action";
import { centsToInput } from "@/lib/money";
import { toDateTimeLocal } from "@/lib/time";
import { createInterval, updateInterval } from "@/server/actions/intervals";

export interface EditableInterval {
  id: string;
  startedAt: number;
  endedAt: number;
  rate: number;
  note: string;
}

interface IntervalDialogProps {
  projectId: string;
  defaultRate: number;
  /** Interval to edit; omitted to add a new one. */
  interval?: EditableInterval;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Adds a past interval, or edits an existing one. Controlled by the parent. */
export function IntervalDialog({ projectId, defaultRate, interval, open, onOpenChange }: IntervalDialogProps) {
  const t = useTranslations("intervals");
  const timeZone = useTimeZone() ?? "UTC";
  const { pending, run } = useAction();

  const initial = () => {
    const end = interval?.endedAt ?? Date.now();
    const start = interval?.startedAt ?? end - 60 * 60_000;
    return {
      start: toDateTimeLocal(start, timeZone),
      end: toDateTimeLocal(end, timeZone),
      duration: "1:00",
      rate: centsToInput(interval?.rate ?? defaultRate),
      note: interval?.note ?? "",
    };
  };
  const [mode, setMode] = useState<"end" | "duration">(interval ? "end" : "duration");
  const [values, setValues] = useState(initial);
  const set = (key: keyof ReturnType<typeof initial>) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      projectId,
      start: values.start,
      rate: values.rate,
      note: values.note,
      ...(mode === "end" ? { end: values.end } : { duration: values.duration }),
    };
    run(() => (interval ? updateInterval(interval.id, input) : createInterval(input)), {
      success: interval ? t("updated") : t("added"),
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{interval ? t("editTitle") : t("addTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription", { timeZone })}</DialogDescription>
          </DialogHeader>

          <Field label={t("start")} htmlFor="interval-start">
            <Input id="interval-start" type="datetime-local" required value={values.start} onChange={set("start")} />
          </Field>

          <div className="grid gap-3">
            <Tabs value={mode} onValueChange={(value) => setMode(value as "end" | "duration")}>
              <TabsList className="w-full">
                <TabsTrigger value="duration">{t("byDuration")}</TabsTrigger>
                <TabsTrigger value="end">{t("byEnd")}</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "end" ? (
              <Field label={t("end")} htmlFor="interval-end">
                <Input id="interval-end" type="datetime-local" required value={values.end} onChange={set("end")} />
              </Field>
            ) : (
              <Field label={t("duration")} htmlFor="interval-duration" hint={t("durationHint")}>
                <Input
                  id="interval-duration"
                  required
                  inputMode="decimal"
                  placeholder="1:30"
                  value={values.duration}
                  onChange={set("duration")}
                />
              </Field>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
            <Field label={t("rate")} htmlFor="interval-rate">
              <Input id="interval-rate" required inputMode="decimal" value={values.rate} onChange={set("rate")} />
            </Field>
            <Field label={t("note")} htmlFor="interval-note">
              <Input id="interval-note" maxLength={500} value={values.note} onChange={set("note")} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {interval ? t("save") : t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Add time" button that opens a fresh dialog each time. */
export function AddIntervalButton({ projectId, defaultRate }: { projectId: string; defaultRate: number }) {
  const t = useTranslations("intervals");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <PlusIcon />
        {t("addTitle")}
      </Button>
      <IntervalDialog key={key} projectId={projectId} defaultRate={defaultRate} open={open} onOpenChange={setOpen} />
    </>
  );
}
