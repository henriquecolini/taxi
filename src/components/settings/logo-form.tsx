"use client";

import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { ProjectLogo } from "@/components/projects/project-logo";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { removeLogo, uploadLogo } from "@/server/actions/projects";

export function LogoForm({ projectId, name, logoUrl }: { projectId: string; name: string; logoUrl: string | null }) {
  const t = useTranslations("settings");
  const input = useRef<HTMLInputElement>(null);
  const { pending, run } = useAction();

  function upload(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("logo", file);
    run(() => uploadLogo(projectId, formData), { success: t("logoSaved") });
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProjectLogo name={name} logoUrl={logoUrl} className="size-16" />
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => input.current?.click()} disabled={pending}>
          <ImageUpIcon />
          {t("uploadLogo")}
        </Button>
        {logoUrl ? (
          <Button variant="ghost" onClick={() => run(() => removeLogo(projectId))} disabled={pending}>
            <Trash2Icon />
            {t("removeLogo")}
          </Button>
        ) : null}
      </div>
      <p className="w-full text-xs text-muted-foreground">{t("logoHint")}</p>
    </div>
  );
}
