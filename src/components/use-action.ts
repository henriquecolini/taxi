"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

interface RunOptions<T> {
  /** Toast shown on success. */
  success?: string;
  onSuccess?: (data: T) => void;
  /** Called after success or failure. */
  onSettled?: () => void;
}

/** Runs a Server Action in a transition and reports failures as toasts. */
export function useAction() {
  const t = useTranslations("errors");
  const [pending, startTransition] = useTransition();

  function run<T>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (options.success) toast.success(options.success);
          options.onSuccess?.(result.data);
        } else {
          toast.error(t(result.error));
        }
      } catch {
        toast.error(t("unexpected"));
      } finally {
        options.onSettled?.();
      }
    });
  }

  return { pending, run };
}
