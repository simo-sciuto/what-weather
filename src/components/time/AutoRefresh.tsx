"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { WEATHER_REVALIDATE_SECONDS } from "@/lib/weather/constants";
import { useMoment } from "./TimeContext";

/** Check this often while the page is on screen. */
const CHECK_MS = 60_000;

/**
 * Keeps an open page current. When the page is on screen and its data is
 * older than the forecast's own refresh (10 minutes), it asks the server for
 * the page again: on returning to the tab, and once a minute while it stays
 * open (an installed app, a kiosk). The server answers from its cache, so
 * this costs little. It waits while someone is exploring another hour on
 * the timeline, so the moment under their finger doesn't change beneath it.
 */
export function AutoRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { isLive } = useMoment();
  // Read from the listeners without re-subscribing on every scrub.
  const live = useRef(isLive);
  useEffect(() => {
    live.current = isLive;
  }, [isLive]);

  useEffect(() => {
    let loadedAt = Date.now();
    const check = () => {
      if (document.visibilityState !== "visible" || !live.current) return;
      if (Date.now() - loadedAt < WEATHER_REVALIDATE_SECONDS * 1000) return;
      loadedAt = Date.now();
      startTransition(() => router.refresh());
    };
    const id = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [router]);

  return null;
}
