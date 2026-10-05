"use client";

import { useEffect, useState } from "react";
import { getRecordComposition } from "@/lib/record/compose";
import { renderSvg } from "@/lib/record/render-svg";
import { EDGE_RECORDS, SPIKE_RECORDS } from "@/lib/record/fixtures/records";
import type { RecordScene } from "@/lib/record/types";
import { domMeasure, embeddedFontCss, loadRecordFonts, pageFontCss, svgToPng } from "../record/browser";

type Drawn = { key: string; note: string; scene: RecordScene; svg: string };

/**
 * The spike's bench: the eight test records and the edge cases composed with the browser's own type, shown
 * side by side; each can be exported at print size through the same SVG-to-PNG path the poster will use.
 */
export function RecordLab() {
  const [drawn, setDrawn] = useState<Drawn[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const style = document.createElement("style");
    style.textContent = pageFontCss();
    document.head.append(style);
    loadRecordFonts().then(() => {
      if (!live) return;
      const measure = domMeasure();
      setDrawn(
        [...SPIKE_RECORDS, ...EDGE_RECORDS].map((r) => {
          const scene = getRecordComposition(r.input, r.geography, measure);
          return { key: r.key, note: r.note, scene, svg: renderSvg(scene, "swiss-flat", { idPrefix: r.key, width: 620, height: 877 }) };
        }),
      );
    });
    return () => {
      live = false;
      style.remove();
    };
  }, []);

  async function exportPng(d: Drawn) {
    setBusy(d.key);
    try {
      const svg = renderSvg(d.scene, "swiss-flat", { fontCss: await embeddedFontCss(), idPrefix: d.key });
      const blob = await svgToPng(svg, d.scene.canvas.width, d.scene.canvas.height);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `what-weather-record-${d.key}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#d9d6cf] p-6 text-[#1d1d1b]">
      <h1 className="mb-1 text-xl font-semibold">Visual Record, spike V3.1</h1>
      <p className="mb-6 text-sm">Swiss Flat, Archivo + IBM Plex Mono, geografia Natural Earth. Composizione pura, nessuna mappa Mapbox.</p>
      {!drawn ? (
        <p>Carico i font…</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {drawn.map((d) => (
            <li key={d.key} className="flex flex-col gap-2">
              <div className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: d.svg }} />
              <p className="text-xs">
                <strong>{d.key}</strong> · {d.note} · {d.scene.metadata.mode} · {d.scene.metadata.interplay}
              </p>
              <p className="text-xs italic">{d.scene.metadata.visualThesis}</p>
              <button
                type="button"
                className="self-start rounded border border-current px-2 py-1 text-xs"
                onClick={() => exportPng(d)}
                disabled={busy === d.key}
              >
                {busy === d.key ? "Esporto…" : "Esporta PNG 2480×3508"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
