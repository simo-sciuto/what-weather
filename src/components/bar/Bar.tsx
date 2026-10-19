"use client";

import { atlasHref } from "@/lib/atlas/links";
import { DEFAULT_KEPT_FORMAT, liveRecordAt, savedPlaceId } from "@/lib/keep/kept-record";
import { createHref } from "@/lib/place";
import Link from "next/link";
import { useState } from "react";
import { useKept } from "../keep/useKept";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";
import { useHydrated } from "../useHydrated";
import { MomentTrack } from "./MomentTrack";
import { STATIONS, type StationId } from "./stations";
import { useActiveStation } from "./useActiveStation";
import { useMomentAddress } from "./useMomentAddress";

const BUTTON =
  "inline-flex h-11 items-center justify-center rounded-[2px] px-5 text-[0.9375rem] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const FILLED = `${BUTTON} bg-accent text-[#101428]`;
const OUTLINED = `${BUTTON} border border-white/70 text-ink`;

/**
 * The Barra (ADR-028), fixed at the foot of the page: where you are (the Percorso, three links to the stations), the
 * Momento (one track, the same moment as everything else) and the Azione (one button, the verb of the station you
 * are at). One row of 72 px on a computer; on a phone two, the Momento above and the Percorso with the Azione below,
 * 104 px and the safe area, within a thumb's reach.
 *
 * Esplora and Crea are plain links for now (to the Atlas and to the poster page): they open in place in later
 * checkpoints. Conserva keeps or removes the place on show as a record of Adesso, on this device. The bar also writes
 * the moment into the address, `t`, once it has been still (see useMomentAddress).
 */
export function Bar({ timezone }: { timezone: string }) {
  const { place } = usePlace();
  const { frame, isLive, selection } = useMoment();
  const { active, goTo } = useActiveStation();
  const { records, keep, remove } = useKept();
  const hydrated = useHydrated();
  // What the last keeping did, said in words for those who do not see the button change
  const [said, setSaid] = useState("");
  useMomentAddress(selection);

  const kept = liveRecordAt(records, place);
  const station = STATIONS.find((s) => s.id === active) ?? STATIONS[0];

  function toggleKept() {
    if (kept) {
      setSaid(remove(kept.id) ? `${place.name} tolto da Conserva.` : "Questo dispositivo non lascia salvare.");
      return;
    }
    const { lat, lon, name, region, country } = place;
    const done = keep({
      id: savedPlaceId(place),
      place: { lat, lon, name, ...(region ? { region } : {}), ...(country ? { country } : {}) },
      t: null,
      format: DEFAULT_KEPT_FORMAT,
      createdAt: Math.floor(Date.now() / 1000),
    });
    setSaid(done ? `${name} conservato.` : "Questo dispositivo non lascia salvare.");
  }

  const action = (id: StationId) => {
    if (id === "esplora")
      return (
        <Link href={atlasHref(place)} data-bar-action="esplora" className={FILLED}>
          <span className="lg:hidden">Esplora</span>
          <span className="max-lg:hidden">Esplora la mappa</span>
        </Link>
      );
    if (id === "crea")
      return (
        <Link href={createHref(place, isLive ? undefined : frame.time)} data-bar-action="crea" className={FILLED}>
          Crea
        </Link>
      );
    return (
      <button
        type="button"
        onClick={toggleKept}
        aria-pressed={Boolean(kept)}
        data-bar-action="conserva"
        className={kept ? OUTLINED : FILLED}
      >
        {kept ? "Conservato" : "Conserva"}
      </button>
    );
  };

  return (
    <div
      data-bar
      data-ready={hydrated ? "true" : "false"}
      className="arrive-bar bar-surface fixed inset-x-0 bottom-0 z-40 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] pb-[env(safe-area-inset-bottom)] text-ink"
    >
      <div className="mx-auto grid max-w-[88rem] grid-cols-[minmax(0,1fr)_auto] grid-rows-[3.75rem_2.75rem] px-5 [grid-template-areas:'moment_moment'_'path_action'] sm:px-8 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-rows-[4.5rem] lg:gap-x-10 lg:px-12 lg:[grid-template-areas:'path_moment_action']">
        <nav aria-label="Percorso" className="[grid-area:path]">
          <ol className="flex h-full gap-1 lg:gap-7">
            {STATIONS.map((s) => (
              <li key={s.id} className="flex">
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "location" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(s.id);
                  }}
                  className="group relative flex min-w-11 items-center justify-center text-[0.9375rem] tabular-nums opacity-75 transition-opacity duration-[360ms] ease-[cubic-bezier(.2,.7,.2,1)] aria-[current=location]:font-extrabold aria-[current=location]:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent font-semibold"
                >
                  {/* The line of the station you are at draws itself from the left */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-accent transition-transform duration-[360ms] ease-[cubic-bezier(.2,.7,.2,1)] group-aria-[current=location]:scale-x-100"
                  />
                  <span aria-hidden="true" className="lg:hidden">
                    {s.number}
                  </span>
                  <span className="sr-only lg:not-sr-only">{s.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 [grid-area:moment]">
          <MomentTrack timezone={timezone} />
        </div>
        <div className="flex items-center justify-end [grid-area:action]">{action(station.id)}</div>
      </div>
      <p aria-live="polite" data-bar-said className="sr-only">
        {said}
      </p>
    </div>
  );
}
