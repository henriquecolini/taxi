"use client";

import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { enUS, ptBR } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  datePlaceholder,
  formatDateInput,
  formatTimeInput,
  maskDateInput,
  parseDateInput,
  parseTimeInput,
  uses12HourClock,
} from "@/lib/date-input";
import { isIsoDate, type IsoDate } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Date and time inputs formatted in the app's locale (e.g. `16/09/2026` in
 * pt-BR), unlike native date inputs, which follow the browser's locale.
 * Values stay locale-independent: `YYYY-MM-DD` dates and `HH:mm` times.
 */

const CALENDAR_LOCALES = { en: enUS, "pt-BR": ptBR } as const;

function isoToLocalDate(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateToIso(date: Date): IsoDate {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface DateInputProps {
  id: string;
  /** Initial value (`YYYY-MM-DD`). The input keeps its own text while typing. */
  defaultValue: IsoDate | "";
  /** Called with a valid date, or `""` while the text is incomplete or invalid. */
  onChange: (value: IsoDate | "") => void;
  /** Latest selectable date. */
  max?: IsoDate;
  required?: boolean;
  className?: string;
}

export function DateInput({ id, defaultValue, onChange, max, required, className }: DateInputProps) {
  const t = useTranslations("dateInput");
  const locale = useLocale();
  const [text, setText] = useState(() => formatDateInput(defaultValue, locale));
  const [open, setOpen] = useState(false);

  const value = parseDateInput(text, locale);
  const outOfRange = value !== null && max !== undefined && value > max;
  const invalid = text.length > 0 && (value === null || outOfRange) && text.replace(/\D/g, "").length >= 8;

  function update(nextText: string) {
    setText(nextText);
    const parsed = parseDateInput(nextText, locale);
    onChange(parsed && !(max && parsed > max) ? parsed : "");
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={datePlaceholder(locale, { day: t("day"), month: t("month"), year: t("year") })}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => update(maskDateInput(event.target.value, locale))}
        className="pr-9 tabular-nums"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
            aria-label={t("openCalendar")}
          >
            <CalendarIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={CALENDAR_LOCALES[locale as keyof typeof CALENDAR_LOCALES] ?? enUS}
            selected={value ? isoToLocalDate(value) : undefined}
            defaultMonth={value ? isoToLocalDate(value) : max ? isoToLocalDate(max) : undefined}
            disabled={max ? { after: isoToLocalDate(max) } : undefined}
            onSelect={(date) => {
              if (!date) return;
              update(formatDateInput(localDateToIso(date), locale));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DateTimeInputProps {
  id: string;
  /** Initial value (`YYYY-MM-DDTHH:mm`, wall-clock time in the app timezone). */
  defaultValue: string;
  /** Called with `YYYY-MM-DDTHH:mm`, or `""` while either part is invalid. */
  onChange: (value: string) => void;
  required?: boolean;
}

export function DateTimeInput({ id, defaultValue, onChange, required }: DateTimeInputProps) {
  const t = useTranslations("dateInput");
  const locale = useLocale();
  const [initialDate, initialTime = ""] = defaultValue.split("T");
  const [date, setDate] = useState<IsoDate | "">(isIsoDate(initialDate) ? initialDate : "");
  const [timeText, setTimeText] = useState(() => formatTimeInput(initialTime, locale));

  const time = parseTimeInput(timeText);
  const emit = (nextDate: IsoDate | "", nextTime: string | null) =>
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : "");

  return (
    <div className="grid grid-cols-[1fr_7.5rem] gap-2">
      <DateInput
        id={id}
        required={required}
        defaultValue={date}
        onChange={(next) => {
          setDate(next);
          emit(next, time);
        }}
      />
      <Input
        id={`${id}-time`}
        aria-label={t("time")}
        autoComplete="off"
        required={required}
        placeholder={uses12HourClock(locale) ? t("timePlaceholder12") : t("timePlaceholder24")}
        value={timeText}
        aria-invalid={(timeText.trim().length > 0 && time === null) || undefined}
        onChange={(event) => {
          setTimeText(event.target.value);
          emit(date, parseTimeInput(event.target.value));
        }}
        onBlur={() => time && setTimeText(formatTimeInput(time, locale))}
        className="tabular-nums"
      />
    </div>
  );
}
