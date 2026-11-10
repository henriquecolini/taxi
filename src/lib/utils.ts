export { cn } from "cn"

/** Up to two initials of a name, e.g. `Acme Corp` → `AC`. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
