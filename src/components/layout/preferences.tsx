"use client";

import { LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LOCALE_LABELS, LOCALES } from "@/i18n/config";
import { THEMES, type Theme } from "@/lib/theme";
import { setLocale, setTheme } from "@/server/actions/preferences";

const THEME_ICONS: Record<Theme, typeof SunIcon> = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

/** Language and theme radio groups, rendered inside a dropdown menu. */
export function PreferenceItems() {
  const t = useTranslations("preferences");
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const currentTheme = readThemeFromDocument();

  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-2">
        <LanguagesIcon className="size-3.5" />
        {t("language")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={locale}
        onValueChange={(value) => startTransition(() => setLocale(value))}
      >
        {LOCALES.map((option) => (
          <DropdownMenuRadioItem key={option} value={option}>
            {LOCALE_LABELS[option]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={currentTheme}
        onValueChange={(value) => startTransition(() => setTheme(value))}
      >
        {THEMES.map((option) => {
          const Icon = THEME_ICONS[option];
          return (
            <DropdownMenuRadioItem key={option} value={option}>
              <Icon className="size-4" />
              {t(`themes.${option}`)}
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </>
  );
}

function readThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "system";
  const { classList } = document.documentElement;
  return classList.contains("dark") ? "dark" : classList.contains("light") ? "light" : "system";
}
