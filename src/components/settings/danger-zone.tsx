"use client";

import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { deleteProject, setProjectArchived } from "@/server/actions/projects";

export function DangerZone({ projectId, name, archived }: { projectId: string; name: string; archived: boolean }) {
  const t = useTranslations("settings");
  const { pending, run } = useAction();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run(() => setProjectArchived(projectId, !archived))}
      >
        {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {archived ? t("unarchive") : t("archive")}
      </Button>
      <AlertDialog onOpenChange={() => setConfirmation("")}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <Trash2Icon />
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription", { name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={name} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending || confirmation.trim() !== name}
              onClick={() => run(() => deleteProject(projectId, confirmation), { onSuccess: () => router.push("/") })}
            >
              {t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
