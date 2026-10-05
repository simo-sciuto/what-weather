/**
 * Runs in Chromium (see export-sheet.mjs): composes every spike record with the browser's own type measure,
 * renders each to SVG, exports it to PNG through the same path the app will use, and lays out the contact sheets.
 */
import { getRecordComposition } from "@/lib/record/compose";
import { renderSvg } from "@/lib/record/render-svg";
import { EDGE_RECORDS, SPIKE_RECORDS } from "@/lib/record/fixtures/records";
import { domMeasure, embeddedFontCss, loadRecordFonts, pageFontCss, svgToPng } from "@/components/record/browser";

const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(b);
  });

async function sheet(images: HTMLImageElement[], width: number, cols: number, gap: number, paper: string) {
  const h = Math.round((width * 3508) / 2480);
  const rows = Math.ceil(images.length / cols);
  const c = document.createElement("canvas");
  c.width = cols * width + (cols + 1) * gap;
  c.height = rows * h + (rows + 1) * gap;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  images.forEach((img, i) => ctx.drawImage(img, gap + (i % cols) * (width + gap), gap + Math.floor(i / cols) * (h + gap), width, h));
  return toDataUrl(await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png")));
}

async function run(which: "spike" | "all") {
  const style = document.createElement("style");
  style.textContent = pageFontCss("/fonts/record");
  document.head.append(style);
  await loadRecordFonts();
  const measure = domMeasure();
  const fontCss = await embeddedFontCss("/fonts/record");
  const records = which === "all" ? [...SPIKE_RECORDS, ...EDGE_RECORDS] : SPIKE_RECORDS;
  const out: { key: string; png: string; meta: unknown }[] = [];
  const images: HTMLImageElement[] = [];
  for (const rec of records) {
    const t0 = performance.now();
    const scene = getRecordComposition(rec.input, rec.geography, measure);
    const svg = renderSvg(scene, "swiss-flat", { fontCss, title: scene.metadata.recordId });
    const blob = await svgToPng(svg, scene.canvas.width, scene.canvas.height);
    const png = await toDataUrl(blob);
    const img = new Image();
    img.src = png;
    await img.decode();
    images.push(img);
    out.push({ key: rec.key, png, meta: { ...scene.metadata, ms: Math.round(performance.now() - t0), svgKb: Math.round(svg.length / 1024) } });
  }
  const contact = await sheet(images.slice(0, 8), 560, 4, 40, "#d9d6cf");
  const thumbs = await sheet(images.slice(0, 8), 120, 8, 16, "#d9d6cf");
  const edges = images.length > 8 ? await sheet(images.slice(8), 560, images.length - 8, 40, "#d9d6cf") : null;
  // The first record's foot at 100%, to judge the micro type at its printed size
  const c = document.createElement("canvas");
  [c.width, c.height] = [2480, 640];
  c.getContext("2d")!.drawImage(images[0], 0, 3508 - 640, 2480, 640, 0, 0, 2480, 640);
  const foot = await toDataUrl(await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png")));
  return { out, contact, thumbs, edges, foot };
}

(window as unknown as { runRecords: typeof run }).runRecords = run;
