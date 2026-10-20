"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * The two parts of the Meteo section, Tempo and Territorio, and which one is being read (ADR-029). They are one page,
 * not two tabs: nothing is hidden, the titles lead to the parts by a gentle scroll and follow the reading. The spy is
 * an IntersectionObserver on a thin band across the screen, not a scroll-driven animation (Safari), and it never
 * writes the address. Territorio arrives in streaming and may turn out to hold nothing: while it is awaited the title is
 * there, and if nothing comes the part and its title are gone (the markup is `#parte-territorio`, emptied).
 */

export type Part = "tempo" | "territorio";

/** The id of a part's element, for the spy and the scroll. Not a bare `tempo`: an id that equals a hash would be scrolled to by the router */
export const partId = (part: Part) => `parte-${part}`;

/** Where, from the top of the screen, a part counts as the one being read: a thin band at 35% of its height */
const BAND = "-35% 0px -64% 0px";
/** The longest a smooth scroll to a part is allowed to hold the spy still, in milliseconds */
const HOLD_MS = 1500;

type PartsState = {
  active: Part;
  /** Whether Territorio is, or may still be, on the page */
  hasTerritory: boolean;
  go: (part: Part) => void;
};

const PartsContext = createContext<PartsState | null>(null);

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MeteoPartsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Part>("tempo");
  const [hasTerritory, setHasTerritory] = useState(true);
  const hold = useRef<number | null>(null);

  useEffect(() => {
    const tempo = document.getElementById(partId("tempo"));
    const territorio = document.getElementById(partId("territorio"));

    // Territorio: awaited (a placeholder inside), arrived (something inside) or empty (nothing: the part is gone)
    const readTerritory = () => {
      if (!territorio) return setHasTerritory(false);
      setHasTerritory(Boolean(territorio.querySelector("[data-territorio-pending]")) || territorio.childElementCount > 0);
    };
    readTerritory();
    const mutations = territorio ? new MutationObserver(readTerritory) : null;
    if (territorio) mutations?.observe(territorio, { childList: true, subtree: true });

    const inBand = new Set<Part>();
    const read = () => {
      if (hold.current !== null) return;
      const root = document.documentElement;
      const scrolls = root.scrollHeight > window.innerHeight + 2;
      const bottom = scrolls && window.scrollY + window.innerHeight >= root.scrollHeight - 2;
      const last = territorio && territorio.childElementCount > 0 ? "territorio" : "tempo";
      // At the very foot the last part is the one being read, however short it is
      const next = bottom ? last : inBand.has("territorio") ? "territorio" : inBand.has("tempo") ? "tempo" : null;
      if (next) setActive(next);
    };
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const part = e.target.id === partId("territorio") ? "territorio" : "tempo";
          if (e.isIntersecting) inBand.add(part);
          else inBand.delete(part);
        }
        read();
      },
      { rootMargin: BAND },
    );
    if (tempo) spy.observe(tempo);
    if (territorio) spy.observe(territorio);
    window.addEventListener("scroll", read, { passive: true });
    return () => {
      mutations?.disconnect();
      spy.disconnect();
      window.removeEventListener("scroll", read);
    };
  }, []);

  useEffect(
    () => () => {
      if (hold.current !== null) window.clearTimeout(hold.current);
    },
    [],
  );

  const go = useCallback((part: Part) => {
    const target = document.getElementById(partId(part));
    if (!target) return;
    setActive(part);
    // The spy waits while the page scrolls there, so the titles do not flicker through the parts on the way
    if (hold.current !== null) window.clearTimeout(hold.current);
    const release = () => {
      if (hold.current !== null) window.clearTimeout(hold.current);
      hold.current = null;
      window.removeEventListener("scrollend", release);
    };
    hold.current = window.setTimeout(release, HOLD_MS);
    window.addEventListener("scrollend", release, { once: true });
    target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  }, []);

  // With no Territorio there is only Tempo to be read
  const value = useMemo(() => ({ active: hasTerritory ? active : "tempo", hasTerritory, go }), [active, hasTerritory, go]);
  return <PartsContext.Provider value={value}>{children}</PartsContext.Provider>;
}

export function useMeteoParts(): PartsState {
  const ctx = useContext(PartsContext);
  if (!ctx) throw new Error("useMeteoParts must be used inside <MeteoPartsProvider>");
  return ctx;
}
