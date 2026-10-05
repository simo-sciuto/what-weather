"use client";

import { useEffect, useState } from "react";
import { getRecordComposition } from "@/lib/record/compose";
import { renderSvg } from "@/lib/record/render-svg";
import { EDGE_RECORDS, SPIKE_RECORDS, type SpikeRecord } from "@/lib/record/fixtures/records";
import type { Measure, RecordScene } from "@/lib/record/types";
import { domMeasure, embeddedFontCss, loadRecordFonts, pageFontCss, svgToPng } from "@/components/record/browser";
import { recordOnMap } from "@/components/record/record-on-map";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
type Mapbox = typeof import("mapbox-gl").default;
const loadMapbox = (): Promise<Mapbox> => import("mapbox-gl").then(({ default: gl }) => gl);

type Source = "map" | "lines";
type Drawn = { key: string; note: string; scene: RecordScene; svg: string } | { key: string; note: string; error: string };

const RECORDS: SpikeRecord[] = [...SPIKE_RECORDS, ...EDGE_RECORDS];
const PREVIEW = { width: 620, height: 877 };

/** One record, over the site's map or over the research's line geography */
async function draw(rec: SpikeRecord, source: Source, measure: Measure, full = false): Promise<{ scene: RecordScene; svg: string }> {
  const fontCss = full ? await embeddedFontCss() : undefined;
  const size = full ? {} : PREVIEW;
  if (source === "map" && TOKEN) return recordOnMap(rec.input, measure, { token: TOKEN, loadMapbox }, { idPrefix: rec.key, fontCss, ...size });
  const scene = getRecordComposition(rec.input, rec.geography, measure);
  return { scene, svg: renderSvg(scene, "swiss-flat", { idPrefix: rec.key, fontCss, ...size }) };
}

/**
 * The spike's bench: the eight test records and the edge cases, each over the site's own map (Mapbox, its colours
 * and layers, read as they are) or over the research's line geography (Natural Earth), side by side; each can be
 * exported at print size through the same SVG-to-PNG path the poster will use.
 */
export function RecordLab() {
  const [source, setSource] = useState<Source>(TOKEN ? "map" : "lines");
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [drawn, setDrawn] = useState<Drawn[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = pageFontCss();
    document.head.append(style);
    let live = true;
    loadRecordFonts().then(() => live && setMeasure(() => domMeasure()));
    return () => {
      live = false;
      style.remove();
    };
  }, []);

  useEffect(() => {
    if (!measure) return;
    let live = true;
    (async () => {
      const out: Drawn[] = [];
      // One map at a time: each is a WebGL context of its own
      for (const rec of RECORDS) {
        try {
          out.push({ key: rec.key, note: rec.note, ...(await draw(rec, source, measure)) });
        } catch (e) {
          out.push({ key: rec.key, note: rec.note, error: e instanceof Error ? e.message : String(e) });
        }
        if (live) setDrawn([...out]);
      }
    })();
    return () => {
      live = false;
    };
  }, [measure, source]);

  async function exportPng(key: string) {
    const rec = RECORDS.find((r) => r.key === key);
    if (!rec || !measure) return;
    setBusy(key);
    try {
      const { scene, svg } = await draw(rec, source, measure, true);
      const blob = await svgToPng(svg, scene.canvas.width, scene.canvas.height);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `what-weather-record-${key}-${source}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#d9d6cf] p-6 text-[#1d1d1b]">
      <h1 className="mb-1 text-xl font-semibold">Visual Record, spike V3.1</h1>
      <p className="mb-4 text-sm">Motore tipografico della ricerca (typeVisualState), Swiss Flat, Archivo + IBM Plex Mono.</p>
      <div className="mb-6 flex gap-2 text-xs" role="group" aria-label="Mappa">
        {(["map", "lines"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={source === s}
            disabled={s === "map" && !TOKEN}
            onClick={() => setSource(s)}
            className="rounded border border-current px-2 py-1 aria-pressed:bg-[#1d1d1b] aria-pressed:text-[#d9d6cf] disabled:opacity-40"
          >
            {s === "map" ? "Mappa del sito (Mapbox)" : "Linee della ricerca (Natural Earth)"}
          </button>
        ))}
        {!TOKEN && <span className="self-center">Senza NEXT_PUBLIC_MAPBOX_TOKEN solo le linee.</span>}
      </div>
      {!measure ? (
        <p>Carico i font…</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {drawn.map((d) => (
            <li key={d.key} className="flex flex-col gap-2">
              {"error" in d ? (
                <p className="text-xs text-red-800">
                  {d.key}: {d.error}
                </p>
              ) : (
                <>
                  <div role="img" aria-label={`Record ${d.key}`} className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: d.svg }} />
                  <p className="text-xs">
                    <strong>{d.key}</strong> · {d.note} · {d.scene.metadata.mode} · {d.scene.metadata.interplay}
                  </p>
                  <p className="text-xs italic">{d.scene.metadata.visualThesis}</p>
                  <button type="button" className="self-start rounded border border-current px-2 py-1 text-xs" onClick={() => exportPng(d.key)} disabled={busy === d.key}>
                    {busy === d.key ? "Esporto…" : "Esporta PNG 2480×3508"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
