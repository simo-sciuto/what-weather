# ARCHITECTURE

Status: target architecture of the atmospheric atlas (ADR-030), from the `architect` agent, 2026-10-20 (WTH-339), checked against the code at `a08157c`. The code today is the Tavola app (ADR-029 D3) plus the Atlas at `/atlas` (ADR-019 to ADR-026); the description of that code is `archive/ARCHITECTURE_tavola.md` until the old tree is deleted (WTH-348). ROADMAP.md says which checkpoint brings each part.

## 1. Core: what stays (verified at `a08157c`)

### Providers and WeatherData (ADR-001 to ADR-006)
- `src/lib/api/providers/provider.ts`: `WeatherProvider { name; getByCoords; searchPlaces }`, `HistoricalProvider { getAt }`; `get-provider.ts` (`getProvider`, `getHistoricalProvider`; with no `WEATHER_PROVIDER`, `openweather` when a key is set, else `mock`).
- `src/types/weather.ts`, `src/types/timeline.ts` (`Frame`, `Timeline`). `Frame.timeLabel` and `isNow` are baked in when cached: labels for an instant come from `momentLabels`.
- `src/lib/weather-page.ts`: private `"use cache"` `load(lat, lon, scenario, at)` keyed without names (ADR-029 item 8, stands); `weatherFor(ref, scenario?, at?)` is the one entry. `loadWeatherPage`, `landingPlace`, `Landing` go with the old home.
- `roundCoord` (`coordinates.ts`) and `cellOf` (`src/lib/atlas/cell.ts`): the shared cache key.
- `frames.ts` and its imports (`best-window`, `days`, `moments`, `state`, `sun`, `atmospheric-data`, `formatters`); `activities.ts` and `best-window.ts` feed the verdict.
- Production source: Open-Meteo by configuration, because the field is always Open-Meteo and the reading under the crosshair must not come from another source (ADR-005's reasoning). Today `get-provider.ts` still picks `openweather` when its key is set; the switch is configuration. Lost: OpenWeather's alerts and its minute-by-minute rain (Open-Meteo keeps `minutely_15`), WTH-356; place naming still calls OpenWeather when its key is present (WTH-188).
- `HistoricalProvider` and `openmeteo-archive.ts` stay in code with no caller (ADR-016).

### Colour engine, the only identity (ADR-007, ADR-011, ADR-012, ADR-026)
- Atmosphere: `atmosphere.ts`, `visual-input.ts`, `atmospheric-data.ts`, `palette.ts` (`atmospherePalette`, `mapVisualState`, `mapInksFor`), `look.ts` (`frameLook`), `src/types/palette.ts`.
- Temperature: `temp-color.ts` (`tempColor`, `tempAccent`, `tempGradient`).
- Field: `src/lib/atlas/field-color.ts` (`fieldColor`), which deliberately bypasses `atmospherePalette`.
- Regression net: `calibration.ts`, its invariants, `/lab/atmosfera`. CSS: `@property --sky-1..3`, `.atmosphere`.
- Places that compute colour on the server against ADR-007 and stay: the point route (`frameLook(frames[0])`) and the field route (`fieldColor`). Both move to the client when time arrives (section 3).

### Map style
- `src/components/weather/map-style.ts` (`STYLE`, `syncMap`, `OPTION_LAYERS` with relief and contours, `activeLayers`) moves to `src/lib/map/map-style.ts` (WTH-340).
- `src/lib/map-options.ts`, `src/lib/map-tuning.ts`: used by the Atlas's map panel; whether the tuning UI survives is a UX decision (WTH-346).

### Atlas (ADR-019 to ADR-026), built
- Time: `src/types/time.ts`, `instant.ts` (`resolveInstant`, `resolveSelection`, `momentLabels`), `clock.ts`; from ADR-028 C1 `moment-address.ts` (`readMoment`, `selectionOfAddress`, `withMoment`; `NOW_SELECTION` moves next to `instant.ts`).
- Camera and settle: `settle-controller.ts`, `mapbox-camera-port.ts`, `fake-camera-port.ts`, `center.ts`, `cell.ts`, `flight.ts`, `QUIET_MS` and `POINT_MIN_INTERVAL_MS` (provisional).
- Point: `engine.ts` (`createAtlasEngine`), `point-client.ts`, `/api/atlas/point`. `AtlasPoint` is `{ cell, place, sky, timezone, provider, time, temp, label, condition, night }`, "now" only.
- Sky: `sky.ts` (`skyFor`, `skyWeight`), `SkyDriver`, `useRestingZoom`, `atlas-look.ts`.
- Names: `reverse-geocode.ts`, `place-label.ts` (free points are named by zoom, ADR-024).
- Field: `lattice.ts`, `field-loader.ts`, `field-image.ts`, `field-color.ts`, `sources/weather-field.ts`, `/api/atlas/field`, `WeatherFieldLayer` (up to 48 places, about 48 Open-Meteo calls per fresh lattice, "now" only).
- Shell: `app/atlas/layout.tsx` with `AtlasShell` (map made once, camera out of React), `AtlasMap`, `Crosshair`, `CenterReadout`, `PointReading`, `AtlasSearch`, `AtlasMapPanel`.
- Tests: `atlas-test.ts`, `e2e/atlas.spec.ts` (33), `atlas-phone.spec.ts` (5).

### Place facts and search
- `/api/places`, `lib/api/places.ts`, `lib/place.ts` (`parsePlaceRef`, `placeQuery`, `placeHref`; `createHref` goes).
- `sources/city-facts.ts`: its Wikidata knowledge feeds the extract scripts.

## 2. What goes

### Move first (WTH-340, no visible change)
| Today | Needed by | Move to |
| --- | --- | --- |
| `components/weather/map-style.ts` | `AtlasMap`, `atlas-look` | `src/lib/map/map-style.ts` |
| `MapPanelContent`, `useResetMap`, `RESET_LINK` in `components/weather/MapControls.tsx` | `AtlasMapPanel` | `components/atlas/MapPanel.tsx` |
| `SearchIcon` in `LocationSearch.tsx` | `AtlasSearch` | a small icons module |
| `weatherCredit` in `lib/record/credits.ts` | `TavolaPage` today, the attribution later | `src/lib/credits.ts` |
| `airIndexOf` in `lib/weather/details.ts` | `openmeteo.ts` | `lib/weather/air-quality.ts` (its test already has that name) |
| `NOW_SELECTION` in `moment-selection.ts` | `moment-address.ts` | next to `instant.ts` |

Done 2026-10-20 (WTH-340): `map-style.ts` is `src/lib/map/map-style.ts`; `MapPanelContent`, `useResetMap`, `RESET_LINK`, `useMapTuning`, `useMapOptions` are `components/atlas/MapPanel.tsx` (re-exported by `MapControls.tsx` for the old home); `SearchIcon` is `components/icons/SearchIcon.tsx`; `weatherCredit` is `src/lib/credits.ts`; `airIndexOf` and the pollutant bands are `lib/weather/air-quality.ts`; `NOW_SELECTION` is in `instant.ts`. `GLASS` stays in `components/layout/glass.ts` until WTH-342.

### At the cutover (WTH-347)
Remove `AtlasDock` from `AtlasShell`, the "Crea il poster" and "Il meteo del luogo" links from `PointReading`, `WordmarkLink`; move `/atlas/persistence-check` into the group.

### Deleted once, after the cutover (WTH-348)
Not before: on this branch the poster is wired into the Tavola (`CreaSection`, `KeepPanel`, `kept-record.ts`), so deleting it first would mean rewriting a superseded UI.

- App: `src/app/crea/`, `src/app/lab/record/`, `src/app/api/{summary,random-place,clouds}/` (`/api/og` to decide).
- Tavola and sections: `components/{tavola,nav,bar}/`, `lib/sections.ts`, the `.dock*` CSS once the LayerSwitch has its own.
- Create, Keep, poster, record: `components/{create,keep,poster,record}/`, `lib/{keep,record}/`, `RecordLab.tsx`, `scripts/record/`, `public/fonts/record/`, `lib/weather/{fingerprint,typography}.ts`, `constants/map.ts`. The browsers' `weather:kept` and `weather:saved-places` are simply no longer read.
- Explainer and analytics: `components/{explainer,analytics}/`, `lib/{explainer,analytics}/` (a placeholder with no service; any measurement of the atlas is a new decision).
- Old home: `components/weather/*` except the moved `map-style.ts` and the kept `WeatherIcon` and `Disclosure`; `components/{time,location}/*`; `components/layout/glass.ts` only once WTH-342's tokens have replaced it in `AtlasMapPanel`.
- Lib modules only the old home uses: `narrative`, `precipitation`, `details`, `moon`, `today`, `curve`, `cloud-render`, `pollutants`, `bloom`, `random-places`, `random-city`, `moment-selection`, `moment`, `moment-keys` (after the TimeBar takes what it needs), `moment-label`, `resolveAddressMoment`, `yesterday`, `saved-places`, `recent-places`, `lib/api/{summary,random-place,clouds}.ts`, `sources/{cloud-grid,nearby,random-city}.ts`, `city-facts.ts` after the extract scripts copy its queries, `map-view.ts`.
- e2e: `tavola`, `create`, `create-moment`, `path`, `explainer`, `phone`, `reading`, `timeline`, `week`, `details`, `activities`, `places`. The atlas specs stay with new paths.
- Kept: `days`, `moments`, `best-window`, `activities`, `state`, `sun`, `sun-position`, `conditions`, `formatters`, `regions`.
- To decide in the design pass: `/api/og` and metadata for a shared point, `Sky.tsx` with `bloom.ts`, `WeatherAlert`.

## 3. The app

### Routes
- `/` becomes the atlas through a route group `src/app/(atlas)/` (layout with `AtlasShell`, ADR-021; page with the sr-only content). Next docs (`route-groups.md`): two groups may not resolve to one path, so `app/page.tsx` is removed in the same commit. Labs stay outside the group.
- `/atlas` and `/crea` redirect in `next.config.ts` (query passed through, `redirects.md`).
- URL: `/?lat=45.07&lon=7.69&t=1792500000&strato=percorsi&sel=osm:r123456`. A stop replaces the address, a search pushes it (as today, through the router; cheap because the page renders no weather, ADR-022).

| Route | State | Returns | Cache |
| --- | --- | --- | --- |
| `GET /api/atlas/point?lat&lon` | exists | `AtlasPoint`; WTH-343 adds `frames` | the `weatherFor` entry; header `max-age=300`, `s-maxage` only after verifying Vercel (WTH-349) |
| `GET /api/atlas/field?west&south&east&north` | exists | `WeatherField` now; WTH-345 adds hourly values | `use cache` per lattice, 15 min |
| `GET /api/places` | exists | places | 1 day |
| `GET /api/atlas/spot?lat&lon&ele` | new (WTH-352) | point weather at elevation | cell plus 100 m band |
| `GET /api/atlas/facts/:id` | new (WTH-351) | card facts from the extract | static |
| `GET /api/atlas/route/:id/outlook` | new (WTH-354) | per-sample forecasts for a route | keyed on the route id only |

With `cacheComponents` a handler that reads the request runs at request time; caching is a `"use cache"` helper it calls, as both existing routes do. How Vercel's edge treats `max-age` without `s-maxage` is not in the Next docs: to verify.

### Shell
Built: map, crosshair, coordinates, point reading with status and "Riprova", search with flight, map panel, field note, Mapbox attribution. To add: time bar, layer switch, card slot (sheet on a phone, panel on a desktop), data attribution, a segment `error.tsx` under the group.

### Client state (no library, ADR-008)
| State | Holder | Status |
| --- | --- | --- |
| Camera | Mapbox and `CameraPort` | built |
| Atlas status and point | `createAtlasEngine` snapshot | built |
| Field | `createFieldLoader` in `WeatherFieldLayer` | built; a small store when time arrives |
| Sky | `SkyDriver` | built; becomes a function of point, zoom and instant |
| Time | `timeStore` (`TimeSelection`) and `createClock` | new (WTH-343) |
| Layer | URL `strato` mirrored in a store | new (WTH-346) |
| Selection | `selectionStore` | new (WTH-351); never moves the camera |
| Map look | `map-tuning`, `map-options` | built |

Two rules: the time bar never asks the server while scrubbing (point frames and hourly field values are already on the client); a change of instant never changes camera, layer or selection.

### The colour engine feeds map and UI

Built today:
```
stop -> /api/atlas/point -> AtlasPoint.sky (frameLook on the server)
     -> skyFor(point, restingZoom) -> paletteVars -> CSS --sky-1..3, glass, glow, sun, cloud
                                   -> mapInksFor(sky2, tuning, layers, air) -> syncMap
stop -> /api/atlas/field -> colours (fieldColor on the server) -> interpolateField -> raster under 0.9, over 0.38
```

Target, with time:
```
AtlasPoint.frames --resolveSelection--> Frame | unavailable
  Frame --frameLook (client)--> palette --skyFor(zoom)--> sky
    sky --uiTokens(sky, fieldInView)--> CSS variables (one writer, WTH-262)
    sky --mapInksFor--> syncMap (sun at the instant and the point, not Torino now)
field.hourly[instant] --fieldColor (client)--> interpolateField --> raster
unavailable --> previous colours kept and marked, "Colori non disponibili per quest'ora"
```

Until the hourly field exists, a chosen instant shows the field labelled "adesso" (ADR-030). Routes, peaks and population become `MapLayer` members (ADR-011) stacked above the field's tint (WTH-350).

## 4. Regional data: pre-built extracts

Region box 5.8 to 9.6 E, 43.7 to 46.6 N. It also holds western Lombardy (Milano, Varese, Como, Lago Maggiore) and Ticino, and only part of Hautes-Alpes and Alpes-de-Haute-Provence: the wording, or the east edge, is the user's to settle. Outside it the weather works; Territorio and Percorsi say "per ora Piemonte e Alpi occidentali".

Why extracts: the public Overpass asks for well under 10,000 queries a day for a whole app, Vercel's egress IPs are shared, Wikidata gives a client 60 s of processing a minute. A monthly extract makes about ten queries.

- Scripts `scripts/atlas/extract/{overpass,wikidata,elevation,build}.mjs`, run by hand about monthly from a machine with network access (this cloud environment has none for these hosts).
- `data/atlas/*.json` (peaks, lakes, municipalities, route summaries with samples), estimated 2 to 4 MB.
- Route geometry as a Mapbox tileset (secret token only in the script, ADR-002), fallback GeoJSON chunks in 0.5° buckets. Tiling Service cost to verify.
- Sources: OSM `natural=peak` with names and `ele` (8,000 to 15,000 in the box) and Wikidata `Q8502` facts through the `wikidata` tag; lakes from Mapbox `water` and Wikidata `Q23397`; rivers from OSM `waterway=river` relations and Wikidata `P2043`, `P885`, `P403`; municipalities `Q747074`, `Q484170`, `Q70208` with `P1082` and its date; routes from OSM `type=route` with `route=hiking|foot` (keep `name`, `ref`, `network`, `operator`, `osmc:symbol`, `cai_scale`, `ref:REI`, `distance`, `ascent`, `descent`, `roundtrip`, `from`, `to`, `wikidata`; `sac_scale` is on the member ways, kept as `sacScaleMax`, shown apart from `cai_scale`); sample elevation from the Open-Meteo Elevation API (Copernicus DEM 90 m) or the OSM `ascent`. QIDs to verify in the spike.
- `RouteSummary { id, name, ref?, network, operator?, caiScale?, sacScaleMax?, osmcSymbol?, lengthKm, ascentM?, descentM?, eleMin, eleMax, roundtrip, samples }`, at most 10 `RouteSample { km, lat, lon, ele, kind }`.
- Calls: Open-Meteo counts one call per location, and fractionally more above 10 variables. Points (about four calls per fresh `load()`), field (about 48 per fresh lattice), spots and routes (one per sample) share 10,000 a day: measured in WTH-341 with WTH-269.
- Licences: OSM ODbL (the extract is published with its script); Open-Meteo CC BY 4.0 next to the data; Wikidata CC0; Wikipedia linked only; Mapbox terms; Copernicus DEM wording to verify. LICENCES.md updated in WTH-341.

## 5. "È un buon momento per andarci?"

```
tap route -> GET /api/atlas/route/:id/outlook          (cache key: the route id)
  RouteSummary samples (with elevation)
  -> sources/route-weather.ts: one Open-Meteo request for all samples with elevation, 72 h hourly
  -> normalized per-sample forecasts (raw payload stays in the adapter, ADR-001)
  <- summary, per-sample hourly series, sun times, provenance, model time
client: routeOutlook(summary, forecasts, departure = the time bar's instant)   (pure, lib/weather/route-outlook.ts)
  -> RouteOutlook { verdict, bestDeparture?, limiting?, perSample, notEvaluated, uncertainty, provenance }
```

- The verdict is computed on the client for the instant, from data cached per route: scrubbing never asks the server (the same split as frames and `frameLook`).
- Walking time DIN 33466 (4 km/h flat, 300 m/h up, 500 m/h down); each sample judged at the hour it is reached; departures hourly 05:00 to 14:00; nearest forecast hour within 30 minutes; "percorrenza stimata".
- Scoring: `outdoorFactors` (`hike`) plus hard mountain limits (thunderstorm codes 95 to 99 or high CAPE; freezing level below the highest point plus 300 m; strong gusts at high samples; low cloud on high samples; arrival after sunset minus 30 minutes). The worst sample decides. A peak is the same flow with one sample.
- For `weather-data`: Open-Meteo's gusts are a 10 m value at the model's grid elevation and `elevation` downscales temperature only, so ridge wind is an estimate (a pressure-level wind may be needed), always labelled "stimato in quota". Thresholds are signed off by `weather-data` before WTH-354.
- Honesty rules (testable): four verdicts, never "sicuro"; a verdict only within 48 h, indicative to 72 h, none beyond; a missing variable is "non valutato", never favourable; storms as a time window; a low freezing level says "possibile neve o ghiaccio in quota", never infers snowpack; avalanches, trail condition and closures out of scope and linked (AINEVA, Météo-France BERA, SLF); CAI or SAC difficulty a fact, never part of the verdict; provenance names source, model, forecast time, requested and model elevation; route data says its extract date.

## 6. Risks

- High: the verdict read as a safety promise (section 5); Open-Meteo's daily calls shared by points, field, spots and routes; ODbL share-alike on the extract (published); light ink over a bright field (WTH-277).
- Medium: Mapbox loads and Tiling Service cost; mobile GPU with hillshade, field and thousands of lines; Vercel edge caching; OSM route quality in France and Switzerland, thin city routes; e2e coverage during the deletion.
- Low: transition clocks (WTH-270); `Frame.measured` naming (WTH-221).

## 7. Next docs read and not read

Read by the architect: route groups, route handler caching with Cache Components, CDN caching, redirects, native history. Not read yet, to read before the checkpoint that relies on them: `error`, `loading` and `not-found` under a route group, and metadata for a `/` with no server weather (WTH-347); `cacheLife` (WTH-349).
