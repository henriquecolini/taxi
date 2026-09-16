"use client";

import { Settings2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PreferenceItems } from "./preferences";

/** Standalone language/theme menu for pages without a signed-in user. */
export function PreferencesMenu() {
  const t = useTranslations("preferences");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("title")}>
          <Settings2Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <PreferenceItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
