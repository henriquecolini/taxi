"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPEN = "open";

export interface PeriodOption {
  /** Invoice id. */
  id: string;
  label: string;
}

/** Switches a page between the open period and past invoices (`?invoice=`). */
export function PeriodSelect({ options, selected }: { options: PeriodOption[]; selected: string | null }) {
  const t = useTranslations("periods");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      value={selected ?? OPEN}
      onValueChange={(value) => router.push(value === OPEN ? pathname : `${pathname}?invoice=${encodeURIComponent(value)}`)}
    >
      <SelectTrigger className="w-full sm:w-72" aria-label={t("label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={OPEN}>{t("open")}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
