import { cityFacts } from "@/lib/city-facts";
import { placeHref } from "@/lib/place";
import { conditionLabel, formatTemp } from "@/lib/weather/formatters";
import { nearbyWeather } from "@/lib/weather/nearby";
import Link from "next/link";
import type { ReactNode } from "react";
import { Chapter } from "./Chapter";
import { WeatherIcon } from "./WeatherIcon";

const number = (n: number) => new Intl.NumberFormat("it-IT").format(n);
/** Wikidata's Italian labels keep common nouns lower case ("lago di Lugano"); as a name, it starts upper case. */
const asName = (s: string) =>
  s.charAt(0).toLocaleUpperCase("it-IT") + s.slice(1);

type Where = {
  lat: number;
  lon: number;
  name: string;
  /** The place's country, in Italian */ country?: string;
};

/* Hairline glyphs for the lists, drawn like the page's weather icons. */
function PlaceGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
    >
      <path d="M8 14.5s-4.5-4.2-4.5-7.6a4.5 4.5 0 0 1 9 0c0 3.4-4.5 7.6-4.5 7.6Z" />
      <circle cx="8" cy="6.8" r="1.6" />
    </svg>
  );
}
function WaterGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
    >
      <path d="M1.5 5.5c1.1-1 2.1-1 3.2 0s2.1 1 3.3 0 2.1-1 3.2 0 2.1 1 3.3 0" />
      <path d="M1.5 9c1.1-1 2.1-1 3.2 0s2.1 1 3.3 0 2.1-1 3.2 0 2.1 1 3.3 0" />
      <path d="M1.5 12.5c1.1-1 2.1-1 3.2 0s2.1 1 3.3 0 2.1-1 3.2 0 2.1 1 3.3 0" />
    </svg>
  );
}
function PeakGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M1 13.5 6 4.5l3 5.2 1.7-2.7 4.3 6.5Z" />
      <path d="m4.6 7 1.4.9 1.1-.9" />
    </svg>
  );
}

function AroundGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="6.2" strokeDasharray="1.6 2.3" />
      <circle cx="8" cy="8" r="1.6" />
    </svg>
  );
}

/** A row: a name, a figure flush right (a height, a temperature), a glyph before it; with `href`, the whole row is a link. */
type Item = {
  name: string;
  /** A small line over the name: what the place is to this one ("Capitale del paese") */
  kind?: string;
  figure?: string;
  icon?: ReactNode;
  href?: string;
  spoken?: string;
};

/** One list, set like the almanac: a glyph and a label, then a hairline row per name, its figure flush right. */
function List({
  title,
  Glyph,
  items,
}: {
  title: string;
  Glyph: typeof WaterGlyph;
  items: Item[];
}) {
  const row = "flex items-center justify-between gap-4 py-2.5";
  return (
    <div className="sheet min-w-0">
      <h3 className="label flex items-center gap-2 pb-1">
        <Glyph className="size-4 text-ink" />
        {title}
      </h3>
      <ul>
        {items.map((it) => {
          const content = (
            <>
              <span className="min-w-0 text-[0.9375rem]">
                {it.kind && (
                  <span className="block text-xs leading-tight text-ink-muted">
                    {it.kind}
                  </span>
                )}
                {it.name}
              </span>
              {(it.icon || it.figure) && (
                <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-ink-muted">
                  {it.icon}
                  {it.figure}
                  {it.spoken && <span className="sr-only">, {it.spoken}</span>}
                </span>
              )}
            </>
          );
          return (
            <li
              key={it.name}
              className="border-b border-white/10 last:border-b-0"
            >
              {it.href ? (
                <Link
                  href={it.href}
                  className={`${row} -mx-2 rounded-sm px-2 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent`}
                >
                  {content}
                </Link>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The chapter "Territorio": the place itself. Lists side by side where there
 * is room: what the place is (its rank, its altitude, how many live there),
 * its capitals, the towns around (the two best known, then the nearest) with their weather right now (each a link to
 * its own page), its waters (those it stands on, then the best-known lakes
 * around) and the best-known peaks around, with their heights. No distances. Async and cached, streamed in; a list with nothing
 * known is left out, and with nothing known at all there is no chapter.
 */
export async function Territory({ lat, lon, name, country }: Where) {
  const {
    rank,
    altitude,
    population,
    waters = [],
    peaks = [],
    nearby = [],
    capitals,
  } = await cityFacts(lat, lon, name);
  // The capitals, unless the place is one of them
  const capital = {
    region:
      capitals?.region && capitals.region.name !== name
        ? capitals.region
        : undefined,
    country:
      capitals?.country && capitals.country.name !== name
        ? capitals.country
        : undefined,
  };
  // The towns around and the capitals are named even when their weather can't be had.
  const listed = [
    ...nearby,
    ...[capital.region, capital.country].filter((c) => c !== undefined),
  ];
  const readings = await nearbyWeather(listed);
  const row = (
    town: { name: string; lat: number; lon: number },
    now: (typeof readings)[number],
    kind?: string,
  ): Item => ({
    name: town.name,
    kind,
    href: placeHref(town),
    figure: now ? formatTemp(now.temp) : undefined,
    icon: now && (
      <WeatherIcon
        condition={now.condition}
        night={now.night}
        colored
        className="size-5"
      />
    ),
    spoken: now
      ? conditionLabel({
          condition: now.condition,
          intensity: "moderate",
        }).toLowerCase()
      : undefined,
  });
  const around: Item[] = nearby.map((town, i) => row(town, readings[i]));
  const capitalRows: Item[] = [
    ...(capital.region
      ? [
          row(
            capital.region,
            readings[nearby.length],
            capitals?.regionName
              ? `Capoluogo, ${capitals.regionName}`
              : "Capoluogo",
          ),
        ]
      : []),
    ...(capital.country
      ? [
          row(
            capital.country,
            readings[nearby.length + (capital.region ? 1 : 0)],
            "Capitale del paese",
          ),
        ]
      : []),
  ];
  const place: Item[] = [
    ...(rank ? [{ name: rank }] : []),
    ...(altitude != null
      ? [{ name: "Altitudine", figure: `${number(altitude)} m s.l.m.` }]
      : []),
    ...(population
      ? [
          {
            name: "Abitanti",
            figure: `${number(population.count)}${population.year ? ` (${population.year})` : ""}`,
          },
        ]
      : []),
    ...(country ? [{ name: "Nazione", figure: country }] : []),
    ...capitalRows,
  ];
  const lists = [
    { title: "Il luogo", Glyph: PlaceGlyph, items: place },
    { title: "Dintorni", Glyph: AroundGlyph, items: around },
    {
      title: "Acque",
      Glyph: WaterGlyph,
      items: waters.map((w) => ({ name: asName(w) })),
    },
    {
      title: "Vette",
      Glyph: PeakGlyph,
      items: peaks.map((p) => ({
        name: asName(p.name),
        figure: p.elevation ? `${number(p.elevation)} m` : undefined,
      })),
    },
  ].filter((l) => l.items.length);
  if (!lists.length) return null;
  const columns = [
    "",
    "@lg:grid-cols-2",
    "@lg:grid-cols-2 @2xl:grid-cols-3",
    "@lg:grid-cols-2",
  ][lists.length - 1];
  return (
    <Chapter
      id="chapter-territory"
      title="Territorio"
      note={`${name}, i dintorni, le acque e le vette`}
      bare
    >
      <div className="@container reveal on-sky">
        <div className={`grid gap-2.5 ${columns}`}>
          {lists.map((l) => (
            <List key={l.title} {...l} />
          ))}
        </div>
      </div>
    </Chapter>
  );
}
