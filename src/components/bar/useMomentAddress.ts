"use client";

import { withMoment } from "@/lib/weather/moment-address";
import type { TimeSelection } from "@/types/time";
import { useEffect, useRef } from "react";

/** How long the moment must stand still before the address says it (W7, W8) */
const QUIET_MS = 400;

/**
 * Writes the moment into the address once it has been still for a moment: `t` (Unix seconds) for an hour, nothing for
 * "Adesso". `history.replaceState`, not the router: the server is not asked for the page again (the weather of the
 * place is already here), and dragging the track leaves one history entry, not ten. The other parameters and the
 * hash stay as they are. The first render writes nothing: an address that came with a `t` the page could not show
 * keeps it until the person moves the moment.
 */
export function useMomentAddress(selection: TimeSelection) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const { pathname, search, hash } = window.location;
      const next = withMoment(search, selection);
      if (next === search.replace(/^\?/, "")) return;
      window.history.replaceState(null, "", `${pathname}${next ? `?${next}` : ""}${hash}`);
    }, QUIET_MS);
    return () => window.clearTimeout(timer);
  }, [selection]);
}
