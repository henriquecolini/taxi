import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Viewer } from "@/lib/session";
import { BrandMark } from "./brand";
import { UserMenu } from "./user-menu";

export async function AppHeader({ viewer }: { viewer: Viewer }) {
  const t = await getTranslations("app");
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
          <BrandMark />
          <span>{t("name")}</span>
        </Link>
        <UserMenu name={viewer.name} email={viewer.email} image={viewer.image} isOwner={viewer.isOwner} />
      </div>
    </header>
  );
}
