import type { Condition } from "@/lib/weather/types";

/**
 * Weather glyphs on a 32-unit grid, decorative: the condition is always also
 * given as text. Two looks: hairline in `currentColor` (large, on the sky), or
 * `colored` — filled sun, cloud, drops — for small sizes, where a hairline sun
 * and a hairline cloud are hard to tell apart. Colours live in globals.css
 * (the `wi-*` classes), keyed on each part's role.
 */

type Glyph = "sun" | "moon" | "partly-day" | "partly-night" | "cloud" | "fog" | "drizzle" | "rain" | "storm" | "snow";

function glyphFor(condition: Condition, night = false): Glyph {
  switch (condition) {
    case "clear":
      return night ? "moon" : "sun";
    case "partly-cloudy":
      return night ? "partly-night" : "partly-day";
    case "cloudy":
      return "cloud";
    case "fog":
      return "fog";
    case "drizzle":
      return "drizzle";
    case "rain":
      return "rain";
    case "thunderstorm":
      return "storm";
    case "snow":
      return "snow";
  }
}

const CLOUD = "M9.5 24h13a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 8.8 15.2 4.4 4.4 0 0 0 9.5 24Z";
const SMALL_CLOUD = "M11 25h11.5a4.5 4.5 0 0 0 .4-8.98A6.2 6.2 0 0 0 11 17.4 3.8 3.8 0 0 0 11 25Z";
const CLOUD_HIGH = "M9.5 19h13a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 8.8 10.2 4.4 4.4 0 0 0 9.5 19Z";

function Sun({ cx = 16, cy = 16, r = 5.5, rays = 4 }: { cx?: number; cy?: number; r?: number; rays?: number }) {
  const angles = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <g className="wi-sun">
      <circle cx={cx} cy={cy} r={r} />
      {angles.map((a) => (
        <line
          key={a}
          x1={cx + Math.cos(a) * (r + 3)}
          y1={cy + Math.sin(a) * (r + 3)}
          x2={cx + Math.cos(a) * (r + 3 + rays)}
          y2={cy + Math.sin(a) * (r + 3 + rays)}
        />
      ))}
    </g>
  );
}

const MOON = "M21.5 20.6A8.5 8.5 0 0 1 12.4 7a8.5 8.5 0 1 0 12.6 11.2 8.4 8.4 0 0 1-3.5 2.4Z";

/**
 * Hides whatever sits behind the small cloud, so the icon works on any
 * background (glass, sky) without painting a fill colour. Every instance
 * defines the same mask, so a shared id is harmless.
 */
function CloudCutout() {
  return (
    <mask id="wi-cloud-cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
      <rect width="32" height="32" fill="white" />
      <path d={SMALL_CLOUD} fill="black" stroke="black" strokeWidth={3} />
    </mask>
  );
}

function Lines({ from, count, dy = 0, slant = 1.5, len = 4 }: { from: number; count: number; dy?: number; slant?: number; len?: number }) {
  return (
    <g className="wi-drop">
      {Array.from({ length: count }, (_, i) => {
        const x = from + i * 5;
        return <line key={i} x1={x} y1={22 + dy} x2={x - slant} y2={22 + dy + len} />;
      })}
    </g>
  );
}

function paths(glyph: Glyph) {
  switch (glyph) {
    case "sun":
      return <Sun />;
    case "moon":
      return <path className="wi-moon" d={MOON} />;
    case "partly-day":
      return (
        <>
          <CloudCutout />
          <g mask="url(#wi-cloud-cutout)">
            <Sun cx={12} cy={11} r={4} rays={2.5} />
          </g>
          <path className="wi-cloud" d={SMALL_CLOUD} />
        </>
      );
    case "partly-night":
      return (
        <>
          <CloudCutout />
          <path
            className="wi-moon"
            mask="url(#wi-cloud-cutout)"
            d="M16.5 13.2A5.8 5.8 0 0 1 10.3 4a5.8 5.8 0 1 0 8.6 7.6 5.7 5.7 0 0 1-2.4 1.6Z"
          />
          <path className="wi-cloud" d={SMALL_CLOUD} />
        </>
      );
    case "cloud":
      return <path className="wi-cloud" d={CLOUD} />;
    case "fog":
      return (
        <>
          <path className="wi-cloud" d={CLOUD_HIGH} />
          <g className="wi-mist">
            <line x1={6} y1={23} x2={26} y2={23} />
            <line x1={9} y1={27} x2={23} y2={27} />
          </g>
        </>
      );
    case "drizzle":
      return (
        <>
          <path className="wi-cloud wi-wet" d={CLOUD_HIGH} />
          <Lines from={12} count={3} len={2} slant={0.7} />
        </>
      );
    case "rain":
      return (
        <>
          <path className="wi-cloud wi-wet" d={CLOUD_HIGH} />
          <Lines from={11.5} count={3} />
        </>
      );
    case "storm":
      return (
        <>
          <path className="wi-cloud wi-wet" d={CLOUD_HIGH} />
          <path className="wi-bolt" d="M17 20.5 13.5 25.5h4l-2.5 4.5" />
        </>
      );
    case "snow":
      return (
        <>
          <path className="wi-cloud" d={CLOUD_HIGH} />
          {[11, 16, 21].map((x, i) => (
            <circle key={x} className="wi-flake" cx={x} cy={i === 1 ? 26 : 23.5} r={0.9} fill="currentColor" />
          ))}
        </>
      );
  }
}

export function WeatherIcon({
  condition,
  night = false,
  className,
  strokeWidth = 1.25,
  colored = false,
}: {
  condition: Condition;
  night?: boolean;
  className?: string;
  strokeWidth?: number;
  colored?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`${colored ? "wi-color" : ""} ${className ?? ""}`}
    >
      {paths(glyphFor(condition, night))}
    </svg>
  );
}
