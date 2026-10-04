"use client";

import { memo, useDeferredValue, useMemo, useState } from "react";
import type { AtmosphereAxes, VisualForce } from "@/lib/weather/atmosphere";
import { CALIBRATION_SCENARIOS, type CalibrationScenario } from "@/lib/weather/calibration";
import { THRESHOLDS } from "@/lib/weather/constants";
import { TWILIGHT } from "@/lib/weather/frames";
import {
  atmospherePalette,
  atmosphereSky,
  colorDistance,
  inkOverSky,
  skyColors,
  skyPalette,
  stateSky,
  type SkyPalette,
} from "@/lib/weather/palette";
import { skyAt, weatherState, type DayPhase } from "@/lib/weather/state";
import { computeAtmosphere } from "@/lib/weather/visual-input";

/**
 * The atmosphere lab (WTH-046E/K): every calibration scenario under the live
 * palette (weather state -> grey and dim) and under the continuous atmosphere
 * transform, side by side, at the scenario's moment and through a whole day.
 * A tool for calibrating, never shipped: the page 404s in production.
 */

const FORCE: Record<VisualForce, string> = {
  sun: "Sole",
  heat: "Calore",
  cold: "Freddo",
  cloud: "Nuvole",
  haze: "Foschia",
  rain: "Pioggia",
  snow: "Neve",
  storm: "Temporale",
};

const AXES: { key: keyof AtmosphereAxes; label: string; signed?: boolean }[] = [
  { key: "daylight", label: "Luce" },
  { key: "warmth", label: "Calore", signed: true },
  { key: "cloudiness", label: "Nuvole" },
  { key: "haze", label: "Foschia" },
  { key: "wetness", label: "Pioggia" },
  { key: "severity", label: "Temporale" },
  { key: "snow", label: "Neve" },
  { key: "energy", label: "Energia" },
];

/** The day the strips run through: Frame.light from night to night */
const DAY = Array.from({ length: 61 }, (_, i) => -1 + i * 0.05);

/**
 * The live page's day phase for a light: dawn and dusk within the twilight window of `dayPhase`
 * (40 minutes) before sunrise and after sunset, where the light scale counts 90 minutes as one unit.
 * Between sunrise and sunset the scale is a share of the day, not minutes, so the day is all "day".
 */
const TWILIGHT_SPAN = (THRESHOLDS.twilightMinutes * 60) / TWILIGHT;
function phaseOf(light: number): DayPhase {
  if (light > 0 && light < 1) return "day";
  if (light <= 0 && light >= -TWILIGHT_SPAN) return "dawn";
  if (light >= 1 && light <= 1 + TWILIGHT_SPAN) return "dusk";
  return "night";
}

function liveState(s: CalibrationScenario, light: number) {
  return {
    light,
    state: weatherState(
      { condition: s.input.condition ?? "clear", intensity: s.input.intensity ?? "moderate" },
      phaseOf(light),
    ),
    cloudCover: s.input.cloudCover ?? 0,
    uv: s.input.uvIndex ?? undefined,
  };
}

const forces = (d: VisualForce | null, s: VisualForce | null) =>
  [d, s].filter(Boolean).map((f) => FORCE[f!]).join(" · ") || "Nessuna";

const fmt = (n: number, digits = 2) => (n < 0 ? "−" : "") + Math.abs(n).toFixed(digits);

export function AtmosphereLab() {
  const [moment, setMoment] = useState<number | null>(null);
  const [grey, setGrey] = useState(false);
  // The map inks take a few milliseconds a palette: the slider moves at once, the panels follow
  const deferred = useDeferredValue(moment);

  return (
    <main
      className="min-h-dvh bg-[#0c0f25] px-4 pb-24 pt-10 text-white sm:px-8 lg:px-12"
      style={grey ? { filter: "grayscale(1)" } : undefined}
    >
      <header className="grid gap-8 border-b border-white/20 pb-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-end">
        <div>
          <p className="label text-white/70">WTH-046E · Laboratorio di calibrazione</p>
          <h1 className="display-caps mt-3 text-[clamp(3rem,11vw,9rem)] leading-[0.82]">Atmosfera</h1>
        </div>
        <div className="grid gap-3 text-caption text-white/80">
          <p>
            La stessa luce, due motori. <strong className="font-semibold text-white">Oggi</strong>: lo stato
            meteo sceglie un grigio e un&apos;attenuazione. <strong className="font-semibold text-white">Atmosfera</strong>:
            ogni misura trasforma la base solare in modo continuo e limitato.
          </p>
          <p>Scenari di misure, mai città. Le strisce mostrano la giornata intera sotto lo stesso meteo.</p>
        </div>
      </header>

      <Controls moment={moment} setMoment={setMoment} grey={grey} setGrey={setGrey} />

      <ol className="mt-10 grid gap-x-8 gap-y-14 md:grid-cols-2 2xl:grid-cols-3">
        {CALIBRATION_SCENARIOS.map((s, i) => (
          <ScenarioCard key={s.id} index={i + 1} scenario={s} light={deferred ?? s.input.light} />
        ))}
      </ol>
    </main>
  );
}

function Controls({
  moment,
  setMoment,
  grey,
  setGrey,
}: {
  moment: number | null;
  setMoment: (m: number | null) => void;
  grey: boolean;
  setGrey: (g: boolean) => void;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 grid gap-4 border-b border-white/20 bg-[#0c0f25]/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-8 lg:-mx-12 lg:px-12">
      <label className="grid gap-2">
        <span className="label flex justify-between text-white/70">
          <span>Momento</span>
          <span className="tabular-nums text-white">
            {moment == null ? "Quello di ogni scenario" : `luce ${fmt(moment)} · ${momentName(moment)}`}
          </span>
        </span>
        <input
          type="range"
          min={-1}
          max={2}
          step={0.01}
          value={moment ?? 0.5}
          aria-valuetext={moment == null ? "Quello di ogni scenario" : `luce ${fmt(moment)}, ${momentName(moment)}`}
          // Grabbing the thumb where it rests already fixes that moment for every scenario
          onPointerDown={() => moment == null && setMoment(0.5)}
          onChange={(e) => setMoment(Number(e.target.value))}
          className="w-full accent-[#f9e8a7]"
        />
      </label>
      <button
        type="button"
        onClick={() => setMoment(null)}
        disabled={moment == null}
        className="label border-b border-white/40 pb-0.5 text-left text-white disabled:border-transparent disabled:text-white/40"
      >
        Torna agli scenari
      </button>
      <label className="label flex cursor-pointer items-center gap-2 text-white">
        <input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} className="size-4 accent-[#f9e8a7]" />
        Scala di grigi
      </label>
    </div>
  );
}

function momentName(light: number): string {
  if (light < -0.4) return "notte";
  if (light < 0) return "ora blu";
  if (light < 0.1) return "alba";
  if (light < 0.35) return "mattino";
  if (light < 0.6) return "mezzogiorno";
  if (light < 0.85) return "pomeriggio";
  if (light < 1) return "ora d'oro";
  if (light < 1.1) return "tramonto";
  if (light < 1.4) return "ora blu";
  return "notte";
}

const ScenarioCard = memo(function ScenarioCard({
  index,
  scenario,
  light,
}: {
  index: number;
  scenario: CalibrationScenario;
  light: number;
}) {
  const { atmosphere } = useMemo(() => computeAtmosphere({ ...scenario.input, light }), [scenario, light]);
  const live = useMemo(() => skyPalette(liveState(scenario, light)), [scenario, light]);
  const next = useMemo(() => atmospherePalette(light, atmosphere), [light, atmosphere]);
  const strips = useMemo(() => {
    const dayAtmosphere = DAY.map((l) => computeAtmosphere({ ...scenario.input, light: l }).atmosphere);
    return {
      live: DAY.map((l) => skyColors(stateSky(liveState(scenario, l)))),
      next: DAY.map((l, i) => skyColors(atmosphereSky(l, dayAtmosphere[i]))),
    };
  }, [scenario]);

  const got = atmosphere.signature;
  const want = scenario.expected;
  const agrees = got.dominant === want.dominant && got.secondary === want.secondary;
  const shift = colorDistance(live.sky2, next.sky2);
  const sky = skyAt(light, phaseOf(light));

  return (
    <li className="grid content-start gap-5">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 border-t-2 border-white pt-3">
        <span className="display-caps text-4xl leading-none tabular-nums">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight tracking-tight">{scenario.label}</h2>
          <p className="mt-1 text-caption text-white/70">{measurements(scenario)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SkyPanel name="Oggi" palette={live} sky={sky} />
        <SkyPanel name="Atmosfera" palette={next} sky={sky} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-y border-white/20 py-3 text-caption">
        <dt className="label self-center text-white/60">Forze</dt>
        <dd className="text-right font-semibold">{forces(got.dominant, got.secondary)}</dd>
        <dt className="label self-center text-white/60">Attese</dt>
        <dd className={`text-right ${agrees ? "text-white/80" : "font-semibold text-[#fda296]"}`}>
          {agrees ? "Uguali" : forces(want.dominant, want.secondary)}
        </dd>
        <dt className="label self-center text-white/60">Scarto dal cielo di oggi</dt>
        <dd className="text-right tabular-nums">ΔE {fmt(shift * 100, 1)}</dd>
      </dl>

      <DayStrips live={strips.live} next={strips.next} light={light} />

      <Axes atmosphere={atmosphere} />

      <p className="text-caption text-white/80">{want.look}</p>
    </li>
  );
});

function measurements({ input: m }: CalibrationScenario): string {
  const parts = [
    m.temp != null && `${fmt(m.temp, 0)} °C`,
    m.cloudCover != null && `nuvole ${m.cloudCover}%`,
    m.humidity != null && `umidità ${m.humidity}%`,
    m.visibility != null && `visibilità ${m.visibility} km`,
    m.dewPoint != null && `rugiada ${fmt(m.dewPoint, 1)} °C`,
    m.precipitation != null && `${m.precipitation} mm/h`,
    m.uvIndex != null && `UV ${m.uvIndex}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** A sky as the page paints it: its three stops, the glow where the light source sits, white text on it, and the city's lines over it */
function SkyPanel({ name, palette: p, sky }: { name: string; palette: SkyPalette; sky: ReturnType<typeof skyAt> }) {
  const x = 12 + 76 * sky.progress;
  const y = sky.body === "moon" ? 22 : 78 - 58 * Math.max(0, sky.elevation);
  const lines = [
    { layer: "water", width: 14, d: "M -5 112 C 40 100, 70 128, 110 114 S 170 96, 210 108" },
    { layer: "streets", width: 1.2, d: "M 10 0 L 46 200 M 120 0 L 96 200 M 0 60 L 200 84 M 0 150 L 200 138" },
    { layer: "main-roads", width: 2.6, d: "M -5 30 C 60 56, 130 40, 205 70" },
    { layer: "motorways", width: 4, d: "M 150 -5 C 140 70, 170 130, 130 205" },
  ] as const;
  return (
    <figure
      className="relative isolate flex aspect-[3/4] flex-col justify-between overflow-hidden p-3"
      style={{ background: `linear-gradient(180deg, ${p.sky1} 0%, ${p.sky2} 55%, ${p.sky3} 100%)` }}
      role="img"
      aria-label={`${name}: cielo ${p.sky1}, ${p.sky2}, ${p.sky3}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${p.glow} 0%, transparent 42%)` }}
      />
      <svg aria-hidden viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 size-full">
        {lines.map(({ layer, width, d }) => (
          <path
            key={layer}
            d={d}
            fill="none"
            stroke={p.map[layer].color}
            strokeOpacity={p.map[layer].opacity * 0.5}
            strokeWidth={width}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <figcaption className="label text-white">{name}</figcaption>
      <div className="grid gap-1">
        <span className="text-[clamp(2rem,6vw,3.25rem)] font-extralight leading-none tracking-tight">21°</span>
        <span className="text-caption text-[var(--ink-muted)]">Testo attenuato</span>
        <span className="mt-1 flex gap-1" aria-hidden>
          {(["water", "streets", "main-roads", "motorways"] as const).map((layer) => (
            <span key={layer} className="h-1.5 flex-1" style={{ background: inkOverSky(p.sky2, p.map[layer]) }} />
          ))}
        </span>
        <span className="font-mono text-[0.625rem] leading-tight text-white/80">
          {p.sky1} {p.sky2} {p.sky3}
        </span>
      </div>
    </figure>
  );
}

function DayStrips({
  live,
  next,
  light,
}: {
  live: ReturnType<typeof skyColors>[];
  next: ReturnType<typeof skyColors>[];
  light: number;
}) {
  const at = ((light + 1) / 3) * 100;
  const row = (colors: ReturnType<typeof skyColors>[], label: string) => (
    <div className="flex h-9" role="img" aria-label={`${label}: la giornata da notte a notte`}>
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: `linear-gradient(180deg, ${c.sky1}, ${c.sky2} 55%, ${c.sky3})` }} />
      ))}
    </div>
  );
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5">
      <div className="grid grid-rows-2 gap-1.5">
        <span className="label self-center text-white/60">Oggi</span>
        <span className="label self-center text-white/60">Atmosfera</span>
      </div>
      <div className="relative grid gap-1.5">
        {row(live, "Oggi")}
        {row(next, "Atmosfera")}
        {/* The moment on show, across both days */}
        <span className="absolute inset-y-0 w-px -translate-x-1/2 bg-white" style={{ left: `${at}%` }} aria-hidden />
      </div>
      <span />
      <div className="relative h-4 text-[0.625rem] uppercase tracking-[0.12em] text-white/60">
        <span className="absolute left-0">Notte</span>
        <span className="absolute -translate-x-1/2" style={{ left: "33.3%" }}>Alba</span>
        <span className="absolute -translate-x-1/2" style={{ left: "66.7%" }}>Tramonto</span>
        {/* On the narrowest phones the last word would touch "Tramonto": the first "Notte" says it already */}
        <span className="absolute right-0 max-[22rem]:hidden">Notte</span>
      </div>
    </div>
  );
}

function Axes({ atmosphere }: { atmosphere: AtmosphereAxes }) {
  return (
    <dl className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-x-3 gap-y-1.5 text-caption">
      {AXES.map(({ key, label, signed }) => {
        const v = atmosphere[key];
        return (
          <div key={key} className="contents">
            <dt className="label text-white/60">{label}</dt>
            <dd className="relative h-px bg-white/25" aria-hidden>
              {signed ? (
                <>
                  <span className="absolute -top-1 left-1/2 h-2.5 w-px bg-white/50" />
                  <span
                    className="absolute -top-px h-[3px] bg-white"
                    style={v >= 0 ? { left: "50%", width: `${v * 50}%` } : { right: "50%", width: `${-v * 50}%` }}
                  />
                </>
              ) : (
                <span className="absolute -top-px left-0 h-[3px] bg-white" style={{ width: `${v * 100}%` }} />
              )}
            </dd>
            <dd className="text-right tabular-nums">{fmt(v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
