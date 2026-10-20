"use client";

import { REFRESH_MS } from "@/constants/atlas";
import { useEffect } from "react";

/**
 * Calls `refresh` every `REFRESH_MS` while the page is in view, and once on coming back into view when that long has
 * passed (WTH-359): a page left open keeps "Adesso" now. Hidden pages ask for nothing.
 */
export function useRefresh(refresh: (() => void) | null): void {
  useEffect(() => {
    if (!refresh) return;
    let last = Date.now();
    const run = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      refresh();
    };
    const id = window.setInterval(run, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= REFRESH_MS) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
}
