# ARCHITECTURE

Factual, from the code as of 2026-10-01. If code and this file disagree, the code wins: fix this file.

## Stack

Next.js 16.3.7 (App Router, `cacheComponents: true`), React 19.2, TypeScript 5, Tailwind CSS 4, Mapbox GL JS 3, Vitest 3 (unit), Playwright (e2e, drives the installed Chrome). Node >= 22. Deployed on Vercel. UI copy is Italian, code and comments are English.

Next.js here has breaking changes: read `node_modules/next/dist/docs/` before writing Next-specific code (see AGENTS.md).

## Data flow

```
URL (?lat&lon&name..), else a random city (src/lib/weather/random-places.ts); sample data: DEFAULT_PLACE (Milano)
  -> src/lib/weather-page.ts  loadWeatherPage()  -> weatherFor() -> load()   ["use cache", tag weather:lat,lon]
       -> getProvider()  (src/lib/weather/index.ts)
            openweather | openweather-free | open-meteo | mock     (each implements WeatherProvider)
       -> provider.getByCoords()  ->  WeatherData  (src/lib/weather/types.ts)
       + sinceYesterday()  (Open-Meteo, any provider)
       + lookupPollen()    (Open-Meteo air-quality, any provider, Europe only)
       -> buildTimeline(data)  (frames.ts)  ->  Timeline / Frame[]
  -> src/app/page.tsx (server component) -> client providers -> UI
```

Rules that hold today:
- Raw provider payloads never leave their adapter. Components read `WeatherData` or `Frame`.
- Units are fixed in `types.ts`: degC, km/h, hPa, km, mm/h, probabilities 0..1, times in Unix seconds UTC.
- Provider keys are server-only (`import "server-only"`). The only public env var is `NEXT_PUBLIC_MAPBOX_TOKEN`.

## Providers (`src/lib/weather/`)

| File | Source | Notes |
| --- | --- | --- |
| `openweather.ts` | One Call 4.0 (paid) + Air Pollution API | default when `OPENWEATHER_API_KEY` is set |
| `openweather-free.ts` | Current Weather + 5 day / 3 h forecast | coarser: 3-hourly points; daily is built from them, edge days flagged `partial` |
| `openmeteo.ts` | Open-Meteo forecast + air-quality | hourly, 8 days, UV, 15-minute precipitation; AQ index is computed here |
| `mock.ts` | deterministic scenarios | default with no key; `?mock=<scenario>&at=HH:MM`; also forced in dev when a valid scenario is in the URL |

`WEATHER_PROVIDER` picks explicitly. `transformers.ts` holds the OpenWeather raw -> normalized mapping.

Sources used regardless of provider: Open-Meteo for yesterday's comparison (`yesterday.ts`), pollen (`pollen.ts`), nearby towns (`nearby.ts`), the map's cloud grid (`cloud-grid.ts`). Mapbox + Wikidata for the "Territorio" chapter (`src/lib/city-facts.ts`).

## WeatherData and the timeline

- `WeatherData`: place, timezone (IANA or fixed offset), current, minutely (nullable), quarterHourly (nullable), hourly, daily, airQuality (nullable), alerts, pollen.
- Current/hourly data now carry optional atmospheric humidity, visibility and dew point, with per-field origin metadata. Samples/frames preserve missingness and interpolate only between available atmospheric endpoints; current-detail legacy defaults are excluded. `Frame.overview` marks synthetic daily representatives with `measured: false` (WTH-046C, 2026-10-04).
- `frames.ts` turns it into a `Timeline` of 100+ `Frame`s sent to the browser. A frame has `measured: boolean`: true for a provider point, false for an hour interpolated between two. Atmosphere (`visual-input.ts`), palettes, sun position and condition labels are derived client-side (`look.ts`, `palette.ts`, `state.ts`) to keep the payload small.
- Pure logic with tests: `narrative.ts` (the outlook sentence), `activities.ts`, `best-window.ts`, `palette.ts`, `precipitation.ts`, `pollen.ts`, `sun-position.ts`, `formatters.ts`, `yesterday.ts`, `map-style.ts`, `map-view.ts`, `map-options.ts`.

The palette now exposes `solarPalette(light): SolarPalette` (WTH-046D): the unchanged natural-light anchors/interpolation, before weather, UV, contrast protection and map inks. Its -1..2 phase input is distinct from 0..1 atmospheric daylight.

The palette has two ways of weathering that base, sharing one finish (`finishPalette`: text protection, glass, markers, map inks). The page's is `atmospherePalette` (WTH-046E, section 6) = `atmosphereSky` (bounded OKLCH transforms of the normalized `AtmosphereAxes`) + finish, called by `frameLook` for every frame since WTH-046L: it draws from the weather's continuous axes, with continuous gamut reduction and text protection, and carries `air` (the weather's say on the map: plane weights, saturation, ground lift, depth) so the page's map, the viewer's tuned map and the poster draw one weather. The other, `skyPalette` = `stateSky` (WeatherState grey/dim, UV vividness) + finish, is no longer used by the page: it stays as the dev-only lab's "Oggi" reference and in tests.

## Caching

- `load()` in `weather-page.ts` is the single cached unit per place: `"use cache"`, coordinates rounded to 2 decimals (~1 km, `COORD_PRECISION`), `cacheLife` revalidate 600 s, expire 3600 s, stale 300 s. Mock uses `cacheLife("seconds")`.
- The page, `generateMetadata`, `/api/og`, `/api/summary` all go through `weatherFor()` so they share one entry.
- Other cached units: place search (`/api/places`, 1 day revalidate), cloud grid (1 h), nearby towns, city facts.
- Constants live in `src/lib/weather/constants.ts`.

## Routes

| Route | Purpose |
| --- | --- |
| `/` (`src/app/page.tsx`) | the poster page; server component, reads searchParams |
| `/lab/atmosfera` | dev-only calibration lab for the Weather Visual Engine (both palette engines over the calibration scenarios); `notFound()` in production |
| `/api/places` | place search, runs server-side so keys stay hidden |
| `/api/summary` | small summary for a saved place's card |
| `/api/clouds` | cloud and precipitation grid for the map animation |
| `/api/og` | share image (ImageResponse) for a place |
| `manifest.ts`, `error.tsx`, `loading.tsx` | PWA manifest, error and loading states |

## Client state (`src/components/`)

No state library. React contexts and external stores:
- `time/TimeContext.tsx`: three contexts at different paces (Timeline fixed per place, View = next 24 h or one picked day, Moment = hour on show). The page remounts the provider with `key={lat,lon}` on a new place.
- `location/PlaceContext.tsx`, `weather/MapContext.tsx`.
- localStorage (guarded, exposed as external stores): saved places (`lib/saved-places.ts`), recent places, map tuning (`lib/map-tuning.ts`, key `weather:map-hue`), map layer options (`lib/map-options.ts`).
- No place cookie: a bare address draws a random city (ADR-010); `/api/random-place` draws one from the whole world for the "Città casuale" button.

## UI structure

- `app/page.tsx` composes: `Sky` (palette background), `MapBackdropGL` (fixed Mapbox city behind the page), `WeatherHero` (the poster reading), `TimeScrubber`, then chapters: urgent items (alerts, precipitation, promoted details), `Activities`, week (`DailyForecast`), map (`MapView`, only with a Mapbox token), details (`Almanac`), `Territory` (streamed in `Suspense`), `SiteFooter` (lists sources actually in use).
- Desktop: hero pinned left, chapters scroll right. Phone: the reading is the first screen.
- `components/poster/`: the downloadable poster (canvas render).

## Tests

- Unit: `src/**/*.test.ts` (Vitest, node env, `server-only` stubbed).
- E2E: `e2e/*.spec.ts`, built with `WEATHER_PROVIDER=mock` and no Mapbox token, port 3100. Desktop and phone (Pixel 7) projects.
- Commands: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.
