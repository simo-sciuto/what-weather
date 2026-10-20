import { FIELD_OPACITY, FIELD_TINT_OPACITY } from "@/constants/atlas";
import type { PointSky } from "@/types/atlas";
import { hexToRgb } from "@/utils/color";
import { contrastRatio, MUTED_INK_ALPHA } from "./palette";

type RGB = [number, number, number];

/**
 * The interface's colours, as the CSS custom properties the Atlas reads (DESIGN_SYSTEM.md, WTH-342): the sky the
 * engine made for the point on show, and the surfaces and the scrim the interface lies on, measured against what is
 * really under them. Over the Atlas that is not the sky but the weather field, bright by day, and the map's own inks
 * tinted by it (ADR-026): a veil that reads over the sky may not read over a warm, sunny field (WTH-277).
 *
 * One writer for the variables, so the sky, the glass and the surfaces change together (WTH-262).
 */
export type UiTokens = Readonly<
  Record<
    | "--sky-1"
    | "--sky-2"
    | "--sky-3"
    | "--glass"
    | "--glow"
    | "--sun"
    | "--cloud"
    | "--ink-muted"
    | "--surface-1"
    | "--surface-2"
    | "--scrim"
    | "--accent"
    | "--on-accent",
    string
  >
>;

/** Muted text over a control: WCAG AA for small text */
export const SURFACE_1_CONTRAST = 4.5;
/** Muted text over a sheet or panel, where text runs long: AAA */
export const SURFACE_2_CONTRAST = 7;
/** Text on an accent fill (the active "Adesso"): a deep ink of the night sky, not black */
const ON_ACCENT = "#10142a";

const WHITE: RGB = [255, 255, 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

/** `#rrggbb` or the engine's `rgb(r g b / a)`, as its three channels; anything else is not a colour here */
export function parseColor(value: string): RGB | null {
  if (/^#[0-9a-f]{6}$/i.test(value)) return hexToRgb(value);
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const luminance = (c: RGB) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

const lightest = (colours: RGB[]) => colours.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));

/**
 * The lightest ground the interface may lie on: the sky's three stops, the field over the sky as Mapbox draws it
 * (under the lines), and the lightest ink of the map tinted by the field (over the lines). Only the lightest field
 * colour and the lightest ink count: light ink reads worst over the lightest ground.
 */
/** How strong the field is drawn under the map's lines and over them: the layer on show sets it (WTH-346) */
export type FieldStrength = { field: number; tint: number };
const FULL: FieldStrength = { field: FIELD_OPACITY, tint: FIELD_TINT_OPACITY };

export function worstBackdrop(sky: PointSky, fieldColors: readonly string[], inkColors: readonly string[], strength: FieldStrength = FULL): RGB {
  const skies = [sky.sky1, sky.sky2, sky.sky3].map(parseColor).filter((c): c is RGB => c !== null);
  const field = fieldColors.map(parseColor).filter((c): c is RGB => c !== null);
  const inks = inkColors.map(parseColor).filter((c): c is RGB => c !== null);
  const grounds = [...skies];
  if (field.length) {
    const brightField = lightest(field);
    const under = mix(skies[1] ?? skies[0], brightField, strength.field);
    grounds.push(under);
    if (inks.length) grounds.push(mix(lightest(inks), brightField, strength.tint));
  } else if (inks.length) grounds.push(lightest(inks));
  return lightest(grounds);
}

/**
 * The thinnest veil of `veil` over `ground` under which muted text keeps `target`: the alpha rises in hundredths until
 * it does, with no ceiling, so a ground no veil can tame ends opaque rather than unreadable.
 */
export function thinnestVeil(ground: RGB, veil: RGB, target: number, from = 0.3): number {
  for (let a = Math.round(from * 100); a <= 100; a++) {
    const surface = mix(ground, veil, a / 100);
    if (contrastRatio(mix(surface, WHITE, MUTED_INK_ALPHA), surface) >= target) return a / 100;
  }
  return 1;
}

const rgba = ([r, g, b]: RGB, a: number) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a.toFixed(2)})`;

/**
 * The tokens for a sky over a field. `fieldColors` are the colours of the places in view (`WeatherField.colors`), empty
 * before the first field arrives; `inkColors` the map's line colours on show.
 */
export function uiTokens(sky: PointSky, fieldColors: readonly string[] = [], inkColors: readonly string[] = [], strength: FieldStrength = FULL): UiTokens {
  const ground = worstBackdrop(sky, fieldColors, inkColors, strength);
  // The engine's glass is the deepened hue of the top of the sky: the veil every surface is made of
  const veil = parseColor(sky.glass) ?? [12, 15, 37];
  const sky1 = parseColor(sky.sky1) ?? veil;
  return {
    "--sky-1": sky.sky1,
    "--sky-2": sky.sky2,
    "--sky-3": sky.sky3,
    "--glass": sky.glass,
    "--glow": sky.glow,
    "--sun": sky.sun,
    "--cloud": sky.cloud,
    "--ink-muted": `rgb(255 255 255 / ${MUTED_INK_ALPHA})`,
    "--surface-1": rgba(veil, thinnestVeil(ground, veil, SURFACE_1_CONTRAST)),
    "--surface-2": rgba(veil, thinnestVeil(ground, veil, SURFACE_2_CONTRAST, 0.6)),
    // Behind the reading, which lies on the map with no panel: the sky's own top, as thick as muted text needs
    "--scrim": rgba(sky1, thinnestVeil(ground, sky1, SURFACE_1_CONTRAST)),
    "--accent": sky.sun,
    "--on-accent": ON_ACCENT,
  };
}
