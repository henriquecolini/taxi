"use client";

import { useLocale, useTimeZone, useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";
import { addMember, addRepository, removeMember, removeRepository } from "@/server/actions/projects";
import { ListForm } from "./list-form";

export function MembersForm({ projectId, members }: { projectId: string; members: { id: string; email: string }[] }) {
  const t = useTranslations("settings");
  return (
    <ListForm
      items={members.map((member) => ({ id: member.id, label: member.email }))}
      inputType="email"
      placeholder="client@example.com"
      addLabel={t("invite")}
      removeLabel={t("remove")}
      emptyLabel={t("noMembers")}
      onAdd={(email) => addMember(projectId, email)}
      onRemove={(id) => removeMember(projectId, id)}
    />
  );
}

export function RepositoriesForm({
  projectId,
  repositories,
}: {
  projectId: string;
  repositories: { id: string; path: string; lastSyncedAt: number | null }[];
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  return (
    <ListForm
      items={repositories.map((repo) => ({
        id: repo.id,
        label: <span className="font-mono">{repo.path}</span>,
        detail: repo.lastSyncedAt
          ? t("lastSynced", { date: formatDateTime(repo.lastSyncedAt, locale, timeZone) })
          : t("neverSynced"),
      }))}
      placeholder="group/repository"
      addLabel={t("addRepository")}
      removeLabel={t("remove")}
      emptyLabel={t("noRepositories")}
      onAdd={(path) => addRepository(projectId, path)}
      onRemove={(id) => removeRepository(projectId, id)}
    />
  );
}
