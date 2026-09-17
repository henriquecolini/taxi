"use client";

import { AlertCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { DateInput } from "@/components/date-input";
import { Field } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import type { Period, PeriodSummary } from "@/lib/billing";
import type { ErrorKey } from "@/lib/action-result";
import { formatDuration, formatMoney, formatPeriodRange } from "@/lib/format";
import { centsToInput } from "@/lib/money";
import { createInvoice, previewInvoice } from "@/server/actions/invoices";

interface InvoiceFormProps {
  projectId: string;
  currency: string;
  today: string;
  defaultName: string;
  defaultItems: { description: string; amount: number }[];
}

export function InvoiceForm({ projectId, currency, today, defaultName, defaultItems }: InvoiceFormProps) {
  const t = useTranslations("invoiceForm");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const { pending, run } = useAction();
  const router = useRouter();
  const [, startPreview] = useTransition();

  const [date, setDate] = useState(today);
  const [name, setName] = useState(defaultName);
  const [items, setItems] = useState(
    defaultItems.map((item) => ({ description: item.description, amount: centsToInput(item.amount, locale) })),
  );
  const [preview, setPreview] = useState<{ period: Period; summary: PeriodSummary } | null>(null);
  const [previewError, setPreviewError] = useState<ErrorKey | null>(null);

  // Live preview, debounced while typing.
  useEffect(() => {
    const complete = items.filter((item) => item.description.trim() && item.amount.trim());
    // Wait until the date is complete and valid.
    if (!date) return;
    const id = window.setTimeout(() => {
      startPreview(async () => {
        const result = await previewInvoice(projectId, date, complete);
        setPreview(result.ok ? result.data : null);
        setPreviewError(result.ok ? null : result.error);
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [projectId, date, items]);

  const updateItem = (index: number, key: "description" | "amount", value: string) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    run(() => createInvoice({ projectId, date, name, items }), {
      onSuccess: (id) => router.push(`/projects/${projectId}/invoices/${id}`),
    });
  }

  const money = (cents: number) => formatMoney(cents, currency, locale);
  const range = preview ? formatPeriodRange(preview.period, locale) : null;

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardContent className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
            <Field label={t("date")} htmlFor="invoice-date" hint={t("dateHint")}>
              <DateInput id="invoice-date" required max={today} defaultValue={date} onChange={setDate} />
            </Field>
            <Field label={t("name")} htmlFor="invoice-name">
              <Input id="invoice-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium">{t("extras")}</p>
              <p className="text-xs text-muted-foreground">{t("extrasHint")}</p>
            </div>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={t("extraDescription")}
                  placeholder={t("extraDescription")}
                  value={item.description}
                  maxLength={200}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                />
                <Input
                  aria-label={t("extraAmount")}
                  placeholder={centsToInput(0, locale)}
                  inputMode="decimal"
                  className="w-32 shrink-0"
                  value={item.amount}
                  onChange={(e) => updateItem(index, "amount", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeExtra")}
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() => setItems((current) => [...current, { description: "", amount: "" }])}
            >
              <PlusIcon />
              {t("addExtra")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>{t("preview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {previewError ? (
            <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {tErrors(previewError)}
            </p>
          ) : null}
          {preview && range ? (
            <>
              <p className="text-sm text-muted-foreground">
                {range.start ? `${range.start} – ${range.end}` : t("until", { date: range.end })}
              </p>
              <dl className="grid gap-2 text-sm">
                {preview.summary.byRate.map((row) => (
                  <div key={row.rate} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {formatDuration(row.durationMs)} × {money(row.rate)}
                    </dt>
                    <dd className="tabular-nums">{money(row.amount)}</dd>
                  </div>
                ))}
                {items
                  .filter((item) => item.description.trim())
                  .map((item, index) => (
                    <div key={index} className="flex justify-between gap-4">
                      <dt className="truncate text-muted-foreground">{item.description}</dt>
                      <dd className="tabular-nums">{item.amount || "—"}</dd>
                    </div>
                  ))}
                <div className="mt-2 flex justify-between gap-4 border-t pt-3 text-base font-semibold">
                  <dt>{t("total")}</dt>
                  <dd className="tabular-nums">{money(preview.summary.total)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                {t("intervalCount", { count: preview.summary.intervalCount, duration: formatDuration(preview.summary.durationMs) })}
              </p>
            </>
          ) : null}
          <Button type="submit" size="lg" disabled={pending || !date || previewError !== null || preview === null}>
            {t("submit")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("lockNotice")}</p>
        </CardContent>
      </Card>
    </form>
  );
}
