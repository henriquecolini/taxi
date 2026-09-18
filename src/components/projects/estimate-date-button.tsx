"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAction } from "@/components/use-action";
import type { IsoDate } from "@/lib/time";
import { setEstimatedInvoiceDate } from "@/server/actions/projects";

interface EstimateDateButtonProps {
  projectId: string;
  /** Current estimated date. */
  date: IsoDate;
  /** Whether the date was picked by the owner rather than the default. */
  custom: boolean;
  /** Earliest allowed date: the day after the latest invoice. */
  min?: IsoDate;
}

/** Pencil button that lets the owner change the estimated invoice date. */
export function EstimateDateButton({ projectId, date, custom, min }: EstimateDateButtonProps) {
  const t = useTranslations("overview");
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<IsoDate | "">(date);

  const save = (next: IsoDate | null) =>
    run(() => setEstimatedInvoiceDate(projectId, next), { onSuccess: () => setOpen(false) });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(date);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="-my-1 size-5 text-muted-foreground" aria-label={t("editEstimateDate")}>
          <PencilIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (value) save(value);
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="estimate-date">{t("estimateDate")}</Label>
            <p className="text-xs text-muted-foreground">{t("estimateDateHint")}</p>
          </div>
          <DateInput id="estimate-date" required min={min} defaultValue={date} onChange={setValue} />
          <div className="flex justify-end gap-2">
            {custom ? (
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => save(null)}>
                {t("useDefaultDate")}
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={pending || !value}>
              {t("save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
