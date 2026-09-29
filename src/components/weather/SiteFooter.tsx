import { formatTime } from "@/lib/weather/formatters";
import { Wordmark } from "../Wordmark";
import { MOCK_SCENARIOS } from "@/lib/weather/mock";
import type { WeatherProvider } from "@/lib/weather/provider";

type Source = { name: string; href: string };

const OPEN_METEO: Source = { name: "Open-Meteo", href: "https://open-meteo.com/" };
const OPENWEATHER: Source = { name: "OpenWeather", href: "https://openweathermap.org/" };
// Mapbox's terms ask for both credits: its maps are drawn from OpenStreetMap data.
const MAPBOX: Source = { name: "© Mapbox", href: "https://www.mapbox.com/about/maps/" };
const OSM: Source = { name: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" };

/**
 * Who the page's data comes from, worked out from what actually runs (the
 * weather provider, the OpenWeather key, the Mapbox token), so the credits
 * never name a service the page didn't use, nor leave one out.
 */
function credits(provider: WeatherProvider["name"], openWeatherKey: boolean, maps: boolean) {
  const weather = provider === "open-meteo" ? [OPEN_METEO] : provider === "mock" ? [] : [OPENWEATHER];
  // Open-Meteo finds places by name but can't name coordinates: OpenWeather does that when a key is set.
  const places = provider === "open-meteo" ? (openWeatherKey ? [OPEN_METEO, OPENWEATHER] : [OPEN_METEO]) : weather;
  return [
    { label: "Previsioni e aria", sources: weather },
    { label: "Luoghi", sources: places },
    // The clouds and rain drawn over the maps always come from Open-Meteo's grid.
    ...(maps
      ? [
          { label: "Mappe", sources: [MAPBOX, OSM] },
          { label: "Nuvole sulla mappa", sources: [OPEN_METEO] },
        ]
      : []),
  ].filter((c) => c.sources.length > 0);
}

/**
 * The page's colophon, set like its chapters: a hairline, the wordmark with
 * the time of the reading, then a credit per kind
 * of data, each naming and linking its source. With sample data it says so,
 * and lists the scenarios to try.
 */
export function SiteFooter({
  provider,
  openWeatherKey,
  maps,
  updatedAt,
  timezone,
  scenario,
  at,
}: {
  provider: WeatherProvider["name"];
  openWeatherKey: boolean;
  maps: boolean;
  updatedAt: number;
  timezone: string;
  scenario?: string;
  at?: string;
}) {
  const list = credits(provider, openWeatherKey, maps);
  const openMeteo = list.some((c) => c.sources.includes(OPEN_METEO));

  return (
    <footer className="sheet on-sky flex flex-col gap-7 pt-5 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <Wordmark className="text-3xl" />
        <p className="text-caption tabular-nums text-ink-muted">
          Aggiornato alle {formatTime(updatedAt, timezone)}, ora locale
        </p>
      </div>

      {provider === "mock" && (
        <div className="flex flex-col gap-2">
          <p className="label text-ink!">Dati di esempio</p>
          <nav aria-label="Scenari meteo di esempio" className="flex flex-wrap gap-x-3 gap-y-1">
            {MOCK_SCENARIOS.map((s) => (
              <a
                key={s}
                href={`/?mock=${s}${at ? `&at=${at}` : ""}`}
                aria-current={s === scenario ? "page" : undefined}
                className="label underline-offset-4 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline"
              >
                {s}
              </a>
            ))}
          </nav>
        </div>
      )}

      {list.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {list.map((c) => (
            <div key={c.label} className="min-w-0">
              <dt className="label">{c.label}</dt>
              <dd className="mt-1.5 flex flex-wrap gap-x-2 text-sm">
                {c.sources.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    rel="noopener"
                    className="underline decoration-white/35 underline-offset-4 transition-colors hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {s.name}
                  </a>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {openMeteo && (
        // Open-Meteo's licence (CC BY 4.0) asks for the credit, a link, and the licence named
        <p className="text-xs text-ink-muted">
          I dati di Open-Meteo sono distribuiti con licenza{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.it"
            rel="noopener"
            className="underline decoration-white/35 underline-offset-4 hover:text-ink hover:decoration-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            CC BY 4.0
          </a>
          .
        </p>
      )}
    </footer>
  );
}
