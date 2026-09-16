"use client";

import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTimeZone, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Field } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { formatDateTime, formatDuration, formatIsoDate, formatMoney } from "@/lib/format";
import {
  COLUMN_PATTERNS,
  DATE_FORMATS,
  detectDateFormat,
  guessColumn,
  parseCsv,
  parseInvoiceRows,
  parseTimeRows,
  type CsvTable,
  type DateFormat,
  type ImportIssue,
} from "@/lib/import";
import { importData } from "@/server/actions/import";

const NONE = "-1";
const PREVIEW_ROWS = 8;

interface ImportWizardProps {
  projectId: string;
  currency: string;
  defaultRate: number;
}

export function ImportWizard({ projectId, currency, defaultRate }: ImportWizardProps) {
  const t = useTranslations("import");
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  const router = useRouter();
  const { pending, run } = useAction();

  const times = useCsvSource();
  const invoices = useCsvSource();

  const [timeColumns, setTimeColumns] = useState({ start: -1, end: -1, rate: -1 });
  const [timeFormat, setTimeFormat] = useState<DateFormat>("dmy");
  const [invoiceColumns, setInvoiceColumns] = useState({ date: -1, name: -1 });
  const [invoiceFormat, setInvoiceFormat] = useState<DateFormat>("dmy");

  function loadTimes(text: string) {
    const table = times.load(text);
    const start = Math.max(0, guessColumn(table.headers, COLUMN_PATTERNS.start));
    const end = guessColumn(table.headers, COLUMN_PATTERNS.end);
    setTimeColumns({
      start,
      end: end >= 0 ? end : Math.min(1, table.headers.length - 1),
      rate: guessColumn(table.headers, COLUMN_PATTERNS.rate),
    });
    setTimeFormat(detectDateFormat(table.rows.slice(0, 50).map((row) => row[start] ?? "")));
  }

  function loadInvoices(text: string) {
    const table = invoices.load(text);
    const date = Math.max(0, guessColumn(table.headers, COLUMN_PATTERNS.date));
    setInvoiceColumns({ date, name: guessColumn(table.headers, COLUMN_PATTERNS.name) });
    setInvoiceFormat(detectDateFormat(table.rows.slice(0, 50).map((row) => row[date] ?? "")));
  }

  const timeResult = useMemo(
    () =>
      times.table && timeColumns.start >= 0 && timeColumns.end >= 0
        ? parseTimeRows(
            times.table,
            { start: timeColumns.start, end: timeColumns.end, rate: timeColumns.rate >= 0 ? timeColumns.rate : null },
            { format: timeFormat, timeZone, defaultRate },
          )
        : null,
    [times.table, timeColumns, timeFormat, timeZone, defaultRate],
  );

  const invoiceResult = useMemo(
    () =>
      invoices.table && invoiceColumns.date >= 0
        ? parseInvoiceRows(
            invoices.table,
            { date: invoiceColumns.date, name: invoiceColumns.name >= 0 ? invoiceColumns.name : null },
            { format: invoiceFormat },
          )
        : null,
    [invoices.table, invoiceColumns, invoiceFormat],
  );

  const intervalCount = timeResult?.rows.length ?? 0;
  const invoiceCount = invoiceResult?.rows.length ?? 0;
  const totalMs = timeResult?.rows.reduce((sum, row) => sum + row.endedAt - row.startedAt, 0) ?? 0;

  function submit() {
    run(
      () =>
        importData(projectId, {
          intervals: (timeResult?.rows ?? []).map(({ startedAt, endedAt, rate }) => ({ startedAt, endedAt, rate })),
          invoices: (invoiceResult?.rows ?? []).map(({ date, name }) => ({ date, name })),
        }),
      {
        onSuccess: (data) => {
          router.push(`/projects/${projectId}`);
          return data;
        },
        success: t("done"),
      },
    );
  }

  const formatLabels: Record<DateFormat, string> = { dmy: t("formatDmy"), mdy: t("formatMdy"), iso: t("formatIso") };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("timesTitle")}</CardTitle>
          <CardDescription>{t("timesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <CsvInput id="times" onLoad={loadTimes} />
          {times.table ? (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <ColumnSelect label={t("startColumn")} headers={times.table.headers} value={timeColumns.start} onChange={(start) => setTimeColumns((c) => ({ ...c, start }))} />
                <ColumnSelect label={t("endColumn")} headers={times.table.headers} value={timeColumns.end} onChange={(end) => setTimeColumns((c) => ({ ...c, end }))} />
                <ColumnSelect
                  label={t("rateColumn")}
                  headers={times.table.headers}
                  value={timeColumns.rate}
                  noneLabel={t("useProjectRate")}
                  onChange={(rate) => setTimeColumns((c) => ({ ...c, rate }))}
                />
                <FormatSelect label={t("dateFormat")} value={timeFormat} labels={formatLabels} onChange={setTimeFormat} />
              </div>
              {timeResult ? (
                <Preview
                  headers={[t("start"), t("end"), t("duration"), t("rate")]}
                  rows={timeResult.rows.slice(0, PREVIEW_ROWS).map((row) => [
                    formatDateTime(row.startedAt, locale, timeZone),
                    formatDateTime(row.endedAt, locale, timeZone),
                    formatDuration(row.endedAt - row.startedAt),
                    formatMoney(row.rate, currency, locale),
                  ])}
                  total={timeResult.rows.length}
                  issues={timeResult.issues}
                />
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("invoicesTitle")}</CardTitle>
          <CardDescription>{t("invoicesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <CsvInput id="invoices" onLoad={loadInvoices} />
          {invoices.table ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <ColumnSelect label={t("dateColumn")} headers={invoices.table.headers} value={invoiceColumns.date} onChange={(date) => setInvoiceColumns((c) => ({ ...c, date }))} />
                <ColumnSelect
                  label={t("nameColumn")}
                  headers={invoices.table.headers}
                  value={invoiceColumns.name}
                  noneLabel={t("useDateAsName")}
                  onChange={(name) => setInvoiceColumns((c) => ({ ...c, name }))}
                />
                <FormatSelect label={t("dateFormat")} value={invoiceFormat} labels={formatLabels} onChange={setInvoiceFormat} />
              </div>
              {invoiceResult ? (
                <Preview
                  headers={[t("date"), t("name")]}
                  rows={invoiceResult.rows.slice(0, PREVIEW_ROWS).map((row) => [formatIsoDate(row.date, locale), row.name])}
                  total={invoiceResult.rows.length}
                  issues={invoiceResult.issues}
                />
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {t("summary", { intervals: intervalCount, duration: formatDuration(totalMs), invoices: invoiceCount })}
        </p>
        <Button size="lg" onClick={submit} disabled={pending || intervalCount + invoiceCount === 0}>
          <UploadIcon />
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}

function useCsvSource() {
  const [table, setTable] = useState<CsvTable | null>(null);
  return {
    table,
    load(text: string) {
      const parsed = parseCsv(text);
      setTable(parsed.headers.length > 0 ? parsed : null);
      return parsed;
    },
  };
}

function CsvInput({ id, onLoad }: { id: string; onLoad: (text: string) => void }) {
  const t = useTranslations("import");
  const [text, setText] = useState("");
  return (
    <div className="grid gap-3">
      <label
        htmlFor={`${id}-file`}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <FileSpreadsheetIcon className="size-4" />
        {t("chooseFile")}
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept=".csv,.tsv,text/csv,text/plain"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const content = await file.text();
          setText(content);
          onLoad(content);
        }}
      />
      <Textarea
        aria-label={t("pasteLabel")}
        placeholder={t("pastePlaceholder")}
        rows={4}
        className="font-mono text-xs"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onLoad(event.target.value);
        }}
      />
    </div>
  );
}

function ColumnSelect({
  label,
  headers,
  value,
  noneLabel,
  onChange,
}: {
  label: string;
  headers: string[];
  value: number;
  noneLabel?: string;
  onChange: (value: number) => void;
}) {
  const id = `column-${label}`;
  return (
    <Field label={label} htmlFor={id}>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {noneLabel ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {headers.map((header, index) => (
            <SelectItem key={index} value={String(index)}>
              {header || `#${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function FormatSelect({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: DateFormat;
  labels: Record<DateFormat, string>;
  onChange: (value: DateFormat) => void;
}) {
  const id = `format-${label}`;
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} onValueChange={(next) => onChange(next as DateFormat)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_FORMATS.map((format) => (
            <SelectItem key={format} value={format}>
              {labels[format]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Preview({ headers, rows, total, issues }: { headers: string[]; rows: string[][]; total: number; issues: ImportIssue[] }) {
  const t = useTranslations("import");
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-xs whitespace-nowrap tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">{t("validRows", { count: total })}</p>
      {issues.length > 0 ? (
        <details className="rounded-lg bg-destructive/5 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-destructive">{t("skippedRows", { count: issues.length })}</summary>
          <ul className="mt-2 grid gap-1 text-muted-foreground">
            {issues.slice(0, 50).map((issue, index) => (
              <li key={index}>{t("issue", { line: issue.line, reason: t(`issues.${issue.key}`) })}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
