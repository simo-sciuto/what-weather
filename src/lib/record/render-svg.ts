import { BRAND_FAMILY, DISPLAY_FAMILY, MONO_FAMILY } from "./fonts";
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
    const family = f.family === "display" ? DISPLAY_FAMILY : f.family === "brand" ? BRAND_FAMILY : MONO_FAMILY;
    const variation = f.family === "display" ? `font-variation-settings:'wght' ${f.wght};` : "";
    return `font-family="${family}" font-size="${n(f.size * W)}" style="font-weight:${f.wght};${variation}letter-spacing:${n(f.tracking * f.size * W)}px;font-kerning:normal"`;
  };

  const transformOf = (l: SceneLayer) =>
    l.transform ? ` transform="rotate(${l.transform.rotate} ${n(l.transform.origin[0] * W)} ${n(l.transform.origin[1] * H)})"` : "";

  const textOf = (l: SceneLayer, fill: string, withHalo = true) => {
    if (l.payload.kind !== "text") return "";
    const p = l.payload;
    const fill_ = p.stroke ? ` stroke="${fill}" stroke-width="${n(p.stroke * p.font.size * W)}" stroke-linejoin="round"` : "";
    const halo =
      withHalo && p.halo
        ? ` stroke="${scene.inks[p.halo]}" stroke-width="${n(p.font.size * W * 0.32)}" stroke-linejoin="round" paint-order="stroke"`
        : "";
    return p.lines
      .map(
        (line) =>
          `<text x="${n(line.x * W)}" y="${n(line.y * H)}" ${fontAttrs(p.font)} text-anchor="${p.anchor}" fill="${fill}"${fill_}${halo}${transformOf(l)}>${esc(line.text)}</text>`,
      )
      .join("");
  };

  const byId = new Map(scene.layers.map((l) => [l.id, l]));

  const body = scene.layers.map((l) => {
    let inner = "";
    const p = l.payload;
    if (p.kind === "rect")
      inner = `<rect x="${n(p.x * W)}" y="${n(p.y * H)}" width="${n(p.width * W)}" height="${n(p.height * H)}" fill="${ink(l)}"/>`;
    else if (p.kind === "text") inner = textOf(l, ink(l));
    else if (p.kind === "shade") {
      const gid = id(`shade-${l.id}`);
      defs.push(
        `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ink(l)}" stop-opacity="${p.from}"/><stop offset="1" stop-color="${ink(l)}" stop-opacity="${p.to}"/></linearGradient>`,
      );
      inner = `<rect x="${n(p.x * W)}" y="${n(p.y * H)}" width="${n(p.width * W)}" height="${n(p.height * H)}" fill="url(#${gid})"/>`;
    } else if (p.kind === "image") {
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
          : p.shape === "ring"
            ? `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${ink(l)}" stroke-width="${n(r * 0.32)}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.34)}" fill="${ink(l)}"/>`
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
    // A hole: the edges of what lies around it cast a soft shadow inside, from the top left
    if (l.inset) {
      const fid = id(`hole-${l.id}`);
      // Two shadows: a soft one close to the edge, and a broad, deep one: the hole reads deep, its edge gentle
      const shadow = (inn: string, blur: number, off: number, opacity: number, out: string) =>
        `<feGaussianBlur in="${inn}" stdDeviation="${n(blur * W)}" result="${out}-b"/>` +
        `<feOffset in="${out}-b" dx="${n(off * W)}" dy="${n(off * W)}" result="${out}-o"/>` +
        `<feFlood flood-color="#000" flood-opacity="${opacity}"/>` +
        `<feComposite in2="${out}-o" operator="in" result="${out}-c"/>` +
        `<feComposite in="${out}-c" in2="SourceAlpha" operator="in" result="${out}"/>`;
      defs.push(
        `<filter id="${fid}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse">` +
          `<feComponentTransfer in="SourceAlpha" result="outside"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>` +
          shadow("outside", 0.0025, 0.003, 0.35, "edge") +
          shadow("outside", 0.012, 0.01, 0.45, "depth") +
          // The glow: light from under the map coming up through the hole, a thin halo at its edge
          (l.glow
            ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${n(0.005 * W)}" result="halo-b"/>` +
              `<feComponentTransfer in="halo-b" result="halo"><feFuncA type="linear" slope="0.22"/></feComponentTransfer>`
            : "") +
          `<feMerge>${l.glow ? `<feMergeNode in="halo"/>` : ""}<feMergeNode in="SourceGraphic"/><feMergeNode in="depth"/><feMergeNode in="edge"/></feMerge></filter>`,
      );
      inner = `<g filter="url(#${fid})">${inner}</g>`;
    }
    return `<g data-layer="${l.id}" data-role="${l.role}"${l.opacity < 1 ? ` opacity="${l.opacity.toFixed(3)}"` : ""}>${inner}</g>`;
  });

  const fonts = o.fontCss ? `<style>${o.fontCss}</style>` : "";
  const title = o.title ? `<title>${esc(o.title)}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" text-rendering="geometricPrecision">${title}<defs>${fonts}${defs.join("")}</defs>${body.join("")}</svg>`;
}
