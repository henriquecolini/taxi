import { cn, initials } from "@/lib/utils";

interface ProjectLogoProps {
  name: string;
  logoUrl: string | null;
  className?: string;
}

/** Project logo, or its initials on a neutral tile when there is none. */
export function ProjectLogo({ name, logoUrl, className }: ProjectLogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by an authenticated route
      <img
        src={logoUrl}
        alt=""
        className={cn("size-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-foreground/10", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground ring-1 ring-foreground/10",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
