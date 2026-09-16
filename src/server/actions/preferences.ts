"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Preferences are plain cookies: no authentication needed, nothing sensitive. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, sameSite: "lax", path: "/" });
}

export async function setTheme(theme: string) {
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, { maxAge: ONE_YEAR, sameSite: "lax", path: "/" });
}
