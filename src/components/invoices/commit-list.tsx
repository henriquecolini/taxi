import { GitCommitHorizontalIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { CommitDto } from "@/server/queries/commits";

export function CommitList({ commits, locale, timeZone }: { commits: CommitDto[]; locale: string; timeZone: string }) {
  return (
    <ul className="grid gap-2">
      {commits.map((commit) => (
        <li key={`${commit.repository}:${commit.sha}`} className="flex gap-3 text-sm">
          <GitCommitHorizontalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <a
              href={commit.webUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="line-clamp-2 break-words hover:underline"
            >
              {commit.title}
            </a>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{commit.sha.slice(0, 8)}</span> · {commit.repository} ·{" "}
              {formatDateTime(commit.authoredAt, locale, timeZone)}
              {commit.branches.length ? ` · ${commit.branches.join(", ")}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-400">+{commit.additions}</span>{" "}
            <span className="text-red-700 dark:text-red-400">−{commit.deletions}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
