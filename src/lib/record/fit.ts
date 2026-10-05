import { clampAxes } from "./type-system";
import type { FontRef, Measure } from "./types";

export type FitStep = "preferred" | "width" | "wrap" | "size" | "long-name";

export type Fitted = {
  lines: string[];
  font: FontRef;
  /** The widest line, fraction of the sheet's width */
  width: number;
  step: FitStep;
};

export type FitOptions = {
  /** The mode's preferred setting: its size is a ceiling, never stretched to fill the space */
  font: FontRef;
  /** The narrowest width the family allows (the font's real axis, never a CSS squeeze) */
  wdthMin: number;
  maxWidth: number;
  minSize: number;
  /** Three at most */
  maxLines: number;
  measure: Measure;
};

export const MAX_DISPLAY_LINES = 3;

/** Every way to cut the words into `k` lines in order, the one whose widest line is narrowest */
function bestSplit(words: string[], k: number, font: FontRef, measure: Measure) {
  let best: { lines: string[]; width: number } | null = null;
  const cut = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const lines = [...acc, words.slice(start).join(" ")];
      const width = Math.max(...lines.map((l) => measure(l, font)));
      if (!best || width < best.width - 1e-9) best = { lines, width };
      return;
    }
    for (let end = start + 1; end <= words.length - left + 1; end++)
      cut(end, left - 1, [...acc, words.slice(start, end).join(" ")]);
  };
  cut(0, k, []);
  return best as { lines: string[]; width: number } | null;
}

function widths(from: number, to: number): number[] {
  const out: number[] = [];
  for (let w = from; w > to; w -= 4) out.push(w);
  out.push(to);
  return out;
}

/**
 * Sets a place's name, in this order: the mode's preferred setting; the real width axis down to the family's
 * narrowest; whole words on up to three lines; a smaller size down to the mode's floor; then the long-name
 * setting (narrowest, three lines, scaled to the measure). Never truncated, never an ellipsis.
 */
export function fitPlace(name: string, o: FitOptions): Fitted {
  const words = name.trim().split(/\s+/);
  const maxLines = Math.min(o.maxLines, MAX_DISPLAY_LINES, words.length);
  const at = (patch: Partial<FontRef>) => clampAxes({ ...o.font, ...patch });

  // 1-2: one line, the preferred width then narrower
  for (const wdth of widths(o.font.wdth, Math.min(o.wdthMin, o.font.wdth))) {
    const font = at({ wdth });
    const width = o.measure(name, font);
    if (width <= o.maxWidth) return { lines: [name], font, width, step: wdth === o.font.wdth ? "preferred" : "width" };
  }
  // 3: whole words on more lines, from the preferred width down
  for (let k = 2; k <= maxLines; k++)
    for (const wdth of widths(o.font.wdth, Math.min(o.wdthMin, o.font.wdth))) {
      const font = at({ wdth });
      const split = bestSplit(words, k, font, o.measure);
      if (split && split.width <= o.maxWidth) return { ...split, font, step: "wrap" };
    }
  // 4: smaller, at the narrowest width and as many lines as allowed
  const narrow = Math.min(o.wdthMin, o.font.wdth);
  for (let size = o.font.size * 0.95; size >= o.minSize; size *= 0.95) {
    const font = at({ wdth: narrow, size });
    for (let k = 1; k <= maxLines; k++) {
      const split = k === 1 ? { lines: [name], width: o.measure(name, font) } : bestSplit(words, k, font, o.measure);
      if (split && split.width <= o.maxWidth) return { ...split, font, step: "size" };
    }
  }
  // 5: the long-name setting: narrowest, every line it may take, scaled so the widest meets the measure
  const base = at({ wdth: narrow, size: o.minSize });
  const split = bestSplit(words, maxLines, base, o.measure) ?? { lines: [name], width: o.measure(name, base) };
  const size = o.minSize * Math.min(1, o.maxWidth / split.width);
  const font = at({ wdth: narrow, size });
  return { lines: split.lines, font, width: Math.max(...split.lines.map((l) => o.measure(l, font))), step: "long-name" };
}
