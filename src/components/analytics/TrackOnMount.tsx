"use client";

import { trackOnce, type AnalyticsEvent } from "@/lib/analytics/analytics";
import { useEffect } from "react";

/** Says an event happened when the page it is on is shown (a server page cannot: see `lib/analytics`) */
export function TrackOnMount({ event }: { event: AnalyticsEvent }) {
  useEffect(() => trackOnce(event), [event]);
  return null;
}
