import { DISPLAY_FAMILY, MONO_FAMILY } from "./fonts";
import type { FontRef, Point, RecordScene, SceneLayer } from "./types";

/**
 * SWISS FLAT, the one render style for now: flat inks, crisp type and lines, no gradient, no texture. The scene
 * becomes an SVG; the page shows it as it is, the export draws it onto a canvas. A future style is another
 * function over the same scene.
 */
export type RenderStyle = "swiss-flat";

export type SvgOptions = {
  /** @font-face rules to carry inside the SVG (an exported image cannot reach the page's fonts) */
  fontCss?: string;
  /** Prefix for the SVG's ids, so several records can share a page */
  idPrefix?: string;
  /** Pictures for the scene's image layers, by key (data or object URLs) */
  images?: Record<string, string>;
  /** Pixel size; the scene's own canvas when absent */
  width?: number;
  height?: number;
  title?: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => (Math.round(v * 10) / 10).toString();

export function renderSvg(scene: RecordScene, style: RenderStyle = "swiss-flat", o: SvgOptions = {}): string {
  if (style !== "swiss-flat") throw new Error(`Unknown render style: ${style}`);
  const W = o.width ?? scene.canvas.width;
  const H = o.height ?? scene.canvas.height;
  const id = (s: string) => `${o.idPrefix ?? "r"}-${s}`;
  const px = ([x, y]: Point) => `${n(x * W)},${n(y * H)}`;
  const ink = (l: SceneLayer) => scene.inks[l.inkRole];
  const defs: string[] = [];

  const fontAttrs = (f: FontRef) => {
    const family = f.family === "display" ? DISPLAY_FAMILY : MONO_FAMILY;
    const variation = f.family === "display" ? `font-variation-settings:'wght' ${f.wght},'wdth' ${f.wdth};font-stretch:${f.wdth}%;` : "";
    return `font-family="${family}" font-size="${n(f.size * W)}" style="font-weight:${f.wght};${variation}letter-spacing:${n(f.tracking * f.size * W)}px;font-kerning:normal"`;
  };

  const transformOf = (l: SceneLayer) =>
    l.transform ? ` transform="rotate(${l.transform.rotate} ${n(l.transform.origin[0] * W)} ${n(l.transform.origin[1] * H)})"` : "";

  const textOf = (l: SceneLayer, fill: string, withHalo = true) => {
    if (l.payload.kind !== "text") return "";
    const p = l.payload;
    const halo =
      withHalo && p.halo
        ? ` stroke="${scene.inks[p.halo]}" stroke-width="${n(p.font.size * W * 0.32)}" stroke-linejoin="round" paint-order="stroke"`
        : "";
    return p.lines
      .map(
        (line) =>
          `<text x="${n(line.x * W)}" y="${n(line.y * H)}" ${fontAttrs(p.font)} text-anchor="${p.anchor}" fill="${fill}"${halo}${transformOf(l)}>${esc(line.text)}</text>`,
      )
      .join("");
  };

  const byId = new Map(scene.layers.map((l) => [l.id, l]));

  // The screenprint (WTH-187): ink that spreads a little at the edges, lies thicker in places and thinner in others
  // as a squeegee leaves it, and stays off where the mesh did not carry it. Sizes are in print pixels, scaled to
  // this resolution, so a preview and the PNG print the same.
  const print = scene.metadata.print;
  const grainId = print && print.grain > 0 ? id("ink") : null;
  if (print && grainId) {
    const k = W / 2480;
    const steps = 20;
    const bare = Math.max(1, Math.round(print.grain * steps));
    const speckle = Array.from({ length: steps }, (_, i) => (i >= steps - bare ? 0 : 1)).join(" ");
    const seed = scene.metadata.seed % 997;
    defs.push(
      `<filter id="${grainId}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
        // Edges that spread: the letters pushed about by a slow noise, a couple of pixels
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.035 / k).toFixed(4)}" numOctaves="2" seed="${seed}" result="warp"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="warp" scale="${n(5 * k)}" xChannelSelector="R" yChannelSelector="G" result="spread"/>` +
        // The squeegee: broad patches of more and less ink, between 72% and 100%
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.004 / k).toFixed(4)}" numOctaves="3" seed="${seed + 1}" result="cloud"/>` +
        `<feColorMatrix in="cloud" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.75 0 0 0 0.45" result="density"/>` +
        // The mesh: a fine speckle left bare
        `<feTurbulence type="fractalNoise" baseFrequency="${(0.7 / k).toFixed(4)}" numOctaves="1" seed="${seed + 2}" result="noise"/>` +
        `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -0.6" result="field"/>` +
        `<feComponentTransfer in="field" result="mesh"><feFuncA type="discrete" tableValues="${speckle}"/></feComponentTransfer>` +
        `<feComposite in="spread" in2="density" operator="in" result="inked"/>` +
        `<feComposite in="inked" in2="mesh" operator="in"/></filter>`,
    );
  }

  const body = scene.layers.map((l) => {
    let inner = "";
    const p = l.payload;
    if (p.kind === "rect")
      inner = `<rect x="${n(p.x * W)}" y="${n(p.y * H)}" width="${n(p.width * W)}" height="${n(p.height * H)}" fill="${ink(l)}"/>`;
    else if (p.kind === "text") inner = textOf(l, ink(l));
    else if (p.kind === "image") {
      const href = o.images?.[p.key];
      inner = href
        ? `<image href="${esc(href)}" x="${n(p.x * W)}" y="${n(p.y * H)}" width="${n(p.width * W)}" height="${n(p.height * H)}" preserveAspectRatio="none"/>`
        : "";
    }
    else if (p.kind === "paths") {
      const d = p.paths.map((pts) => `M${pts.map(px).join("L")}${p.closed ? "Z" : ""}`).join("");
      inner = p.stroke
        ? `<path d="${d}" fill="none" stroke="${ink(l)}" stroke-width="${n(p.stroke * W)}" stroke-linejoin="round" stroke-linecap="round"${p.dash ? ` stroke-dasharray="${p.dash.map((v) => n(v * W)).join(" ")}"` : ""}/>`
        : `<path d="${d}" fill="${ink(l)}" fill-rule="evenodd"/>`;
    } else {
      const [cx, cy] = [p.at[0] * W, p.at[1] * H];
      const r = p.r * W;
      const line = Math.max(1, 0.0013 * W);
      const leader = p.leader
        ? `<line x1="${n(p.leader[0][0] * W)}" y1="${n(p.leader[0][1] * H)}" x2="${n(cx)}" y2="${n(cy)}" stroke="${ink(l)}" stroke-width="${n(line)}"/>`
        : "";
      const mark =
        p.shape === "dot"
          ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${ink(l)}"/>`
          : p.shape === "triangle"
            ? `<path d="M${n(cx)},${n(cy - r)}L${n(cx + r)},${n(cy + r * 0.67)}H${n(cx - r)}Z" fill="${ink(l)}"/>`
            : `<path d="M${n(cx - r)},${n(cy)}H${n(cx + r)}M${n(cx)},${n(cy - r)}V${n(cy + r)}" stroke="${ink(l)}" stroke-width="${n(line * 1.4)}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.42)}" fill="none" stroke="${ink(l)}" stroke-width="${n(line)}"/>`;
      const label = p.label
        ? `<text x="${n(p.label.at[0] * W)}" y="${n(p.label.at[1] * H)}" ${fontAttrs({ family: "mono", wght: 400, wdth: 100, size: 0.0125, tracking: 0.06 })} text-anchor="${p.label.anchor}" fill="${ink(l)}" opacity="0.7">${esc(p.label.text)}</text>`
        : "";
      inner = leader + mark + label;
    }

    // Clipping: a rectangle, and the letters of another layer, nested so both cut
    if (l.clip?.glyphsOf) {
      const targets = l.clip.glyphsOf.map((g) => byId.get(g)).filter((t): t is SceneLayer => !!t);
      const cid = id(`glyphs-${l.id}`);
      if (targets.length) {
        defs.push(`<clipPath id="${cid}">${targets.map((t) => textOf(t, "#000", false)).join("")}</clipPath>`);
        inner = `<g clip-path="url(#${cid})">${inner}</g>`;
      }
    }
    if (l.clip?.rect) {
      const r = l.clip.rect;
      const cid = id(`rect-${l.id}`);
      defs.push(`<clipPath id="${cid}"><rect x="${n(r.x * W)}" y="${n(r.y * H)}" width="${n(r.width * W)}" height="${n(r.height * H)}"/></clipPath>`);
      inner = `<g clip-path="url(#${cid})">${inner}</g>`;
    }
    // The screen's grain: the ink left out where the mesh did not carry it
    if (l.grain && grainId) inner = `<g filter="url(#${grainId})">${inner}</g>`;
    const blend = l.blend && l.blend !== "normal" ? ` style="mix-blend-mode:${l.blend}"` : "";
    return `<g data-layer="${l.id}" data-role="${l.role}"${blend}${l.opacity < 1 ? ` opacity="${l.opacity.toFixed(3)}"` : ""}>${inner}</g>`;
  });

  const fonts = o.fontCss ? `<style>${o.fontCss}</style>` : "";
  const title = o.title ? `<title>${esc(o.title)}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" text-rendering="geometricPrecision">${title}<defs>${fonts}${defs.join("")}</defs>${body.join("")}</svg>`;
}
