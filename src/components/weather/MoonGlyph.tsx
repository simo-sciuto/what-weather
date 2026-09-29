/**
 * The moon in its phase: an outer semicircle on the lit side, closed by the
 * terminator, an elliptical arc whose width follows the phase. Used in the
 * sky, the almanac and the moon card.
 */
function litPath(phase: number, r: number): string {
  const waxing = phase < 0.5;
  const crescent = phase < 0.25 || phase > 0.75;
  const rx = Math.abs(Math.cos(2 * Math.PI * phase)) * r;
  const outer = waxing ? 1 : 0;
  const terminator = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  return `M0,${-r} A${r},${r} 0 0 ${outer} 0,${r} A${rx},${r} 0 0 ${terminator} 0,${-r} Z`;
}

export function MoonGlyph({
  phase,
  southern,
  className,
  glow = false,
}: {
  phase: number;
  southern: boolean;
  className?: string;
  /** A soft halo, for the moon hanging in the sky */
  glow?: boolean;
}) {
  const r = 46;
  return (
    <svg viewBox="-50 -50 100 100" aria-hidden="true" className={className} overflow="visible">
      <defs>
        <radialGradient id="moon-shade" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="var(--moon-lit)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--moon-lit) 82%, #8a8f9c)" />
        </radialGradient>
        <radialGradient id="moon-halo">
          <stop offset="40%" stopColor="rgb(230 236 255 / 0.22)" />
          <stop offset="100%" stopColor="rgb(230 236 255 / 0)" />
        </radialGradient>
      </defs>
      {glow && <circle r={r * 2.4} fill="url(#moon-halo)" />}
      <circle r={r} fill="var(--moon-dark)" />
      {/* Seen from the southern hemisphere the moon is mirrored left–right */}
      <path d={litPath(phase, r)} fill="url(#moon-shade)" transform={southern ? "scale(-1,1)" : undefined} />
    </svg>
  );
}
