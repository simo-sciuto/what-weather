"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STATION_IDS, stationTitleId, type StationId } from "./stations";

/** Where, from the top of the screen, a station counts as the one being read: a thin band at 45% of its height */
const BAND = "-45% 0px -54% 0px";
/** The longest a smooth scroll to a station is allowed to hold the path still, in milliseconds */
const SCROLL_HOLD_MS = 1500;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A gentle scroll to a station (at once for those who asked for less motion), the focus moved to its heading without scrolling again; the address is left as it is */
export function scrollToStation(id: StationId) {
  const section = document.getElementById(id);
  if (!section) return false;
  section.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  // The heading takes the focus without scrolling again, so the next Tab starts inside the station
  document.getElementById(stationTitleId(id))?.focus({ preventScroll: true });
  return true;
}

/**
 * Which station the reader is at, by an IntersectionObserver on a band across the screen (not a scroll-driven
 * animation, which Safari does not do): the station under the band is the active one, and at the very foot of the page
 * the last, which may be too short to reach the band. Scrolling and the spy never write the address (W8).
 *
 * `goTo` is the path's link: a gentle scroll to the station (at once for those who asked for less motion), the focus
 * moved to its heading, the address left as it is. While the page scrolls there the spy waits, so the path does not
 * flicker through the stations on the way.
 */
export function useActiveStation() {
  const [active, setActive] = useState<StationId>(STATION_IDS[0]);
  const hold = useRef<{ id: StationId; timer: number } | null>(null);

  useEffect(() => {
    const inBand = new Set<StationId>();
    const read = () => {
      if (hold.current) return;
      const root = document.documentElement;
      const bottom = window.scrollY + window.innerHeight >= root.scrollHeight - 2;
      // A page that does not scroll is at its top and its foot at once: the first station is the one being read
      const scrolls = root.scrollHeight > window.innerHeight + 2;
      const next = bottom && scrolls ? STATION_IDS[STATION_IDS.length - 1] : STATION_IDS.find((id) => inBand.has(id));
      if (next) setActive(next);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id as StationId;
          if (e.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        read();
      },
      { rootMargin: BAND },
    );
    for (const id of STATION_IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    window.addEventListener("scroll", read, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", read);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(hold.current?.timer), []);

  const goTo = useCallback((id: StationId) => {
    if (!document.getElementById(id)) return;
    window.clearTimeout(hold.current?.timer);
    setActive(id);
    const release = () => {
      window.clearTimeout(hold.current?.timer);
      hold.current = null;
      window.removeEventListener("scrollend", release);
    };
    hold.current = { id, timer: window.setTimeout(release, SCROLL_HOLD_MS) };
    window.addEventListener("scrollend", release, { once: true });
    scrollToStation(id);
  }, []);

  return { active, goTo };
}
