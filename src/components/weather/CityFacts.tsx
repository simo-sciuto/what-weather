import { cityFacts } from "@/lib/city-facts";
import { Chapter } from "./Chapter";

const number = (n: number) => new Intl.NumberFormat("it-IT").format(n);
/** Wikidata's Italian labels keep common nouns lower case ("lago di Lugano"); as a name, it starts upper case. */
const asName = (s: string) => s.charAt(0).toLocaleUpperCase("it-IT") + s.slice(1);

type Where = { lat: number; lon: number; name: string };

/* Hairline glyphs for the three lists, drawn like the page's weather icons. */
function PlaceGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
      <path d="M8 14.5s-4.5-4.2-4.5-7.6a4.5 4.5 0 0 1 9 0c0 3.4-4.5 7.6-4.5 7.6Z" />
      <circle cx="8" cy="6.8" r="1.6" />
    </svg>
  );
}
function WaterGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
      <path d="M1.5 5.5c1.1-1 2.1-1 3.2 0s2.1 1 3.3 0 2.1-1 3.2 0 2.1 1 3.3 0" />
      <path d="M1.5 9c1.1-1 2.1-1 3.2 0s2.1 1 3.3 0 2.1-1 3.2 0 2.1 1 3.3 0" />
      <path d="M1.5 12.5c1.1-1 2.1-1 3.2 0s2.1 1 3.3 0 2.1-1 3.2 0 2.1 1 3.3 0" />
    </svg>
  );
}
function PeakGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round">
      <path d="M1 13.5 6 4.5l3 5.2 1.7-2.7 4.3 6.5Z" />
      <path d="m4.6 7 1.4.9 1.1-.9" />
    </svg>
  );
}

type Item = { name: string; figure?: string };

/** One list, set like the almanac: a glyph and a label, then a hairline row per name, its height flush right. */
function List({ title, Glyph, items }: { title: string; Glyph: typeof WaterGlyph; items: Item[] }) {
  return (
    <div className="min-w-0">
      <h3 className="label flex items-center gap-2 pb-2">
        <Glyph className="size-4 text-ink" />
        {title}
      </h3>
      <ul className="border-t border-rule">
        {items.map((it) => (
          <li key={it.name} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
            <span className="min-w-0 text-[1.0625rem]">{it.name}</span>
            {it.figure && <span className="shrink-0 text-sm tabular-nums text-ink-muted">{it.figure}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The chapter "Territorio": the place itself, apart from the weather. Three
 * lists side by side where there is room: what the place is (its rank, its
 * altitude, how many live there), its waters (those it stands on, then the
 * best-known lakes around) and the best-known peaks around, with their
 * heights. No distances. Async and cached, streamed in; a list with nothing
 * known is left out, and with nothing known at all there is no chapter.
 */
export async function Territory({ lat, lon, name }: Where) {
  const { rank, altitude, population, waters = [], peaks = [] } = await cityFacts(lat, lon, name);
  const place: Item[] = [
    ...(rank ? [{ name: rank }] : []),
    ...(altitude != null ? [{ name: "Altitudine", figure: `${number(altitude)} m s.l.m.` }] : []),
    ...(population ? [{ name: "Abitanti", figure: number(population.count) }] : []),
  ];
  const lists = [
    { title: "Il luogo", Glyph: PlaceGlyph, items: place },
    { title: "Acque", Glyph: WaterGlyph, items: waters.map((w) => ({ name: asName(w) })) },
    {
      title: "Vette",
      Glyph: PeakGlyph,
      items: peaks.map((p) => ({ name: asName(p.name), figure: p.elevation ? `${number(p.elevation)} m` : undefined })),
    },
  ].filter((l) => l.items.length);
  if (!lists.length) return null;
  const columns = ["", "@lg:grid-cols-2", "@lg:grid-cols-2 @2xl:grid-cols-3"][lists.length - 1];
  return (
    <Chapter id="chapter-territory" title="Territorio" note={`${name}, le sue acque e le sue vette`}>
      <div className="@container reveal on-sky">
        <div className={`grid gap-8 @lg:gap-x-8 ${columns}`}>
          {lists.map((l) => (
            <List key={l.title} {...l} />
          ))}
        </div>
      </div>
    </Chapter>
  );
}
