import { describe, expect, it } from "vitest";
import {
  MAP_SEPARATION,
  colorDistance,
  inkOverSky,
  mapInksFor,
  skyPalette,
} from "./palette";
import type { WeatherState } from "./state";

const STATES: WeatherState[] = [
  "CLEAR_DAY",
  "CLEAR_NIGHT",
  "PARTLY_CLOUDY",
  "CLOUDY",
  "FOG",
  "RAIN",
  "HEAVY_RAIN",
  "STORM",
  "SNOW",
];

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(c: number[]) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: number[], b: number[]) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Muted text is white at 86% over the sky (see --ink-muted). */
const muted = (bg: number[]) => bg.map((v) => v + (255 - v) * 0.86);

describe("skyPalette", () => {
  // Every moment of the day, every weather, any cloud cover.
  const cases = STATES.flatMap((state) =>
    [0, 50, 100].flatMap((cloudCover) =>
      Array.from({ length: 61 }, (_, i) => ({
        state,
        cloudCover,
        light: -1 + i * 0.05,
      })),
    ),
  );

  // The same, under no sun at all and under the strongest (a third of the moments: each palette takes a while).
  const sunCases = cases
    .filter((_, i) => i % 3 === 0)
    .flatMap((c) => [0, 11].map((uv) => ({ ...c, uv })));

  it(
    "keeps muted white text at WCAG AA on every part of the sky",
    { timeout: 60_000 },
    () => {
      const failures = [...cases, ...sunCases].flatMap(
        ({ state, cloudCover, light, ...rest }) => {
          const p = skyPalette({ state, cloudCover, light, ...rest });
          return (
            [
              ["sky1", p.sky1, 4.8],
              ["sky2", p.sky2, 4.6],
              ["sky3", p.sky3, 4.5],
            ] as const
          )
            .filter(
              ([, hex, target]) =>
                contrast(muted(rgb(hex)), rgb(hex)) < target - 0.01,
            )
            .map(
              ([name, hex]) =>
                `${state} cover ${cloudCover} light ${light.toFixed(2)} ${name} ${hex}`,
            );
        },
      );
      expect(failures).toEqual([]);
    },
  );

  it(
    "draws the map's roads clearly against the sky at every hour",
    { timeout: 60_000 },
    () => {
      // The share of a line that shows away from the city (MAP_FADE), and the contrast each layer is set to reach
      const fade = 0.5;
      const targets = {
        streets: 1.5,
        "main-roads": 1.9,
        motorways: 2.2,
      } as const;
      const failures = [...cases, ...sunCases].flatMap(
        ({ state, cloudCover, light, ...rest }) => {
          const p = skyPalette({ state, cloudCover, light, ...rest });
          const sky = rgb(p.sky2);
          return Object.entries(targets)
            .filter(([layer, target]) => {
              const { color, opacity } = p.map[layer as keyof typeof targets];
              const seen = sky.map(
                (v, i) => v + (rgb(color)[i] - v) * opacity * fade,
              );
              return contrast(seen, sky) < target - 0.01;
            })
            .map(
              ([layer]) =>
                `${state} cover ${cloudCover} light ${light.toFixed(2)} ${layer}`,
            );
        },
      );
      expect(failures).toEqual([]);
    },
  );

  it(
    "keeps the roads clear against the sky whatever hue and intensity the viewer picks",
    { timeout: 60_000 },
    () => {
      const fade = 0.5;
      const targets = {
        streets: 1.5,
        "main-roads": 1.9,
        motorways: 2.2,
      } as const;
      const failures = cases
        .filter((_, i) => i % 3 === 0)
        .flatMap(({ state, cloudCover, light }) => {
          const p = skyPalette({ state, cloudCover, light });
          const sky = rgb(p.sky2);
          const tunings = [
            { hue: 60, vivid: 50 },
            { hue: 180, vivid: 100 },
            { hue: 300, vivid: 0 },
            { hue: 0, vivid: 100 },
          ];
          return tunings.flatMap(({ hue, vivid }) => {
            const turn = `${hue} vivid ${vivid}`;
            const inks = mapInksFor(p.sky2, { hue, vivid, contrast: 50 });
            return Object.entries(targets)
              .filter(([layer, target]) => {
                const { color, opacity } = inks[layer as keyof typeof targets];
                const seen = sky.map(
                  (v, i) => v + (rgb(color)[i] - v) * opacity * fade,
                );
                return contrast(seen, sky) < target - 0.01;
              })
              .map(
                ([layer]) =>
                  `${state} cover ${cloudCover} light ${light.toFixed(2)} turn ${turn} ${layer}`,
              );
          });
        });
      expect(failures).toEqual([]);
    },
  );

  it(
    "keeps the water, the roads and the buildings plainly apart from one another, at every hour",
    { timeout: 60_000 },
    () => {
      const failures = [...cases, ...sunCases].flatMap(
        ({ state, cloudCover, light, ...rest }) => {
          const p = skyPalette({ state, cloudCover, light, ...rest });
          const over = (layer: keyof typeof p.map) =>
            inkOverSky(p.sky2, p.map[layer]);
          const apart = (a: keyof typeof p.map, b: keyof typeof p.map) =>
            colorDistance(over(a), over(b));
          return (["streets", "main-roads", "motorways"] as const)
            .flatMap(
              (road) =>
                [
                  ["water", road, apart("water", road)],
                  ["buildings", road, apart("buildings", road)],
                  ["buildings-3d", road, apart("buildings-3d", road)],
                ] as const,
            )
            .concat([
              ["buildings", "water", apart("buildings", "water")],
              ["buildings-3d", "water", apart("buildings-3d", "water")],
            ] as never)
            .filter(([, , gap]) => gap < MAP_SEPARATION * 0.65)
            .map(
              ([a, b, gap]) =>
                `${state} cover ${cloudCover} light ${light.toFixed(2)} ${a}/${b} ${gap.toFixed(3)}`,
            );
        },
      );
      expect(failures).toEqual([]);
    },
  );

  it(
    "keeps them apart whatever hue, intensity and contrast the viewer picks, in proportion to how strong a map they asked for",
    { timeout: 120_000 },
    () => {
      const failures = cases
        .filter((_, i) => i % 8 === 0)
        .flatMap(({ state, cloudCover, light }) => {
          const p = skyPalette({ state, cloudCover, light });
          return [0, 90, 180, 270].flatMap((hue) =>
            [25, 60, 100].flatMap((vivid) =>
              [30, 50, 100].flatMap((contrast) => {
                const inks = mapInksFor(p.sky2, { hue, vivid, contrast });
                const over = (layer: keyof typeof inks) =>
                  inkOverSky(p.sky2, inks[layer]);
                const k = contrast <= 50 ? 0.35 + 0.65 * (contrast / 50) : 1;
                const wanted = MAP_SEPARATION * Math.min(1, k);
                const roads = ["streets", "main-roads", "motorways"] as const;
                const gap = Math.min(
                  ...roads.flatMap((r) => [
                    colorDistance(over("water"), over(r)),
                    colorDistance(over("buildings"), over(r)),
                  ]),
                  colorDistance(over("buildings"), over("water")),
                );
                // Not always the whole of the gap (the search gets as near as it can, at least about half of it even on a faint, grey map): a night sky drawn grey (no intensity) has only lightness to tell them by
                return gap < wanted * 0.45
                  ? [
                      `${state} light ${light.toFixed(2)} hue ${hue} vivid ${vivid} contrast ${contrast} gap ${gap.toFixed(3)}`,
                    ]
                  : [];
              }),
            ),
          );
        });
      expect(failures).toEqual([]);
    },
  );

  it("turns every line of the map together, and leaves the sky alone", () => {
    const p = skyPalette({ state: "CLEAR_DAY", cloudCover: 0, light: 0.5 });
    const own = { hue: 0, vivid: 50, contrast: 50 };
    // Untuned: the page's own colours
    expect(mapInksFor(p.sky2, own)).toEqual(p.map);
    expect(mapInksFor(p.sky2, { ...own, hue: 360 }).motorways.color).toBe(
      p.map.motorways.color,
    );
    const turned = mapInksFor(p.sky2, { ...own, hue: 120 });
    for (const layer of ["streets", "main-roads", "motorways"] as const) {
      expect(turned[layer].color).not.toBe(p.map[layer].color);
    }
  });

  it("takes the lines from white to vivid, and from faint to strong", () => {
    const p = skyPalette({ state: "CLEAR_NIGHT", cloudCover: 0, light: -1 });
    const own = { hue: 0, vivid: 50, contrast: 50 };
    /** How far a colour is from grey: the spread of its channels */
    const spread = (hex: string) =>
      Math.max(...rgb(hex)) - Math.min(...rgb(hex));
    const motorway = (tune: typeof own) => mapInksFor(p.sky2, tune).motorways;

    expect(spread(motorway({ ...own, vivid: 0 }).color)).toBeLessThan(4);
    expect(spread(motorway({ ...own, vivid: 100 }).color)).toBeGreaterThan(
      spread(motorway(own).color),
    );

    const opacities = [0, 50, 100].map(
      (contrast) => mapInksFor(p.sky2, { ...own, contrast }).streets.opacity,
    );
    expect(opacities[0]).toBeLessThan(opacities[1]);
    expect(opacities[1]).toBeLessThan(opacities[2]);
    // The colour is the contrast's to leave alone
    expect(motorway({ ...own, contrast: 100 }).color).toBe(motorway(own).color);
  });

  it("shows each tuning in the colour a line has over the sky, the contrast too", () => {
    const p = skyPalette({ state: "CLEAR_NIGHT", cloudCover: 0, light: -1 });
    const own = { hue: 0, vivid: 50, contrast: 50 };
    const chip = (tune: typeof own) =>
      inkOverSky(p.sky2, mapInksFor(p.sky2, tune).streets);
    const chips = [
      own,
      { ...own, hue: 120 },
      { ...own, vivid: 100 },
      { ...own, contrast: 0 },
      { ...own, contrast: 100 },
    ].map(chip);
    expect(new Set(chips).size).toBe(chips.length);
    // Fully opaque, the ink itself; fully clear, the sky
    expect(inkOverSky("#102030", { color: "#ffeecc", opacity: 1 })).toBe(
      "#ffeecc",
    );
    expect(inkOverSky("#102030", { color: "#ffeecc", opacity: 0 })).toBe(
      "#102030",
    );
  });

  it("is as vivid as the UV index is high, by day", () => {
    /** How far a colour is from grey: the spread of its channels */
    const spread = (hex: string) =>
      Math.max(...rgb(hex)) - Math.min(...rgb(hex));
    const midday = (uv?: number) =>
      skyPalette({ state: "CLEAR_DAY", cloudCover: 0, light: 0.5, uv });
    const vividness = (uv?: number) =>
      spread(midday(uv).sky1) +
      spread(midday(uv).sky2) +
      spread(midday(uv).sky3);

    expect(vividness(0)).toBeLessThan(vividness(3));
    expect(vividness(3)).toBeLessThan(vividness(8));
    // Without a UV index, the sky's own colours: between a weak sun's and a strong one's
    expect(vividness(undefined)).toBeGreaterThan(vividness(0));
    expect(vividness(undefined)).toBeLessThan(vividness(8));
    // Past full strength there is nothing more to give
    expect(midday(11)).toEqual(midday(8));
    // The glow around the sun follows
    const alpha = (uv: number) =>
      Number(midday(uv).glow.match(/\/ ([\d.]+)\)/)![1]);
    expect(alpha(0)).toBeLessThan(alpha(8));
  });

  it("leaves dawn, dusk and night their own colours whatever the UV index", () => {
    for (const light of [-1, -0.2, 0, 1, 1.4, 2]) {
      const at = (uv?: number) =>
        skyPalette({ state: "CLEAR_NIGHT", cloudCover: 0, light, uv });
      expect(at(0)).toEqual(at(undefined));
      expect(at(9)).toEqual(at(undefined));
    }
  });

  it("returns well-formed colours", { timeout: 60_000 }, () => {
    for (const { state, cloudCover, light } of cases.filter(
      (_, i) => i % 7 === 0,
    )) {
      const p = skyPalette({ state, cloudCover, light });
      for (const hex of [
        p.sky1,
        p.sky2,
        p.sky3,
        p.sun,
        ...Object.values(p.map).map((m) => m.color),
      ]) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
      for (const { opacity } of Object.values(p.map)) {
        expect(opacity).toBeGreaterThan(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });
});
