"use client";

import { journeyQuery, type Section } from "@/lib/sections";
import { Activity, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CreaSection } from "../create/CreaSection";
import { usePlace } from "../location/PlaceContext";
import { Dock, type DockItem } from "../nav/Dock";
import { SECTION_DEFS } from "../nav/sections";
import { useMoment, AtmosphereMain } from "../time/TimeContext";
import { HeadlineBand } from "../weather/HeadlineBand";
import { MapBackdropGL } from "../weather/MapBackdropGL";
import { Sky } from "../weather/Sky";
import { MeteoPartsProvider } from "./MeteoParts";
import { createSectionStore, type SectionStore } from "./section-store";

let browserStore: SectionStore | null = null;
/** The one store of the page, made on the first use in the browser */
const store = () => (browserStore ??= createSectionStore(window));
const subscribe = (onChange: () => void) => store().subscribe(onChange);

/** The section on show: the address' (route and hash) in the browser, and the route's own on the server and while hydrating */
export function useSection(initial: Section): Section {
  return useSyncExternalStore(
    subscribe,
    () => store().getSnapshot(),
    () => initial,
  );
}

/** The title of a section, which the focus goes to: the copy that is laid out (the reading has one for each size of screen) */
function focusTitle(section: Section) {
  const titles = document.querySelectorAll<HTMLElement>(`[data-section-title="${section}"]`);
  const shown = [...titles].find((el) => el.getClientRects().length > 0);
  shown?.focus({ preventScroll: true });
}

/**
 * The bar with the addresses it needs: it reads the moment (Esplora carries it), so it is a component of its own and
 * the page around it does not render when the hour moves (ADR-008).
 */
function TavolaDock({ current, onSelect }: { current: Section; onSelect: (section: Section) => void }) {
  const { place } = usePlace();
  const { selection } = useMoment();
  const t = selection.mode === "at" ? selection.instant : null;
  const items = useMemo<DockItem[]>(
    () => [
      { id: "meteo", href: "#meteo", onSelect: () => onSelect("meteo") },
      // Until D6 the map is its own route, and the place and the moment go with the person (the address is the truth)
      { id: "esplora", href: `/atlas?${journeyQuery(place, t)}` },
      { id: "crea", href: "#crea", onSelect: () => onSelect("crea") },
    ],
    [place, t, onSelect],
  );
  return <Dock current={current} items={items} />;
}
const DockMemo = memo(TavolaDock);

/**
 * The page (ADR-029): one route, three sections as the state of the address. Meteo is the document itself and keeps
 * its scroll; Crea is a layer over it with its own scroll, opaque, tinted by the sky, mounted on the first visit and
 * afterwards hidden with `Activity` (its state kept, its effects off). While Crea is on show Meteo is `inert` and hidden from
 * screen readers. Esplora is not mounted here yet: its entry in the bar is a link to the Atlas (until D6).
 *
 * A change of section is one step in the history (`select`), so Back returns to the section before. After a change
 * somebody made, the focus goes to the new section's title (without scrolling), a line says which section is on show,
 * and the document's title follows; the page opening on a section moves none of these.
 */
export function Tavola({
  initial,
  timezone,
  mapbox,
  unavailable,
  children,
}: {
  /** The section the route opens on, and what the server renders */
  initial: Section;
  timezone: string;
  mapbox: boolean;
  unavailable?: { asked: string | null };
  /** Meteo, drawn by the server */
  children: ReactNode;
}) {
  const section = useSection(initial);
  const { place } = usePlace();
  // Crea is made on the first visit (the section is read from the address while rendering, as the page opens on it)
  const [seenCrea, setSeenCrea] = useState(initial === "crea");
  if (section === "crea" && !seenCrea) setSeenCrea(true);
  const said = useRef<HTMLParagraphElement>(null);
  const shown = useRef(section);

  useEffect(() => {
    if (shown.current === section) return;
    shown.current = section;
    const label = SECTION_DEFS[section].label;
    document.title = `${label} · ${place.name} · what-weather`;
    if (!store().takeMoved()) return;
    focusTitle(section);
    // Written into the line itself: a screen reader hears it once, as a change of the text
    if (said.current) said.current.textContent = `${label}: ${place.name}`;
  }, [section, place.name]);

  // Inside a transition, where the movement of D4 will hang; the history step itself is made at once
  const select = useCallback((next: Section) => startTransition(() => void store().select(next)), []);
  const crea = section === "crea";

  return (
    <AtmosphereMain className="atmosphere min-h-dvh overflow-x-clip">
      <Sky />
      {/* The city's map, fixed behind the whole screen like the sky; the Testata's reading is where it centres (MapBackdropGL) */}
      <MapBackdropGL className="backdrop-fade pointer-events-none fixed inset-0 -z-1" />
      <MeteoPartsProvider>
        <div data-section="meteo" inert={crea} aria-hidden={crea ? true : undefined}>
          {/* The Testata at its small size on a phone, once the large reading has left the screen */}
          <HeadlineBand />
          {children}
        </div>
      </MeteoPartsProvider>
      {seenCrea && (
        <Activity mode={crea ? "visible" : "hidden"}>
          <div
            data-section="crea"
            className="fixed inset-0 z-[35] overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,var(--sky-1)_0%,var(--sky-2)_55%,var(--sky-3)_100%)]"
          >
            <CreaSection timezone={timezone} mapbox={mapbox} unavailable={unavailable} />
          </div>
        </Activity>
      )}
      <DockMemo current={section} onSelect={select} />
      <p ref={said} aria-live="polite" data-section-said className="sr-only" />
    </AtmosphereMain>
  );
}
