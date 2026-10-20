import { cityFacts } from "@/lib/api/sources/city-facts";

const metres = new Intl.NumberFormat("it-IT");
const people = new Intl.NumberFormat("it-IT", { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 });

/**
 * The place's identity in one short line under its name, from the facts Territorio already holds (`cityFacts`, cached:
 * the same entry, no second call): what rank of place it is, its altitude, how many live there. Whatever is not
 * known is left out, and with nothing known there is no line. Streamed in beside the reading.
 */
export async function TerritoryLine({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  // A line of small print: if the facts do not come, there is no line, and the page is none the worse
  const facts = await cityFacts(lat, lon, name).catch(() => null);
  if (!facts) return null;
  const { rank, altitude, population } = facts;
  const parts = [
    rank,
    altitude != null ? `${metres.format(altitude)} m s.l.m.` : undefined,
    population ? `${people.format(population.count)} di abitanti` : undefined,
  ].filter((p): p is string => Boolean(p));
  if (!parts.length) return null;
  return (
    <p data-territory-line className="on-sky text-caption text-ink-muted">
      {parts.join(" · ")}
    </p>
  );
}
