"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { centsToInput, CURRENCIES, parseMoney } from "@/lib/money";
import { createProject, updateProject, type ProjectInput } from "@/server/actions/projects";

interface ProjectFormProps {
  /** Existing project to edit; omitted when creating. */
  project?: {
    id: string;
    name: string;
    clientName: string;
    description: string;
    currency: string;
    hourlyRate: number;
    aiEnabled: boolean;
    aiLocale: "en" | "pt-BR";
  };
  aiConfigured: boolean;
}

export function ProjectForm({ project, aiConfigured }: ProjectFormProps) {
  const t = useTranslations("projectForm");
  const { pending, run } = useAction();
  const router = useRouter();
  const [values, setValues] = useState<ProjectInput>({
    name: project?.name ?? "",
    clientName: project?.clientName ?? "",
    description: project?.description ?? "",
    currency: project?.currency ?? "BRL",
    hourlyRate: project ? centsToInput(project.hourlyRate) : "",
    aiEnabled: project?.aiEnabled ?? false,
    aiLocale: project?.aiLocale ?? "en",
  });
  const [applyRateToOpenPeriod, setApplyRateToOpenPeriod] = useState(false);
  const rateChanged = project !== undefined && parseMoney(values.hourlyRate) !== project.hourlyRate;
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (project) {
      run(() => updateProject(project.id, { ...values, applyRateToOpenPeriod: rateChanged && applyRateToOpenPeriod }), {
        success: t("saved"),
        onSuccess: () => setApplyRateToOpenPeriod(false),
      });
    } else {
      run(() => createProject(values), { onSuccess: (id) => router.push(`/projects/${id}/settings`) });
    }
  }

  const currencies = CURRENCIES.includes(values.currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [...CURRENCIES, values.currency];

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} htmlFor="name">
          <Input id="name" required maxLength={100} value={values.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("clientName")} htmlFor="clientName">
          <Input
            id="clientName"
            maxLength={100}
            value={values.clientName}
            onChange={(e) => set("clientName", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("description")} htmlFor="description">
        <Textarea
          id="description"
          rows={3}
          maxLength={2000}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("currency")} htmlFor="currency">
          <Select value={values.currency} onValueChange={(value) => set("currency", value)}>
            <SelectTrigger id="currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("hourlyRate")} htmlFor="hourlyRate" hint={t("hourlyRateHint")}>
          <Input
            id="hourlyRate"
            inputMode="decimal"
            required
            placeholder="100.00"
            value={values.hourlyRate}
            onChange={(e) => set("hourlyRate", e.target.value)}
          />
        </Field>
      </div>

      {rateChanged ? (
        <label className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm">
          <Checkbox
            checked={applyRateToOpenPeriod}
            onCheckedChange={(checked) => setApplyRateToOpenPeriod(checked === true)}
            className="mt-0.5"
          />
          <span>{t("applyRateToOpenPeriod")}</span>
        </label>
      ) : null}

      <div className="grid gap-4 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="aiEnabled">{t("aiEnabled")}</Label>
            <p className="text-sm text-muted-foreground">
              {aiConfigured ? t("aiEnabledHint") : t("aiNotConfigured")}
            </p>
          </div>
          <Switch
            id="aiEnabled"
            checked={values.aiEnabled}
            onCheckedChange={(checked) => set("aiEnabled", checked)}
          />
        </div>
        {values.aiEnabled ? (
          <Field label={t("aiLocale")} htmlFor="aiLocale">
            <Select value={values.aiLocale} onValueChange={(value) => set("aiLocale", value as "en" | "pt-BR")}>
              <SelectTrigger id="aiLocale" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {LOCALE_LABELS[locale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} size="lg">
          {project ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
