"use client";

import type { CSSProperties } from "react";
import { useMoment } from "../time/TimeContext";

/**
 * The page background, fixed behind everything. It is drawn from the data of
 * the moment on show (now, or wherever the scrubber is):
 *  - the light source sits where the sun actually is (a soft moonlight at night, no disc);
 *  - the number and density of clouds follow the real cloud cover;
 *  - snow falls with a density that follows millimetres per hour (rain is left out for now);
 *  - stars only show through a clear night sky.
 * Purely decorative; everything it shows is also stated in text.
 */

/** Cloud masses, added in order as cover grows. */
const CLOUDS = [
  { left: "-12%", top: "4%", width: "62%", height: "24%" },
  { left: "48%", top: "10%", width: "62%", height: "22%" },
  { left: "10%", top: "22%", width: "70%", height: "20%" },
  { left: "-20%", top: "34%", width: "60%", height: "18%" },
  { left: "55%", top: "38%", width: "60%", height: "18%" },
  { left: "15%", top: "52%", width: "80%", height: "20%" },
];

const FOG_BANDS = [
  { left: "-30%", top: "34%", width: "160%", height: "14%" },
  { left: "-20%", top: "56%", width: "140%", height: "16%" },
  { left: "-30%", top: "76%", width: "160%", height: "14%" },
];

/** mulberry32: integer-only, so server and browser produce identical numbers. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed star field (the same markup on server and client, so hydration matches). */
const STARS = (() => {
  const rand = seeded(7);
  return Array.from({ length: 60 }, () => ({
    left: `${(rand() * 100).toFixed(2)}%`,
    top: `${(rand() * 64).toFixed(2)}%`,
    size: rand() > 0.85 ? 2 : 1,
    delay: `${(-rand() * 5).toFixed(2)}s`,
  }));
})();

/** When the provider reports a wet sky but no amount, a typical rate for it (mm/h). */
const TYPICAL_RATE = { drizzle: 0.3, rain: 1.5, thunderstorm: 8, snow: 1 } as const;

export function Sky() {
  const { frame, look } = useMoment();
  const night = frame.phase === "night";
  const cover = Math.min(Math.max(frame.cloudCover / 100, 0), 1);

  // The light source travels an arc: left at sunrise, high at noon, right at sunset.
  // At night only the moon's light shows, resting high on the right (the moon itself is in the details).
  // Rounded: the position comes from a sine, whose last digits differ between the server's
  // JavaScript engine and the browser's, and would otherwise break hydration.
  const x = Math.round((night ? 76 : 12 + 76 * look.sky.progress) * 100) / 100;
  const y = Math.round((night ? 16 : 66 - 56 * Math.max(look.sky.elevation, 0)) * 100) / 100;

  const wet = frame.condition in TYPICAL_RATE;
  const rate = Math.max(frame.precipitation, wet ? TYPICAL_RATE[frame.condition as keyof typeof TYPICAL_RATE] : 0);
  const heavy = frame.intensity === "heavy" ? 2 : 1;
  const mm = rate * heavy;
  const snowing = frame.condition === "snow";
  const clouds = cover < 0.08 ? 0 : Math.ceil(cover * CLOUDS.length);

  return (
    // Above the gradient (.atmosphere::before, z -2), level with the map that follows it in the markup
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-1 overflow-hidden">
      {/* Clouds dim the light; a clear sky lets it bloom */}
      <div
        className="sky-glow"
        style={{ "--glow-x": `${x}%`, "--glow-y": `${y}%`, opacity: 1 - cover * 0.6 } as CSSProperties}
      />

      {night && cover < 0.75 && (
        <div style={{ opacity: (1 - cover) ** 1.5 }}>
          {STARS.map((s, i) => (
            <span
              key={i}
              className="star"
              style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }}
            />
          ))}
        </div>
      )}

      <div style={{ opacity: 0.45 + cover * 0.55 }}>
        {CLOUDS.slice(0, clouds).map((c, i) => (
          <div
            key={i}
            className="cloud"
            style={{ left: c.left, top: c.top, width: c.width, height: c.height, animationDelay: `${-i * 11}s` }}
          />
        ))}
        {frame.condition === "fog" &&
          FOG_BANDS.map((c, i) => (
            <div
              key={`fog-${i}`}
              className="cloud"
              style={{ left: c.left, top: c.top, width: c.width, height: c.height, animationDelay: `${-i * 15}s` }}
            />
          ))}
      </div>

      {snowing && (
        <div
          className="snow"
          style={{ "--snow-scale": `${Math.max(0.45, 1 / Math.sqrt(1 + mm))}` } as CSSProperties}
        />
      )}
    </div>
  );
}
