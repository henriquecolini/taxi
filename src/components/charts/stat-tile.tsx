import type { ReactNode } from "react";

export function StatTile({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 print:break-inside-avoid">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
