"use client";

import { fetchSummary } from "@/lib/api/summary";
import type { KeptRecord } from "@/lib/keep/kept-record";
import { keptHref, keptList } from "@/lib/keep/kept-view";
import { formatTemp, formatTime } from "@/lib/weather/formatters";
import { momentDay } from "@/lib/weather/moment-label";
import type { PlaceSummary } from "@/types/place";
import Link from "next/link";
import { useEffect, useState } from "react";
import { scrollToStation } from "../bar/useActiveStation";
import { stationTitleId } from "../bar/stations";
import { useKept } from "../keep/useKept";
import { useHydrated } from "../useHydrated";

const keyOf = (r: KeptRecord) => `${r.place.lat.toFixed(2)},${r.place.lon.toFixed(2)}`;

/** The zone a record's hour is written in: the device's, because a record remembers the instant and the place but not the place's zone */
const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

/**
 * The KEEP station's content: the records kept on this device, one row of 72 px each, the newest three and the
 * rest in a list that opens in place. A record of Adesso shows the place's temperature now; a record of an hour shows
 * the hour (on the device's clock, said so) and no figure, since the figure of that hour is not kept. Each row opens
 * the place again, at its hour, and can be removed.
 */
export function KeepPanel() {
  const hydrated = useHydrated();
  const { records, remove } = useKept();
  const [all, setAll] = useState(false);
  // What removing a record did, in words: the row is gone, and with it the button that had the focus
  const [said, setSaid] = useState("");
  const [summaries, setSummaries] = useState<Record<string, PlaceSummary | null>>({});

  useEffect(() => {
    let alive = true;
    for (const r of records) {
      if (r.t !== null) continue;
      fetchSummary(r.place).then((s) => {
        if (alive) setSummaries((prev) => (prev[keyOf(r)] === s ? prev : { ...prev, [keyOf(r)]: s }));
      });
    }
    return () => {
      alive = false;
    };
  }, [records]);

  // The records are in the browser: until it has been asked, say nothing rather than "nothing kept"
  if (!hydrated) return <div data-keep-panel aria-busy="true" className="min-h-[4.5rem]" />;

  if (records.length === 0) {
    return (
      <div data-keep-panel className="flex flex-col items-start gap-3">
        <p className="text-body text-ink">Qui compaiono i record che crei. Restano su questo dispositivo.</p>
        <a
          href="#crea"
          onClick={(e) => {
            e.preventDefault();
            scrollToStation("crea");
          }}
          className="text-body text-ink underline decoration-accent decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          Crea il primo
        </a>
      </div>
    );
  }

  const list = keptList(records);
  const zone = deviceZone();
  const row = (r: KeptRecord) => {
    const s = r.t === null ? summaries[keyOf(r)] : undefined;
    return (
      <li key={r.id} className="flex min-h-[4.5rem] items-center gap-4 border-t border-white/25 py-2">
        {r.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small data URL kept on the device, nothing for next/image to optimise
          <img src={r.thumb} alt="" className="h-14 w-10 shrink-0 rounded-[2px] border border-white/40 object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] font-semibold leading-tight tracking-[-0.01em]">{r.place.name}</p>
          <p className="mt-0.5 text-caption tabular-nums text-ink-muted">
            {r.t === null ? "Adesso" : `${momentDay(r.t, zone)}, ${formatTime(r.t, zone)}, ora del tuo dispositivo`}
            {s && <span className="text-ink"> · {formatTemp(s.temp)}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-caption">
          <Link href={keptHref(r)} className="flex h-11 items-center px-2 text-ink underline decoration-white/35 underline-offset-4 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-accent">
            Rileggi qui<span className="sr-only">: {r.place.name}</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              const done = remove(r.id);
              setSaid(done ? `${r.place.name} tolto da Conserva.` : "Questo dispositivo non lascia salvare.");
              // The focus would fall to the page: it goes to the station's heading
              document.getElementById(stationTitleId("conserva"))?.focus({ preventScroll: true });
            }}
            className="flex h-11 items-center px-2 text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            Togli<span className="sr-only">: {r.place.name}</span>
          </button>
        </div>
      </li>
    );
  };

  return (
    <div data-keep-panel className="flex flex-col gap-3">
      <ul aria-label="Record conservati" className="border-b border-white/25">
        {list.latest.map(row)}
        {all && list.rest.map(row)}
      </ul>
      {list.rest.length > 0 && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="self-start text-body text-ink underline decoration-accent decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {all ? "Solo gli ultimi tre" : `Tutti i record (${list.total})`}
        </button>
      )}
      <p className="text-caption text-ink-muted">I record restano su questo dispositivo.</p>
      <p aria-live="polite" data-keep-said className="sr-only">
        {said}
      </p>
    </div>
  );
}
