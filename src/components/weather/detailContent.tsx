import {
  airInfo,
  comfort,
  moonInfo,
  pollenInfo,
  pressureTrend,
  sunInfo,
  uvInfo,
  visibilityInfo,
  windInfo,
  type DetailKey,
} from "@/lib/weather/details";
import { formatDuration, formatSigned, formatTemp, formatTime } from "@/lib/weather/formatters";
import type { WeatherData } from "@/lib/weather/types";
import type { ReactNode } from "react";
import { Disclosure } from "./Disclosure";
import { BAND_COLORS, Compass, PollutantRow, Scale, Sparkline, SunArc } from "./figures";
import { MoonGlyph } from "./MoonGlyph";

/**
 * The one description of each detail — its reading, a line of context and a
 * figure — rendered as an almanac row when calm and as a card when the
 * weather promotes it. Figures come in two sizes for those two places.
 */

export type FigureSize = "sm" | "lg";

export interface DetailContent {
  name: string;
  value: ReactNode;
  note: string;
  figure?: (size: FigureSize) => ReactNode;
  /** Extra detail behind a disclosure */
  more?: ReactNode;
}

const Unit = ({ children }: { children: ReactNode }) => (
  <span className="ml-1 text-[0.45em] font-normal tracking-normal text-ink-muted">{children}</span>
);

const TREND_WORDS = { rising: "In aumento", steady: "Stabile", falling: "In calo" } as const;

const scaleWidth = (size: FigureSize) => (size === "lg" ? "w-40" : "w-20");

export function detailContent(key: DetailKey, d: WeatherData): DetailContent | null {
  const tz = d.timezone;
  switch (key) {
    case "wind": {
      const w = windInfo(d);
      const gust = w.gust != null && w.gust > w.speed + 3 ? ` · raffiche ${Math.round(w.gust)} km/h` : "";
      return {
        name: "Vento",
        value: (
          <>
            {Math.round(w.speed)}
            <Unit>km/h</Unit>
          </>
        ),
        note: `${w.description} · da ${w.point}${gust}`,
        figure: (size) => <Compass deg={w.deg} className={size === "lg" ? "size-28" : "size-12"} />,
      };
    }
    case "humidity":
      return {
        name: "Umidità",
        value: `${Math.round(d.current.humidity)}%`,
        note: `${comfort(d.current.dewPoint, d.current.humidity)} · punto di rugiada ${formatTemp(d.current.dewPoint)}`,
        figure: (size) => <Scale position={d.current.humidity / 100} className={scaleWidth(size)} />,
      };
    case "uv": {
      const uv = uvInfo(d);
      if (!uv) return null;
      const peak = uv.peak ? ` · picco ${Math.round(uv.peak.value)} alle ${formatTime(uv.peak.time, tz)}` : "";
      return {
        name: "Indice UV",
        value: Math.round(uv.now),
        note: `${uv.category}${peak}`,
        figure: (size) => <Scale position={Math.min(uv.now, 12) / 12} bands={BAND_COLORS} className={scaleWidth(size)} />,
      };
    }
    case "air": {
      if (!d.airQuality) return null;
      const a = airInfo(d.airQuality);
      return {
        name: "Qualità dell’aria",
        value: a.label,
        note: `Indice ${a.index} su 5 · PM2.5 ${d.airQuality.pollutants.pm2_5.toFixed(1)} μg/m³`,
        figure: (size) => <Scale position={(a.index - 0.5) / 5} bands={BAND_COLORS} className={scaleWidth(size)} />,
        more: (
          <Disclosure more="Tutti gli inquinanti" less="Meno inquinanti" className="mt-2">
            <ul className="mt-2 divide-y divide-rule">
              {[...a.headline, ...a.others].map((b) => (
                <PollutantRow key={b.key} k={b.key} value={b.value} band={b.band} position={b.position} />
              ))}
            </ul>
          </Disclosure>
        ),
      };
    }
    case "pollen": {
      const p = d.pollen ? pollenInfo(d.pollen) : null;
      if (!p) return null;
      return {
        name: "Polline",
        value: p.label,
        // "Graminacee: alto · alberi: basso": each family in the air, by its level
        note: p.families.map((f, i) => `${i === 0 ? f.name : f.name.toLowerCase()}: ${f.label.toLowerCase()}`).join(" · "),
        figure: (size) => <Scale position={(p.band - 0.5) / 4} bands={BAND_COLORS.slice(0, 4)} className={scaleWidth(size)} />,
      };
    }
    case "sun": {
      const s = sunInfo(d);
      if (!s) return null;
      return {
        name: "Sole",
        value: (
          <>
            <span className="text-[0.6em] font-normal text-ink-muted">{s.next.type === "sunset" ? "Tramonto " : "Alba "}</span>
            {formatTime(s.next.time, tz)}
          </>
        ),
        note: `Tra ${formatDuration(s.inSeconds)} · ${formatDuration(s.daylightSeconds)} di luce`,
        figure: (size) => <SunArc progress={s.progress} isDay={s.isDay} className={size === "lg" ? "h-20 w-40" : "h-10 w-20"} />,
      };
    }
    case "moon": {
      const m = moonInfo(d);
      const rise = m.moonrise ? ` · sorge alle ${formatTime(m.moonrise, tz)}` : "";
      return {
        name: "Luna",
        value: m.name,
        note: `${Math.round(m.illumination * 100)}% illuminata${rise}${m.upcoming ? ` · ${m.upcoming.toLowerCase()}` : ""}`,
        figure: (size) => <MoonGlyph phase={m.phase} southern={m.southern} className={size === "lg" ? "size-28" : "size-10"} />,
      };
    }
    case "pressure": {
      const t = pressureTrend(d);
      return {
        name: "Pressione",
        value: (
          <>
            {Math.round(d.current.pressure)}
            <Unit>hPa</Unit>
          </>
        ),
        note: t ? `${TREND_WORDS[t.trend]} · ${formatSigned(t.change, "hPa")} in 6 h` : "Tendenza non disponibile",
        figure: t
          ? (size) => (
              <Sparkline values={t.series.map((p) => p.pressure)} minSpan={4} className={size === "lg" ? "h-16 w-44" : "h-8 w-20"} />
            )
          : undefined,
      };
    }
    case "visibility": {
      const v = visibilityInfo(d.current.visibility);
      return {
        name: "Visibilità",
        value: (
          <>
            {v.capped ? "10+" : v.km.toFixed(1)}
            <Unit>km</Unit>
          </>
        ),
        note: `${v.description} · nuvolosità ${Math.round(d.current.cloudCover)}%`,
        figure: (size) => <Scale position={Math.min(v.km, 10) / 10} className={scaleWidth(size)} />,
      };
    }
  }
}
