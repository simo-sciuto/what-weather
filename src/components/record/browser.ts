import { DISPLAY_FAMILY, FONT_DIR, MONO_FAMILY, RECORD_FONT_FACES, fontFaceCss } from "@/lib/record/fonts";
import type { FontRef, Measure } from "@/lib/record/types";

/** Reference size the browser measures at; widths scale linearly with the size */
const REF = 1000;

/**
 * The browser's own measure of a line, with the variable axes it will be drawn with (a canvas cannot set `wdth`,
 * so a hidden span does). Cached per text and setting.
 */
export function domMeasure(): Measure {
  const span = document.createElement("span");
  Object.assign(span.style, { position: "absolute", left: "-99999px", top: "0", whiteSpace: "pre", fontSize: `${REF}px`, lineHeight: "1" });
  span.setAttribute("aria-hidden", "true");
  document.body.append(span);
  const cache = new Map<string, number>();
  return (text: string, f: FontRef) => {
    const key = `${f.family}|${f.wght}|${f.wdth}|${f.tracking}|${text}`;
    let w = cache.get(key);
    if (w == null) {
      span.style.fontFamily = `"${f.family === "display" ? DISPLAY_FAMILY : MONO_FAMILY}"`;
      span.style.fontWeight = String(f.wght);
      span.style.fontStretch = `${f.wdth}%`;
      span.style.fontVariationSettings = f.family === "display" ? `'wght' ${f.wght}, 'wdth' ${f.wdth}` : "normal";
      span.style.letterSpacing = `${f.tracking * REF}px`;
      span.textContent = text;
      // The tracking after the last letter is not part of the line
      w = (span.getBoundingClientRect().width - f.tracking * REF) / REF;
      cache.set(key, w);
    }
    return w * f.size;
  };
}

/** Waits for the faces the record sets, at the weights it sets them in */
export async function loadRecordFonts(): Promise<void> {
  await Promise.all(
    [`100 ${DISPLAY_FAMILY}`, `900 ${DISPLAY_FAMILY}`, `400 ${MONO_FAMILY}`, `500 ${MONO_FAMILY}`].map((spec) => {
      const [weight, ...family] = spec.split(" ");
      // One character from each subset, so the Latin Extended file is in before anything is measured
      return document.fonts.load(`${weight} 40px "${family.join(" ")}"`, "AÁ°−0Łș");
    }),
  );
  await document.fonts.ready;
}

/** The page's @font-face rules, from the self-hosted files */
export const pageFontCss = (base = FONT_DIR) => fontFaceCss((file) => `${base}/${file}`);

/** The same rules with every file inlined, for an SVG drawn as an image (it cannot load anything) */
export async function embeddedFontCss(base = FONT_DIR): Promise<string> {
  const data = new Map<string, string>();
  await Promise.all(
    RECORD_FONT_FACES.map(async ({ file }) => {
      const buf = new Uint8Array(await (await fetch(`${base}/${file}`)).arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      data.set(file, `data:font/woff2;base64,${btoa(bin)}`);
    }),
  );
  return fontFaceCss((file) => data.get(file) ?? "");
}

/** The export: the SVG (fonts inside) drawn onto a canvas at its full size, as a PNG */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
