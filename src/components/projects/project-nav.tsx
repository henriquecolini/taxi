"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", key: "overview" },
  { segment: "intervals", key: "time" },
  { segment: "invoices", key: "invoices" },
  { segment: "activity", key: "activity" },
  { segment: "settings", key: "settings", ownerOnly: true },
] as const;

export function ProjectNav({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const t = useTranslations("projectNav");
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:hidden" aria-label={t("label")}>
      <ul className="flex min-w-max gap-1 border-b">
        {TABS.filter((tab) => isOwner || !("ownerOnly" in tab)).map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = tab.segment
            ? pathname === href || pathname.startsWith(`${href}/`) || (tab.segment === "settings" && pathname.startsWith(`${base}/import`))
            : pathname === base;
          return (
            <li key={tab.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active &&
                    "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
