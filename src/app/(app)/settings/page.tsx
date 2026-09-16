import { CheckCircle2Icon, DatabaseBackupIcon, XCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { env, isAiConfigured, isGitLabConfigured } from "@/env";
import { requireOwner } from "@/lib/authz";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appSettings");
  return { title: t("title") };
}

export default async function AppSettingsPage() {
  await requireOwner();
  const t = await getTranslations("appSettings");
  const config = env();

  const status = [
    { label: t("timezone"), value: config.TIMEZONE, ok: true },
    { label: t("owner"), value: config.OWNER_EMAIL, ok: true },
    { label: t("gitlab"), value: isGitLabConfigured() ? config.GITLAB_URL : t("notConfigured"), ok: isGitLabConfigured() },
    {
      label: t("gitlabAuthors"),
      value: config.GITLAB_AUTHOR_EMAILS.length ? config.GITLAB_AUTHOR_EMAILS.join(", ") : t("allAuthors"),
      ok: true,
    },
    { label: t("ai"), value: isAiConfigured() ? config.ANTHROPIC_MODEL : t("notConfigured"), ok: isAiConfigured() },
  ];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={t("title")} description={t("description")} />

      <SettingsSection title={t("configuration")} description={t("configurationDescription")}>
        <dl className="divide-y rounded-lg border text-sm">
          {status.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="flex min-w-0 items-center gap-2 font-medium">
                <span className="truncate">{row.value}</span>
                {row.ok ? (
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-label={t("ok")} />
                ) : (
                  <XCircleIcon className="size-4 shrink-0 text-muted-foreground" aria-label={t("notConfigured")} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      <SettingsSection title={t("backup")} description={t("backupDescription")}>
        <Button variant="outline" asChild>
          <a href="/api/backup" download>
            <DatabaseBackupIcon />
            {t("downloadBackup")}
          </a>
        </Button>
      </SettingsSection>
    </div>
  );
}
