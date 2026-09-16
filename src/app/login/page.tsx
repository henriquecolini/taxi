import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignInButton } from "@/components/auth/sign-in-button";
import { BrandMark } from "@/components/layout/brand";
import { PreferencesMenu } from "@/components/layout/preferences-menu";
import { getViewer } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

/** Only same-origin relative paths are accepted as post-login destinations. */
function safeNext(next: string | string[] | undefined): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const callbackUrl = safeNext(next);
  if (await getViewer()) redirect(callbackUrl);

  const t = await getTranslations();

  return (
    <main className="relative flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <div className="absolute top-4 right-4">
        <PreferencesMenu />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandMark className="size-14 rounded-2xl" />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>
            <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
          </div>
        </div>
        <div className="space-y-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {String(error).toUpperCase().includes("ACCESS_DENIED") ? t("login.accessDenied") : t("login.error")}
            </p>
          ) : null}
          <SignInButton callbackUrl={callbackUrl} />
          <p className="text-center text-xs text-muted-foreground">{t("login.hint")}</p>
        </div>
      </div>
    </main>
  );
}
