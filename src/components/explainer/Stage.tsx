"use client";

import { mixColor } from "@/lib/atlas/sky";
import { roadNetwork } from "@/lib/explainer/roads";
import { along, clamp01, countTo, easeInOutCubic, easeInOutQuart, easeOutBack, easeOutCubic, easeOutQuart, lerp, SCENES, span } from "@/lib/explainer/timeline";
import { tempColor } from "@/lib/weather/temp-color";
import { useId, useMemo, type ReactNode } from "react";

/**
 * The guide's picture, "Come funziona": 1280 by 720, drawn from one number, the time in milliseconds. It is a short, quick
 * film that teaches the site as a thing to use: three words slam in (SCOPRI, CREA, CONSERVA), then each is shown being
 * done, with a pointer that does it (a place is typed into the search and the map flies there, the hour is dragged and the
 * poster made, the poster is kept and can be shared). The colours are the site's own (the temperature's scale, the sky of the
 * place on show, the butter accent); the type is the poster's. It draws nothing by itself: ask it for any time and it shows
 * that moment, which is how it is paused, jumped and tested.
 */

export const W = 1280;
export const H = 720;

/** The place the film lands on: the visitor's own, so the guide is about them */
export type FilmCity = {
  name: string;
  temp: number;
  lat: number;
  lon: number;
  /** "Oggi, 19 ottobre" */
  day: string;
  /** "11:48" */
  time: string;
  /** The sky of the moment on show, top, middle and horizon */
  sky: readonly [string, string, string];
};

const BACKDROP = "#080c1a";
const BUTTER = "#f9e8a7";
const INK = "#ffffff";
const NIGHT_INK = "#0b1226";
const MUTED = "rgb(255 255 255 / 0.72)";
const SANS = "var(--font-poster), 'Helvetica Neue', Helvetica, Arial, sans-serif";
const DISPLAY = "var(--font-display-face), var(--font-poster), sans-serif";

/** The places of the weather field, with a temperature each: cool in the north, warm in the south */
const PLACES = [
  { name: "Bolzano", temp: 6, x: 560, y: 120, at: 0.46 },
  { name: "Milano", temp: 11, x: 285, y: 235, at: 0.44 },
  { name: "Cagliari", temp: 21, x: 430, y: 620, at: 0.5 },
  { name: "Roma", temp: 19, x: 880, y: 455, at: 0.47 },
  { name: "Catania", temp: 26, x: 1010, y: 625, at: 0.52 },
] as const;

/** The three moods of the poster's sky as the hour is dragged: the moment's own, the dusk, the night */
const DUSK = ["#262d6a", "#8a5f9c", "#eba68f"] as const;
const NIGHT = ["#0d1130", "#1b2147", "#2c3566"] as const;

/** The three opening panels: the cold, the mild and the warm end of the temperature's scale, each with its word */
const WORDS = [
  { word: "Scopri", caption: "un luogo", color: 3 },
  { word: "Crea", caption: "un record", color: 15 },
  { word: "Conserva", caption: "il risultato", color: 27 },
] as const;

/** Opacity of a scene or an element: in over `fadeIn`, held, out over `fadeOut` */
function vis(t: number, from: number, to: number, fadeIn = 450, fadeOut = 450): number {
  return Math.min(easeOutCubic(span(t, from, from + fadeIn)), 1 - easeOutCubic(span(t, to - fadeOut, to)));
}

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4).replace(".", ",")}° ${v >= 0 ? pos : neg}`;

function MicroLabel({ x, y, children, anchor = "start", opacity = 1, fill = MUTED, size = 15 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; opacity?: number; fill?: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill} opacity={opacity} fontFamily={SANS} fontSize={size} letterSpacing="0.16em" style={{ textTransform: "uppercase" }}>
      {children}
    </text>
  );
}

/** The step's name, as the schema has it: an icon, the word, what it means, at the top left */
function StepTitle({ icon, label, caption, p, opacity }: { icon: ReactNode; label: string; caption: string; p: number; opacity: number }) {
  const rise = (1 - easeOutQuart(clamp01(p * 5))) * 26;
  return (
    <g opacity={opacity} transform={`translate(0 ${rise})`}>
      <g transform="translate(72 74)" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </g>
      <MicroLabel x={72} y={150} fill={INK} size={17}>
        {label}
      </MicroLabel>
      <text x={70} y={206} fill={INK} fontFamily={SANS} fontSize={58} fontWeight={700} letterSpacing="-0.035em">
        {caption}
      </text>
    </g>
  );
}

const MapIcon = () => (
  <g transform="scale(1.7)">
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </g>
);
const PaletteIcon = () => (
  <g transform="scale(1.7)">
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .3-2.1 1.4-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z" />
    <circle cx="7.5" cy="11" r="1" fill={INK} />
    <circle cx="10" cy="7.2" r="1" fill={INK} />
    <circle cx="14.5" cy="7.2" r="1" fill={INK} />
  </g>
);
const BookmarkIcon = () => (
  <g transform="scale(1.7)">
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </g>
);

/** The pointer that shows what to do: an arrow, and a ring that opens where it clicks */
function Cursor({ x, y, press, opacity = 1 }: { x: number; y: number; press: number; opacity?: number }) {
  const ring = clamp01(press);
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity} pointerEvents="none">
      <circle r={10 + 46 * ring} fill="none" stroke={BUTTER} strokeWidth={3} strokeOpacity={ring > 0 && ring < 1 ? 0.9 * (1 - ring) : 0} />
      <g transform={`scale(${1 - 0.12 * Math.sin(ring * Math.PI)})`} style={{ filter: "drop-shadow(0 4px 8px rgb(0 0 0 / 0.5))" }}>
        <path d="M0 0v30l8-7 6 14 6-3-6-13 11-1z" fill="#fff" stroke="#0b1226" strokeWidth={2} strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** A short instruction beside the pointer: what is being done, in a word or two */
function Hint({ x, y, children, opacity }: { x: number; y: number; children: string; opacity: number }) {
  const w = children.length * 12.6 + 56;
  const left = Math.min(x, W - 24 - w);
  return (
    <g transform={`translate(${left} ${y + (1 - easeOutBack(clamp01(opacity))) * 14})`} opacity={clamp01(opacity)} pointerEvents="none">
      <rect width={w} height={42} rx={21} fill={BUTTER} />
      <circle cx={21} cy={21} r={5} fill={NIGHT_INK} />
      <text x={36} y={27.5} fill={NIGHT_INK} fontFamily={SANS} fontSize={19} fontWeight={700} letterSpacing="-0.01em">
        {children}
      </text>
    </g>
  );
}

export function Stage({ t, city }: { t: number; city: FilmCity }) {
  const uid = useId().replace(/:/g, "");
  const roads = useMemo(() => roadNetwork(11, 52, W, H), []);

  const [, ex, cr, ke, out] = SCENES;
  const pEx = span(t, ex.from, ex.to);
  const pCr = span(t, cr.from, cr.to);
  const pKe = span(t, ke.from, ke.to);

  // The map comes in with the first step and stays behind the others, dimmed: the weather's colours are the film's ground
  const mapOpacity =
    easeOutCubic(span(t, ex.from - 100, ex.from + 400)) *
    (1 - 0.5 * easeInOutCubic(span(t, cr.from, cr.from + 1200))) *
    (1 - 0.3 * easeInOutCubic(span(t, out.from, out.from + 600)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Guida: scrivi un luogo e la mappa ti porta lì, scegli l'ora e crea il poster, conservalo e condividilo" className="block h-full w-full" style={{ background: BACKDROP }}>
      <defs>
        <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="64" />
        </filter>
        <radialGradient id={`${uid}-vignette`} cx="50%" cy="46%" r="75%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={city.sky[0]} />
          <stop offset="0.55" stopColor={city.sky[1]} />
          <stop offset="1" stopColor={city.sky[2]} />
        </linearGradient>
        <linearGradient id={`${uid}-dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={DUSK[0]} />
          <stop offset="0.55" stopColor={DUSK[1]} />
          <stop offset="1" stopColor={DUSK[2]} />
        </linearGradient>
        <linearGradient id={`${uid}-night`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={NIGHT[0]} />
          <stop offset="0.55" stopColor={NIGHT[1]} />
          <stop offset="1" stopColor={NIGHT[2]} />
        </linearGradient>
        <clipPath id={`${uid}-poster`}>
          <rect x="470" y="104" width="340" height="460" rx="3" />
        </clipPath>
        <clipPath id={`${uid}-title`}>
          <rect x="470" y="238" width="340" height="86" />
        </clipPath>
      </defs>

      {/* THE MAP: roads and the weather's colours, under the three steps */}
      <g opacity={mapOpacity}>
        <MapLayer uid={uid} t={t} p={pEx} roads={roads} city={city} />
      </g>

      {/* EXPLORE */}
      <g opacity={vis(t, ex.from + 150, ex.to + 300, 450, 700)}>
        <ExploreOverlay p={pEx} city={city} />
        <StepTitle icon={<MapIcon />} label="Explore" caption="Scopro un luogo" p={pEx} opacity={1} />
      </g>

      {/* CREATE */}
      <g opacity={vis(t, cr.from, cr.to + 400, 600, 700)}>
        <CreateScene uid={uid} p={pCr} city={city} roads={roads} />
        <StepTitle icon={<PaletteIcon />} label="Create" caption="Creo un record" p={pCr} opacity={1} />
      </g>

      {/* KEEP */}
      <g opacity={vis(t, ke.from - 200, ke.to + 300, 700, 700)}>
        <KeepScene uid={uid} p={pKe} city={city} />
        <StepTitle icon={<BookmarkIcon />} label="Keep" caption="Conservo il risultato" p={pKe} opacity={1} />
      </g>

      {/* THE CLOSE */}
      <g opacity={easeOutCubic(span(t, out.from + 100, out.from + 700))}>
        <Outro p={span(t, out.from, out.to)} />
      </g>

      {/* THE OPENING: three words, three colours, one after another */}
      <Opening t={t} />

      <rect width={W} height={H} fill={`url(#${uid}-vignette)`} pointerEvents="none" />
    </svg>
  );
}

/** SCOPRI. CREA. CONSERVA. A pastel panel of the temperature's scale rises, the word punches in, the next panel pushes it out */
function Opening({ t }: { t: number }) {
  const slot = 800;
  return (
    <g>
      {WORDS.map((w, i) => {
        const from = i * slot;
        const enter = easeInOutQuart(span(t, from - 160, from + 220));
        const leave = easeInOutQuart(span(t, from + slot - 180, from + slot + 200));
        if (enter <= 0 || leave >= 1) return null;
        const y = (1 - enter) * H - leave * H;
        const word = easeOutBack(span(t, from + 80, from + 380));
        const settle = span(t, from + 120, from + slot);
        const fill = tempColor(w.color);
        const ink = NIGHT_INK;
        return (
          <g key={w.word} transform={`translate(0 ${y})`}>
            <rect width={W} height={H} fill={fill} />
            <rect width={W} height={H} fill="#fff" opacity={0.08 * (1 - enter)} />
            <g transform={`translate(640 372) scale(${lerp(0.82, 1.0, word) + 0.04 * settle}) translate(-640 -372)`} opacity={clamp01(word * 2)}>
              <text x={640} y={372} textAnchor="middle" fill={ink} fontFamily={SANS} fontSize={w.word.length > 6 ? 188 : 232} fontWeight={800} letterSpacing="-0.055em" style={{ textTransform: "uppercase" }}>
                {w.word}
              </text>
              <text x={640} y={436} textAnchor="middle" fill={ink} fontFamily={SANS} fontSize={34} fontWeight={600} letterSpacing="-0.01em" opacity={easeOutCubic(span(t, from + 200, from + 460))}>
                {w.caption}
              </text>
            </g>
            <g opacity={0.55}>
              <MicroLabel x={72} y={92} fill={ink} size={16}>
                0{i + 1} / 03
              </MicroLabel>
              <rect x={72} y={H - 96} width={W - 144} height={5} rx={2.5} fill={ink} opacity={0.18} />
              <rect x={72} y={H - 96} width={(W - 144) * ((i + clamp01(settle)) / 3)} height={5} rx={2.5} fill={ink} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** Roads that draw themselves, and the colours of the weather of five places fading into one another */
function MapLayer({ uid, t, p, roads, city }: { uid: string; t: number; p: number; roads: ReturnType<typeof roadNetwork>; city: FilmCity }) {
  const zoom = flightZoom(p);
  return (
    <g transform={`translate(640 360) scale(${zoom}) translate(-640 -360)`}>
      <g filter={`url(#${uid}-blur)`}>
        {PLACES.map((pl, i) => {
          const fade = easeOutCubic(span(p, 0, pl.at + 0.06));
          const drift = Math.sin(t / 1500 + i * 1.7) * 14;
          return <circle key={pl.name} cx={pl.x + drift} cy={pl.y + Math.cos(t / 1700 + i) * 10} r={250 + i * 14} fill={tempColor(pl.temp)} opacity={0.62 * fade} />;
        })}
        {/* the visitor's own place, in its own weather, where the flight lands */}
        <circle cx={640} cy={360} r={210} fill={tempColor(city.temp)} opacity={0.5 * easeOutCubic(span(p, 0.5, 0.8))} />
      </g>
      <g fill="none" strokeLinecap="round">
        {roads.map((r, i) => {
          const draw = easeInOutCubic(span(p, r.delay * 0.3, r.delay * 0.3 + 0.3));
          return <path key={i} d={r.d} pathLength={1} stroke={BUTTER} strokeOpacity={0.62 * r.weight} strokeWidth={r.weight === 1 ? 1.7 : 0.9} strokeDasharray={1} strokeDashoffset={1 - draw} />;
        })}
      </g>
    </g>
  );
}

/** The flight to the place: the map pulls back to show the weather of many places, then dives to the one asked for */
function flightZoom(p: number): number {
  if (p < 0.4) return 1;
  if (p < 0.55) return lerp(1, 0.66, easeInOutCubic(span(p, 0.4, 0.55)));
  return lerp(0.66, 1.42, easeInOutQuart(span(p, 0.55, 0.9)));
}

function ExploreOverlay({ p, city }: { p: number; city: FilmCity }) {
  const zoom = flightZoom(p);
  const sx = (x: number) => 640 + (x - 640) * zoom;
  const sy = (y: number) => 360 + (y - 360) * zoom;

  // the search: a field at the top right, a pointer that clicks it, the name typed in
  const field = easeOutBack(span(p, 0.02, 0.14));
  const cursor = along([[1160, 420], [1030, 118]], easeInOutCubic(span(p, 0.05, 0.22)));
  const click = span(p, 0.22, 0.32);
  const typed = Math.floor(city.name.length * easeOutCubic(span(p, 0.3, 0.46)) + 0.0001);
  const typedText = city.name.slice(0, Math.min(city.name.length, typed));
  const caret = Math.floor(p * 34) % 2 === 0;
  const searchOn = 1 - easeOutCubic(span(p, 0.5, 0.58));

  // the crosshair lands
  const appear = easeOutBack(span(p, 0.52, 0.64));
  const land = easeOutCubic(span(p, 0.76, 0.88));
  const size = lerp(34, 46, land) * appear;
  const coordProgress = easeOutCubic(span(p, 0.5, 0.86));
  const lat = lerp(44.2, city.lat, coordProgress);
  const lon = lerp(9.0, city.lon, coordProgress);

  return (
    <g>
      {/* the search */}
      <g opacity={clamp01(field) * searchOn} transform={`translate(${(1 - clamp01(field)) * 40} 0)`}>
        <rect x={700} y={72} width={508} height={64} rx={32} fill="rgb(255 255 255 / 0.14)" stroke="rgb(255 255 255 / 0.5)" strokeWidth={1.5} />
        <g transform="translate(730 92) scale(1.1)" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </g>
        <text x={780} y={113} fill={INK} fontFamily={SANS} fontSize={28} fontWeight={500}>
          {typedText || <tspan fill={MUTED}>Cerca una città</tspan>}
          {span(p, 0.22, 0.5) > 0 && caret ? <tspan fill={BUTTER}>|</tspan> : null}
        </text>
      </g>
      <Hint x={758} y={150} opacity={easeOutCubic(span(p, 0.08, 0.18)) * (1 - easeOutCubic(span(p, 0.44, 0.52)))}>
        Scrivi un luogo
      </Hint>

      {/* the places and their weather, seen as the map pulls back */}
      {PLACES.map((pl) => {
        const a = easeOutCubic(span(p, pl.at, pl.at + 0.1)) * (1 - easeOutCubic(span(p, 0.7, 0.8)));
        const [x, y] = [sx(pl.x), sy(pl.y)];
        const shown = countTo(pl.temp, span(p, pl.at, pl.at + 0.16));
        return (
          <g key={pl.name} opacity={a}>
            <circle cx={x} cy={y} r={5} fill={INK} />
            <circle cx={x} cy={y} r={5 + 16 * ((p * 3 + pl.at) % 1)} fill="none" stroke={INK} strokeOpacity={0.5 * (1 - ((p * 3 + pl.at) % 1))} />
            <MicroLabel x={x + 16} y={y - 10} fill={INK} size={14}>
              {pl.name}
            </MicroLabel>
            <text x={x + 14} y={y + 38} fill={INK} fontFamily={DISPLAY} fontSize={40} fontWeight={700}>
              {shown}°
            </text>
          </g>
        );
      })}

      {/* the crosshair at the middle */}
      <g transform="translate(640 360)" opacity={clamp01(appear)}>
        <g stroke={INK} strokeWidth={2.4} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgb(0 0 0 / 0.55))" }}>
          <path d={`M0 ${-size}v${size * 0.55}M0 ${size * 0.45}v${size * 0.55}M${-size} 0h${size * 0.55}M${size * 0.45} 0h${size * 0.55}`} />
          <circle r={4} fill={INK} />
        </g>
        <circle r={size * 1.5 * land} fill="none" stroke={BUTTER} strokeOpacity={0.9 * (1 - land)} strokeWidth={2} />
      </g>

      {/* what the map reads at the middle */}
      <g opacity={easeOutCubic(span(p, 0.52, 0.64)) * (1 - easeOutCubic(span(p, 0.94, 1)))}>
        <MicroLabel x={72} y={618} size={14}>
          Centro della mappa
        </MicroLabel>
        <text x={72} y={652} fill={INK} fontFamily={SANS} fontSize={28} fontWeight={500} style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtCoord(lat, "N", "S")} · {fmtCoord(lon, "E", "O")}
        </text>
      </g>

      {/* what it means */}
      <g opacity={easeOutCubic(span(p, 0.58, 0.7)) * (1 - easeOutCubic(span(p, 0.92, 1)))}>
        <text x={W - 72} y={650} textAnchor="end" fill={INK} fontFamily={SANS} fontSize={26} fontWeight={500} letterSpacing="-0.01em">
          Il meteo cambia da un luogo all&apos;altro:
        </text>
        <text x={W - 72} y={684} textAnchor="end" fill={BUTTER} fontFamily={SANS} fontSize={26} fontWeight={600} letterSpacing="-0.01em">
          i colori sfumano con lui.
        </text>
      </g>

      {/* the place it lands on */}
      <g opacity={easeOutCubic(span(p, 0.8, 0.92))}>
        <MicroLabel x={694} y={342} fill={INK} size={15}>
          {city.name}
        </MicroLabel>
        <text x={692} y={398} fill={INK} fontFamily={DISPLAY} fontSize={56} fontWeight={700}>
          {city.temp}°
        </text>
      </g>

      <Cursor x={cursor[0]} y={cursor[1]} press={click} opacity={easeOutCubic(span(p, 0.04, 0.12)) * (1 - easeOutCubic(span(p, 0.46, 0.54)))} />
    </g>
  );
}

/** Mini poster: a sky, a name, a temperature, hairlines: the same poster at any size */
function Poster({ x, y, w, h, fill, name, temp, muted = false }: { x: number; y: number; w: number; h: number; fill: string; name: string; temp: number; muted?: boolean }) {
  const k = w / 340;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={3 * k} fill={fill} />
      <rect width={w} height={h} rx={3 * k} fill="none" stroke="rgb(255 255 255 / 0.28)" />
      <MicroLabel x={22 * k} y={36 * k} size={Math.max(9, 12 * k)} fill={muted ? "rgb(255 255 255 / 0.6)" : MUTED}>
        Luogo
      </MicroLabel>
      <text x={20 * k} y={118 * k} fill={INK} fontFamily={SANS} fontSize={52 * k} fontWeight={800} letterSpacing="-0.04em">
        {name}
      </text>
      <text x={18 * k} y={250 * k} fill={BUTTER} fontFamily={DISPLAY} fontSize={150 * k} fontWeight={700} letterSpacing="-0.04em">
        {temp}°
      </text>
    </g>
  );
}

function CreateScene({ uid, p, city, roads }: { uid: string; p: number; city: FilmCity; roads: ReturnType<typeof roadNetwork> }) {
  // the crosshair's frame becomes the poster
  const open = easeInOutQuart(span(p, 0.0, 0.2));
  const x0 = lerp(570, 470, open);
  const w = lerp(140, 340, open);
  const y0 = lerp(290, 104, open);
  const h = lerp(140, 460, open);
  const content = easeOutCubic(span(p, 0.16, 0.34));

  // the hour, dragged by the pointer: three stops, the poster's sky following
  const hour = easeInOutCubic(span(p, 0.42, 0.7));
  const stop = hour * 2;
  const dusk = clamp01(stop) * (1 - clamp01(stop - 1));
  const night = clamp01(stop - 1);
  const labels = ["Adesso", "18:00", "21:00"];
  const label = labels[Math.min(2, Math.round(stop))];
  const temp = city.temp - Math.round(stop * 2);
  const sunY = lerp(168, 430, hour);
  const handle = lerp(450, 830, hour);
  const float = Math.sin(p * Math.PI * 3) * 3;
  const sweep = easeInOutCubic(span(p, 0.2, 0.4));

  // the poster is made: a press of the button, the poster answers
  const press = span(p, 0.86, 0.96);
  const pop = 1 + 0.035 * Math.sin(clamp01(span(p, 0.88, 1)) * Math.PI);
  const cta = easeOutBack(span(p, 0.7, 0.8));

  // the pointer: to the handle of the hour, with it, then to the button
  const toHandle = easeInOutCubic(span(p, 0.3, 0.42));
  const toButton = easeInOutCubic(span(p, 0.74, 0.86));
  const before = p < 0.72;
  const px = before ? lerp(1000, handle, toHandle) : lerp(handle, 1040, toButton);
  const py = before ? lerp(470, 646, toHandle) : lerp(646, 574, toButton);

  return (
    <g>
      <g transform={`translate(0 ${float}) translate(640 334) scale(${pop}) translate(-640 -334)`}>
        <g clipPath={`url(#${uid}-poster)`}>
          <rect x={x0} y={y0} width={w} height={h} fill={`url(#${uid}-sky)`} />
          <rect x={x0} y={y0} width={w} height={h} fill={`url(#${uid}-dusk)`} opacity={dusk} />
          <rect x={x0} y={y0} width={w} height={h} fill={`url(#${uid}-night)`} opacity={night} />
        </g>
        <rect x={x0} y={y0} width={w} height={h} rx={3} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth={1.5} />

        <g opacity={content}>
          <g clipPath={`url(#${uid}-poster)`}>
            <circle cx={752} cy={sunY} r={80} fill={BUTTER} opacity={0.45 * (1 - night)} filter={`url(#${uid}-blur)`} />
            <circle cx={752} cy={sunY} r={28} fill={BUTTER} opacity={0.95 * (1 - night * 0.8)} />
            <g transform="translate(470 150) scale(0.46)" fill="none" opacity={0.2 * easeOutCubic(span(p, 0.2, 0.45))}>
              {roads.slice(0, 26).map((r, i) => (
                <path key={i} d={r.d} stroke={BUTTER} strokeWidth={r.weight === 1 ? 2.2 : 1.2} />
              ))}
            </g>
            <polygon points={`${470 + sweep * 560 - 120},104 ${470 + sweep * 560 - 30},104 ${470 + sweep * 560 - 144},564 ${470 + sweep * 560 - 234},564`} fill="#fff" opacity={0.2 * Math.sin(sweep * Math.PI)} />
          </g>

          <MicroLabel x={492} y={140} size={13}>
            Luogo
          </MicroLabel>
          <g clipPath={`url(#${uid}-title)`}>
            <text x={490} y={306} fill={INK} fontFamily={SANS} fontSize={82} fontWeight={800} letterSpacing="-0.045em" transform={`translate(0 ${(1 - easeOutQuart(span(p, 0.18, 0.36))) * 96})`}>
              {city.name}
            </text>
          </g>
          <text x={486} y={470} fill={BUTTER} fontFamily={DISPLAY} fontSize={150} fontWeight={700} letterSpacing="-0.04em" opacity={easeOutCubic(span(p, 0.26, 0.4))}>
            {span(p, 0.26, 0.44) < 1 ? countTo(temp, span(p, 0.26, 0.44)) : temp}°
          </text>
          <path d="M492 508H788" stroke="rgb(255 255 255 / 0.7)" strokeWidth={1.2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - easeInOutCubic(span(p, 0.28, 0.44))} />
          <g opacity={easeOutCubic(span(p, 0.34, 0.46))}>
            <MicroLabel x={492} y={534} size={11}>
              Giorno
            </MicroLabel>
            <text x={492} y={552} fill={INK} fontFamily={SANS} fontSize={15} fontWeight={500}>
              {city.day}
            </text>
            <MicroLabel x={672} y={534} size={11}>
              Ora
            </MicroLabel>
            <text x={672} y={552} fill={INK} fontFamily={SANS} fontSize={15} fontWeight={500} style={{ fontVariantNumeric: "tabular-nums" }}>
              {label === "Adesso" ? city.time : label}
            </text>
          </g>
        </g>
      </g>

      {/* the hours of the day, as the moment is picked */}
      <g opacity={easeOutCubic(span(p, 0.3, 0.44))}>
        <MicroLabel x={920} y={176} size={12}>
          Il momento
        </MicroLabel>
        {[
          { at: "Adesso", shown: city.time, dt: 0, c: city.sky[1] },
          { at: "18:00", shown: "18:00", dt: -2, c: DUSK[1] },
          { at: "21:00", shown: "21:00", dt: -4, c: NIGHT[2] },
        ].map((r, i) => {
          const on = Math.round(stop) === i;
          return (
            <g key={r.at} transform={`translate(920 ${214 + i * 84})`} opacity={on ? 1 : 0.5}>
              <rect x={-14} y={-12} width={3} height={56} fill={BUTTER} opacity={on ? 1 : 0} />
              <circle cx={10} cy={14} r={9} fill={r.c} stroke="rgb(255 255 255 / 0.6)" />
              <text x={34} y={10} fill={INK} fontFamily={SANS} fontSize={24} fontWeight={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                {r.shown}
              </text>
              <text x={34} y={36} fill={MUTED} fontFamily={SANS} fontSize={16}>
                {city.temp + r.dt}° · {i === 0 ? "adesso" : i === 1 ? "al tramonto" : "di sera"}
              </text>
            </g>
          );
        })}
      </g>

      {/* the hour, chosen on a timeline */}
      <g opacity={easeOutCubic(span(p, 0.26, 0.4))}>
        <MicroLabel x={450} y={618} size={12}>
          Scelgo l&apos;ora
        </MicroLabel>
        <path d="M450 646H830" stroke="rgb(255 255 255 / 0.35)" strokeWidth={1.5} />
        {Array.from({ length: 25 }, (_, i) => (
          <path key={i} d={`M${450 + (i / 24) * 380} ${i % 6 === 0 ? 636 : 641}v${i % 6 === 0 ? 20 : 10}`} stroke="rgb(255 255 255 / 0.45)" strokeWidth={1.2} />
        ))}
        <circle cx={handle} cy={646} r={11} fill={BUTTER} />
        <circle cx={handle} cy={646} r={20} fill="none" stroke={BUTTER} strokeOpacity={0.5} />
        <text x={handle} y={690} textAnchor="middle" fill={BUTTER} fontFamily={SANS} fontSize={17} fontWeight={600} letterSpacing="0.04em">
          {label}
        </text>
      </g>

      {/* the button that makes it */}
      <g transform={`translate(1040 570) scale(${clamp01(cta) * (1 - 0.05 * Math.sin(clamp01(press) * Math.PI))})`} opacity={clamp01(cta)}>
        <rect x={-122} y={-28} width={244} height={56} rx={28} fill={BUTTER} />
        <text x={-4} y={9} textAnchor="middle" fill={NIGHT_INK} fontFamily={DISPLAY} fontSize={24} fontWeight={700}>
          Crea il poster
        </text>
        <text x={96} y={9} textAnchor="middle" fill={NIGHT_INK} fontFamily={SANS} fontSize={24} fontWeight={600}>
          →
        </text>
      </g>

      <Hint x={before ? px + 24 : px - 130} y={before ? py - 62 : py + 46} opacity={before ? easeOutCubic(span(p, 0.34, 0.44)) * (1 - easeOutCubic(span(p, 0.66, 0.72))) : easeOutCubic(span(p, 0.8, 0.86)) * (1 - easeOutCubic(span(p, 0.94, 1)))}>
        {before ? "Trascina l'ora" : "Crea il poster"}
      </Hint>
      <Cursor x={px} y={py} press={press} opacity={easeOutCubic(span(p, 0.26, 0.34)) * (1 - easeOutCubic(span(p, 0.96, 1)))} />
    </g>
  );
}

/** A mini poster's sky from a temperature: its colour dimmed into the night of the film */
const skyFor = (temp: number) => ({ top: mixColor("#0b1226", tempColor(temp), 0.78), bottom: mixColor("#0b1226", tempColor(temp + 5), 0.5) });

function KeepScene({ uid, p, city }: { uid: string; p: number; city: FilmCity }) {
  // the poster steps aside to the left of a row; two others come to it
  const settle = easeInOutQuart(span(p, 0.0, 0.3));
  const second = easeOutBack(span(p, 0.2, 0.42));
  const third = easeOutBack(span(p, 0.28, 0.5));
  const pw = 250;
  const ph = (pw / 340) * 460;
  const x1 = lerp(470, 190, settle);
  const y1 = lerp(104, 282, settle);
  const scale = lerp(1, pw / 340, settle);
  const row = [
    { x: 462, name: "Roma", temp: 19, k: second },
    { x: 734, name: "Catania", temp: 26, k: third },
  ];
  // the pointer taps the bookmark, and it fills
  const click = span(p, 0.5, 0.6);
  const drop = easeOutBack(span(p, 0.52, 0.68));
  const tick = easeOutCubic(span(p, 0.62, 0.72));
  const bx = x1 + pw - 62;
  // then the share
  const share = easeOutBack(span(p, 0.62, 0.74));
  const click2 = span(p, 0.84, 0.94);
  const toast = easeOutBack(span(p, 0.88, 0.97));
  const ring = (p * 4) % 1;
  const toBookmark = easeInOutCubic(span(p, 0.3, 0.5));
  const toShare = easeInOutCubic(span(p, 0.7, 0.84));
  const first = p < 0.66;
  const cx = first ? lerp(900, bx + 4, toBookmark) : lerp(bx + 4, 1130, toShare);
  const cy = first ? lerp(480, 300, toBookmark) : lerp(300, 440, toShare);

  return (
    <g>
      <MicroLabel x={190} y={262} size={13} opacity={easeOutCubic(span(p, 0.2, 0.4))}>
        I tuoi record
      </MicroLabel>

      {row.map((r, i) => {
        const sky = skyFor(r.temp);
        return (
          <g key={r.name} opacity={clamp01(r.k)} transform={`translate(${r.x + pw / 2} ${282 + ph / 2}) rotate(${(1 - clamp01(r.k)) * (i === 0 ? -9 : 9)}) translate(${-(r.x + pw / 2)} ${-(282 + ph / 2) + (1 - r.k) * 70})`}>
            <defs>
              <linearGradient id={`${uid}-m${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={sky.top} />
                <stop offset="1" stopColor={sky.bottom} />
              </linearGradient>
            </defs>
            <Poster x={r.x} y={282} w={pw} h={ph} fill={`url(#${uid}-m${i})`} name={r.name} temp={r.temp} muted />
          </g>
        );
      })}

      {/* the poster just made: the same sky and the same name, smaller */}
      <g transform={`translate(${x1} ${y1}) scale(${scale}) translate(${-470} ${-104})`}>
        <rect x={470} y={104} width={340} height={460} rx={3} fill={`url(#${uid}-night)`} />
        <rect x={470} y={104} width={340} height={460} rx={3} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth={1.5 / scale} />
        <MicroLabel x={492} y={140} size={13}>
          Luogo
        </MicroLabel>
        <text x={490} y={306} fill={INK} fontFamily={SANS} fontSize={82} fontWeight={800} letterSpacing="-0.045em">
          {city.name}
        </text>
        <text x={486} y={470} fill={BUTTER} fontFamily={DISPLAY} fontSize={150} fontWeight={700} letterSpacing="-0.04em">
          {city.temp - 4}°
        </text>
      </g>

      {/* the bookmark */}
      <g transform={`translate(${x1 + pw - 74} ${lerp(-120, 268, clamp01(drop))})`} opacity={clamp01(drop * 3)}>
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round" fill={BUTTER} transform="scale(2.6)">
          <path d="M6 3h12v18l-6-4.5L6 21z" />
        </g>
      </g>
      <g opacity={tick} transform={`translate(${x1 + pw - 12} ${y1 + ph + 36})`}>
        <circle r={16} fill={BUTTER} />
        <path d="M-7 0l5 5 9-10" stroke="#101428" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <MicroLabel x={x1} y={y1 + ph + 40} size={13} opacity={tick} fill={INK}>
        Conservato
      </MicroLabel>

      {/* share: a thing you do after, when you want */}
      <g transform={`translate(1130 ${lerp(480, 440, clamp01(share))}) scale(${clamp01(share)})`} opacity={clamp01(share)}>
        <circle r={34 + 38 * ring} fill="none" stroke={BUTTER} strokeOpacity={0.5 * (1 - ring)} />
        <circle r={34} fill={BUTTER} />
        <g stroke="#101428" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(-12 -13) scale(1.05)">
          <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6h14v-6" />
        </g>
      </g>
      <text x={1130} y={510} textAnchor="middle" fill={INK} fontFamily={SANS} fontSize={24} fontWeight={600} opacity={easeOutCubic(span(p, 0.7, 0.82))}>
        Condividi
      </text>
      <text x={1130} y={542} textAnchor="middle" fill={MUTED} fontFamily={SANS} fontSize={17} opacity={easeOutCubic(span(p, 0.74, 0.86))}>
        quando vuoi, dopo la creazione
      </text>
      <g transform={`translate(1130 ${lerp(640, 608, clamp01(toast))})`} opacity={clamp01(toast)}>
        <rect x={-130} y={-24} width={260} height={48} rx={24} fill="rgb(255 255 255 / 0.95)" />
        <text y={7} textAnchor="middle" fill={NIGHT_INK} fontFamily={SANS} fontSize={19} fontWeight={700}>
          Poster pronto da condividere
        </text>
      </g>

      <Hint x={first ? cx + 24 : cx - 150} y={first ? cy - 62 : cy - 120} opacity={first ? easeOutCubic(span(p, 0.34, 0.46)) * (1 - easeOutCubic(span(p, 0.58, 0.66))) : easeOutCubic(span(p, 0.76, 0.84)) * (1 - easeOutCubic(span(p, 0.94, 1)))}>
        {first ? "Tocca per conservare" : "Condividi quando vuoi"}
      </Hint>
      <Cursor x={cx} y={cy} press={first ? click : click2} opacity={easeOutCubic(span(p, 0.26, 0.34)) * (1 - easeOutCubic(span(p, 0.97, 1)))} />
    </g>
  );
}

function Outro({ p }: { p: number }) {
  const rise = (1 - easeOutQuart(clamp01(p * 2.4))) * 30;
  const chips = [
    { w: "Scopri", c: 3, t: "Esplora la mappa" },
    { w: "Crea", c: 15, t: "Scegli l'ora" },
    { w: "Conserva", c: 27, t: "Condividi quando vuoi" },
  ];
  return (
    <g transform={`translate(0 ${rise})`}>
      <rect width={W} height={H} fill={BACKDROP} opacity={0.66} />
      {chips.map((c, i) => {
        const a = easeOutBack(span(p, 0.08 + i * 0.12, 0.34 + i * 0.12));
        return (
          <g key={c.w} transform={`translate(${200 + i * 300} ${250 - (1 - clamp01(a)) * 40})`} opacity={clamp01(a)}>
            <rect width={260} height={150} rx={22} fill={tempColor(c.c)} />
            <text x={24} y={80} fill={NIGHT_INK} fontFamily={SANS} fontSize={42} fontWeight={800} letterSpacing="-0.045em" style={{ textTransform: "uppercase" }}>
              {c.w}
            </text>
            <text x={24} y={116} fill={NIGHT_INK} fontFamily={SANS} fontSize={20} fontWeight={600}>
              {c.t}
            </text>
            <text x={24} y={38} fill={NIGHT_INK} fontFamily={SANS} fontSize={15} fontWeight={700} letterSpacing="0.16em" opacity={0.65}>
              0{i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}
