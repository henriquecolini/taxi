import { TimerIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm",
        className,
      )}
      aria-hidden
    >
      <TimerIcon className="size-[60%]" strokeWidth={2.25} />
    </span>
  );
}
