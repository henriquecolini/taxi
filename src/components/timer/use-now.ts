"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Current time, corrected by the offset between the server and browser
 * clocks, re-rendering every second. Refreshes server data when the tab
 * becomes visible again so other devices' changes show up.
 */
export function useNow(serverNow: number): number {
  const router = useRouter();
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const update = () => setNow(Date.now() + offset);
    const first = window.setTimeout(update, 0);
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [offset]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return now;
}
