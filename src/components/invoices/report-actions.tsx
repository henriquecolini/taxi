"use client";

import { ArrowLeftIcon, PrinterIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { SyncButton } from "@/components/activity/sync-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { generateInvoiceSummaries } from "@/server/actions/ai";
import { deleteInvoice } from "@/server/actions/invoices";

interface ReportActionsProps {
  projectId: string;
  invoiceId: string;
  isOwner: boolean;
  canDelete: boolean;
  canGenerate: boolean;
  canSync: boolean;
  hasSummaries: boolean;
}

export function ReportActions({ projectId, invoiceId, isOwner, canDelete, canGenerate, canSync, hasSummaries }: ReportActionsProps) {
  const t = useTranslations("report");
  const { pending, run } = useAction();
  const router = useRouter();

  function generate() {
    const id = toast.loading(t("generating"));
    run(() => generateInvoiceSummaries(projectId, invoiceId), {
      success: t("generated"),
      onSettled: () => toast.dismiss(id),
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <Button variant="ghost" asChild>
        <Link href={`/projects/${projectId}/invoices`}>
          <ArrowLeftIcon />
          {t("back")}
        </Link>
      </Button>
      <div className="flex flex-wrap gap-2">
        {isOwner && canSync ? <SyncButton projectId={projectId} invoiceId={invoiceId} /> : null}
        {isOwner && canGenerate ? (
          <Button variant="outline" onClick={generate} disabled={pending}>
            <SparklesIcon className={pending ? "animate-pulse" : undefined} />
            {hasSummaries ? t("regenerate") : t("generate")}
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => window.print()}>
          <PrinterIcon />
          {t("print")}
        </Button>
        {isOwner && canDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={pending}>
                <Trash2Icon />
                <span className="sr-only sm:not-sr-only">{t("delete")}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteInvoice(projectId, invoiceId), { onSuccess: () => router.push(`/projects/${projectId}/invoices`) })}>
                  {t("delete")}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}
