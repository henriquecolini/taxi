"use client";

import { PencilIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { saveInvoiceSummary } from "@/server/actions/invoices";

interface SummaryBlockProps {
  projectId: string;
  invoiceId: string;
  scope: string;
  headline: string;
  content: string;
  canEdit: boolean;
  /** Rendered markdown (server component output). */
  children?: React.ReactNode;
}

/** An overall or weekly summary with an owner-only editor. */
export function SummaryBlock({ projectId, invoiceId, scope, headline, content, canEdit, children }: SummaryBlockProps) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ headline, content });
  const { pending, run } = useAction();

  if (!content && !canEdit) return null;

  return (
    <div className="group/summary relative grid gap-2">
      {content ? (
        <>
          {headline ? (
            <p className="flex items-start gap-2 font-medium">
              <SparklesIcon className="mt-0.5 size-4 shrink-0 text-brand print:hidden" aria-hidden />
              {headline}
            </p>
          ) : null}
          {children}
        </>
      ) : null}
      {canEdit ? (
        <Button
          variant="ghost"
          size="xs"
          className="justify-self-start text-muted-foreground print:hidden"
          onClick={() => {
            setDraft({ headline, content });
            setOpen(true);
          }}
        >
          <PencilIcon />
          {content ? t("editSummary") : t("writeSummary")}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => saveInvoiceSummary(projectId, invoiceId, { scope, ...draft }), {
                success: t("summarySaved"),
                onSuccess: () => setOpen(false),
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("editSummary")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`headline-${scope}`}>{t("headline")}</Label>
              <Input
                id={`headline-${scope}`}
                maxLength={200}
                value={draft.headline}
                onChange={(event) => setDraft((d) => ({ ...d, headline: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`content-${scope}`}>{t("content")}</Label>
              <Textarea
                id={`content-${scope}`}
                rows={10}
                maxLength={20000}
                className="font-mono text-sm"
                value={draft.content}
                onChange={(event) => setDraft((d) => ({ ...d, content: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t("markdownHint")}</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
