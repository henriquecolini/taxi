import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/** Picks the locale from the cookie, falling back to the browser language. */
async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  return /^pt\b/i.test(acceptLanguage.trim()) ? "pt-BR" : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: process.env.TIMEZONE || "America/Sao_Paulo",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
