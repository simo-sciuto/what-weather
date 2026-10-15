# ATLAS PLAN

Status: **advisory checkpoint of 2026-10-14 for WTH-226. Nothing here is approved for development.** The five product decisions on the WTH-226 board line are APPROVED (the user, 2026-10-14) and are the source of truth; everything marked RECOMMENDATION is the `architect`'s and waits for the user. Read ADR-018 first.

M0 (the spikes) ran on 2026-10-14: see docs/atlas-spikes/REPORT.md. It confirms some of the claims below, amends two (the preflight's cache sharing on serverless, and `originalEvent` as a user-move marker) and leaves S1, S2, S4 and the live part of S6 open. Its recommendations are not yet approved.

Conventions: VERIFIED = read in the repo (path:line). UNVERIFIED = not provable offline, with the way to verify it.

Blocker for the Next and Mapbox claims: `node_modules` is absent in this checkout, so the Next docs (`node_modules/next/dist/docs/`, required by AGENTS.md) and the `mapbox-gl` types could not be read. Pinned: next 16.3.7, react 19.2.8, mapbox-gl 3.31.0 (`package.json`, `package-lock.json`). Every claim below about router behaviour, `use cache` semantics and Mapbox API behaviour is UNVERIFIED until spikes S0, S3 and S7.

## 1. Current architecture (verified)

- **Data.** `src/app/page.tsx` is a server component: `loadWeatherPage` (`src/lib/weather-page.ts:140`) resolves a `PlaceRef` and calls `weatherFor` (:116), which rounds the coordinates (`roundCoord`, `COORD_PRECISION = 2`, about 1 km) into `load()` (`"use cache"`, `cacheTag`, `cacheLife` 600 / 3600 / 300 s). `load()` builds the provider forecast, yesterday, pollen and sometimes a name lookup. The provider contract has no elevation (`provider.ts:20`, `getByCoords(lat, lon)`); elevation appears only in `city-facts.ts`. `cacheTag` is set but nothing calls `revalidateTag`.
- **Cost of a fresh cell (estimate from the code, not measured):** about 9 to 12 upstream calls on OpenWeather One Call 4.0, about 4 to 5 on Open-Meteo.
- **The page tree is keyed by place** (`TimeProvider key={placeKey}`, `page.tsx:121`): a new place remounts everything, including the Mapbox map.
- **The backdrop map is a driven camera, not a free one.** `MapBackdropGL.tsx:137` creates it with `interactive: false`; its creation effect depends on `[lat, lon, token, loadMapbox]` (:183), so a change of place destroys and recreates the map. The camera is `jumpTo(currentView())` per animation frame, driven by page scroll (desktop) or by the `phoneMap` store (`map-view.ts`, `{progress, bearing}`) written by `MapGestures`. `setPadding` puts the city on the poster's anchor, not at the canvas centre. The container is `pointer-events-none fixed`; interaction is hijacked at document level.
- **Style.** `STYLE` (`map-style.ts`) has four sources: `mapbox-streets-v8`, `mapbox-terrain-v2`, `mapbox-terrain-dem-v1`, `mapbox-traffic-v1`. No `glyphs`, no `symbol` layers, no `natural_label`, no `setTerrain` (grep: none): the map draws no text. `syncMap` only calls `setPaintProperty` and `setLayoutProperty`.
- **Palette.** Moment to `frameLook(frame)` to `look.palette`; `AtmosphereMain` sets the CSS variables; only `--sky-1..3` are registered `@property` and cross-fade (0.9 s, `globals.css`); the others switch instantly; `useMapPalette` feeds the map inks (`MapControls.tsx`), and Mapbox's own paint transition is not configured (default, UNVERIFIED).
- **Time.** `MomentState.index` is an index into the place's frames (`TimeContext.tsx`); `isLive = !day && index === 0`; frame 0 is at `current.time`, the rest on whole hours, `measured: false` for interpolated hours. `Frame.time` is Unix seconds, and `formatTime`, `localDay`, `localHour` (`formatters.ts`) already take an absolute instant and a zone.
- **Create and poster.** `usePosterSnapshot` reads place, timezone, moment, palette, map options, timeline and `currentView()`; `record-map.ts` and `record-on-map.ts` import `STYLE`, `syncMap`, `BASE_ZOOM`.
- **Cloud grid.** 7x7 on a fixed lattice (0.5 by 0.7 degrees, about 330 by 330 km), clouds and precipitation only, 12 hours, one Open-Meteo request of 49 points. The client memo is keyed on the exact `lat/lon`, not the lattice, and the fetch fires at every place change although only the chapter map uses it.
- **Tests.** The e2e suite is built with `NEXT_PUBLIC_MAPBOX_TOKEN: ""` (`playwright.config.ts`), so no map is exercised by any e2e. No unit test for `TimeContext`, `weather-page.ts` or the map components.

Spot-checked by the main session on 2026-10-14: `placeKey` (page.tsx:111, :121), the map's creation effect (MapBackdropGL.tsx:183), no `revalidateTag`, `FORECAST_DAYS = 8`, no `natural_label`/`glyphs`/`symbol` in `map-style.ts`, the empty e2e token, and the missing `node_modules`.

## 2. Proposed architecture (RECOMMENDATION, incremental, no rewrite)

1. **Five state holders, one writer each:** camera (the Mapbox instance, mirrored in a non-React store), candidate point (client controller), loaded point (the server render, props: the truth), selected geographic element (client store), time selection (client store, absolute instant).
2. **The atlas on a separate route**, sharing components, with `/` untouched. Reason: ADR-013 pauses layout work and ADR-018 keeps the pause; a free map changes the interaction grammar (wheel and finger). A separate route is also the rollback.
3. **The map is created once** (its effect independent of the weather point). Camera commands are explicit (search, "Esplora qui", saved place). Only the chapter subtree is keyed by place, not the providers or the map.
4. **Commit pipeline "preflight then navigate".** On settle, a cheap abortable request (a route that calls `weatherFor` with identical arguments, so it shares the cache entry; `/api/summary` is the precedent). On success, `startTransition(() => router.replace(href, { scroll: false }))`; the server render then hits a warm cache. On failure or timeout the previous data stays, the status is `failed`, and a manual "Riprova" is offered. Reason: a server-component throw during a navigation goes to `app/error.tsx` and would replace the atlas content, and a network failure of the RSC fetch may fall back to a full page load (UNVERIFIED, spike S3). Fallback if S3 or S4 fail: a light JSON route feeding the shell, chapters loaded lazily (a bigger change, not recommended up front).
5. **Time becomes an instant**, with an adapter that keeps the `useMoment()` shape for its 12 consumers.
6. **The camera never enters a React context.** Readers needing per-frame values (crosshair, compass, URL writer) subscribe imperatively. React sees only a coarse status (`resting | moving | settling | loading | failed`), a few changes per gesture (ADR-008).
7. **The light "Meteo qui" request** is a `sources/` module in the spirit of `nearby.ts` and ADR-005, always Open-Meteo, keyed on cell plus elevation, separate from `load()` (which builds the whole timeline, sentences, pollen and yesterday: too heavy for a card).

## 3. Flow (camera, candidate, data, palette)

```
Mapbox map (interactive, created once)
  movestart / move / moveend (origin: user | program)
        |                     'move' ~60 Hz: imperative only (crosshair, compass, no React)
        v
 CameraStore (plain object, imperative subscribers)
        | moveend
        v
 SettleController (pure state machine, injected clock)
   resting --movestart--> moving --moveend--> settling (timer QUIET_MS)
   settling --movestart--> moving   (timer cancelled, nothing sent)
   settling --quiet--> candidate = cell(roundCoord(center))
        |
        +-- cell == loaded.cell ........ no-op                          [dedupe]
        +-- cell == inflight.cell ...... no-op                          [in-flight reuse]
        +-- else commit(cell, reason: settle | select | retry | initial)
                 seq++ ; abort the previous preflight
                 v
          preflight (AbortController, timeout) -> weatherFor(cell) [shared cache]
             | ok and latest             | fail / timeout        | superseded
             v                           v                       v
   startTransition(router.replace)   status = failed(cell)   dropped silently
             |                       previous data and palette stay, marked
             |                       "non aggiornato"; [Riprova] -> commit(retry)
             v
   server: page -> loadWeatherPage -> load() (cache hit)
             v
   TimeProvider (timeline, NOT keyed) -> resolve(instant, timeline)
        |-- ok ........... frameLook -> palette -> CSS vars (dissolve) + map inks
        |-- unavailable .. keep the previous palette, marked; "ora non disponibile";
                           explicit actions: nearest available / back to Adesso
```

## 4. Contracts (sketches, not to implement)

```ts
type Camera = { lng: number; lat: number; zoom: number; pitch: number; bearing: number };
type CameraEvent = { type: "movestart" | "move" | "moveend"; camera: Camera; origin: "user" | "program" };
type CameraPort = {                       // thin adapter over mapboxgl.Map; a fake in tests
  subscribe(l: (e: CameraEvent) => void): () => void;
  get(): Camera;
  flyTo(t: Partial<Camera>, opts?: { reducedMotion?: boolean }): void;
};

type Cell = { lat: number; lon: number };            // roundCoord'ed: the cache key and what is displayed
type AtlasPhase = "resting" | "moving" | "settling" | "loading" | "failed";
type AtlasStatus = { phase: AtlasPhase; candidate: Cell | null;
  failed?: { cell: Cell; reason: "timeout" | "upstream" | "offline" } };
type CommitReason = "settle" | "select" | "retry" | "initial";
// pure, all time injected, fully unit-testable
type SettleController = { onCamera(e: CameraEvent): void; onLoaded(cell: Cell): void;
  onCommitResult(seq: number, ok: boolean): void; readonly status: AtlasStatus };

type LoadedPoint = { cell: Cell; place: Place; timezone: string; provider: string;
  kind: "place" | "free"; dataTime: number };

type TimeSelection = { mode: "now" } | { mode: "at"; instant: number /* Unix s UTC */; chosenIn?: string };
type MomentResolution =
  | { status: "ok"; frame: Frame; frameIndex: number; offsetSeconds: number }
  | { status: "unavailable"; requested: number; reason: "before-start" | "beyond-horizon" | "daily-only" };
// pure: resolveInstant(timeline, instant, tolerance = HOUR_SECONDS / 2): MomentResolution

type GeoElement = { id: string; kind: "summit" | "lake" | "river"; name: string;   // name required
  point: { lat: number; lon: number };
  elevation?: { metres: number; source: "tile-label" | "wikidata-P2044" };          // absent = unknown, never 0
  identifiedBy: { via: "tile-feature"; tileset: string; sourceLayer: string } | { via: "wikidata"; qid: string };
  facts?: { label: string; value: string; source: string }[] };

type PointWeatherQuery = { lat: number; lon: number; elevation?: number; instant: number };
type PointWeather =
  | { status: "ok"; hourUsed: number; timezone: string; temp: number; condition: Condition; isNight: boolean;
      model: { source: "open-meteo"; elevationRequested?: number; elevationUsed?: number; cell: Cell };
      estimate: true }
  | { status: "unavailable"; reason: "before-start" | "beyond-horizon" | "upstream" };
```

- **Frame choice.** Frames are already hourly (interpolated for 3-hourly providers), so no extra interpolation at the instant level: the nearest frame within half an hour; beyond that, unavailable. `Frame.overview` is never a resolution. The label is the frame's own local time (`formatTime(frame.time, tz)`); never print "the hour" as an integer (India and Nepal have :30 and :45 offsets). `measured: false` keeps its "~" marker (ADR-006).
- **"Adesso"** reads the clock from a tick store (60 s, only while `mode: "now"`); React re-renders only when the resolved frame changes.
- **Compatibility adapter.** `useMoment()` keeps `{ index, frame, look, dayLabel, isLive, setIndex }`: `index` derived, `setIndex(i)` calls `setInstant(frames[i].time)`, `isLive = mode === "now"`; a gate (`useAvailableMoment()`) exposes the frame, so the consumers (HeroMeta, HeroTemp, MomentFacts, NarrativeText, TimeScrubber, AutoRefresh, Sky, MapCompass, DaySelect, Activities, MapBackdropGL, MapControls, usePosterSnapshot) migrate one at a time.
- **Day view.** `selectDay` sets the instant to the local midday of that day at the current point; a day without hourly data resolves as `daily-only`.
- **Unavailable.** Keep the requested instant; say it; offer "nearest available" and "Torna ad Adesso" as explicit buttons; the palette stays the previous one, marked; never `frames[0]`.

## 5. Plan (each step mergeable alone; `/` unchanged until the user decides)

**MVP**
- M0 Spikes and environment, no product code: install dependencies in a scratch environment, read the Next docs, run S0 to S3, S6, S7.
- M1 Time contract, pure: `resolveInstant` and the tick store with unit tests (DST, India and Nepal offsets, 3-hourly provider, mock `at`, frame 0 off the hour, beyond horizon, daily-only); an adapter in `TimeProvider` keeping today's behaviour on `/`. No persistence across places, no UI yet. ADR-019.
- M2 Settle controller and camera port: the pure state machine, the Mapbox adapter, an `AtlasStatus` store, tested with fake timers and a fake port. Not wired to weather. ADR-020 draft.
- M3 Atlas route shell, camera only: a new route; the map created once; free interaction; crosshair at the pin; imperative compass; a fixed weather point from the URL. `/` untouched.
- M4 Commit pipeline: settle, preflight, `router.replace`, dedupe, abort and sequence, failed state with "Riprova", a status line announced only on commit. The chapter subtree keyed by place, the providers not. Territorio not rendered per point in atlas mode.
- M5 Phase A colour (user, 2026-10-15: the sky follows the weather point the map stopped on, and the zoom sets how local the colour is: a regional colour from far, the point's own from close; no colour from zoom alone, which would say nothing of the place): the previous palette kept while moving and loading; one transition clock for the sky variables, the other variables (registered) and the map inks; "non aggiornato" marking on failure.
- M6 Instant across places: an unkeyed `TimeProvider`; the unavailable UI; each point's local hour; the URL's `t` through native `history.replaceState`; a Create and poster regression test.

**Phase 2:** P1 element identification (summits first: hit-test, highlight through a dedicated GeoJSON layer, no camera move); P2 the `pointWeather` source, route and cache unit (cell plus elevation, Open-Meteo only); P3 cards (desktop popover, phone sheet; "Meteo qui"; "Esplora qui" as `commit(select)`); P4 timeline drag over the cached days (C).

**Phase 3:** Q1 phase B (per-lattice grid with a client memo snapped to the lattice, zoom gating, a local luminosity field, fallback to A, after S9); Q2 lakes and rivers detail. Left out: "Segui il corso", trails, the past mode.

ADR proposals (not written): ADR-019 time is an absolute instant (amends ADR-008); ADR-020 camera, candidate and loaded point, commit on settle (amends ADR-003); ADR-021 the atlas route and the pause (amends ADR-013, ADR-018); ADR-022 the light point-weather cache unit keyed on cell and elevation, Open-Meteo only (extends ADR-005); ADR-023 geographic elements: identification, provenance, licence stance on tile attributes (touches ADR-009).

## 6. Approval checkpoints and rollback

| Step | Approval needed from the user | Rollback |
| --- | --- | --- |
| M0 | spike results, route name, open questions | none (no code) |
| M1, M2 | review (invisible) | revert; unreferenced code |
| M3 | route name; confirmation that this is the atlas surface (ADR-013 pause) | remove the route; `/` untouched |
| M4 | OK to add a preflight route; quota envelope | remove route and pipeline; cache entries expire within `MAX_DATA_AGE_SECONDS` (1 h) |
| M5 | the user's look at the dissolve on a phone | revert |
| M6 | unavailable wording; instant label anchor | revert; the server ignores `t` |
| P1 to P3 | cards design (`ux-ui`) and licence stance | route or flag off |
| P2 | none on `load()`; **do not change `load()` arguments** | new cache keys only; nothing to invalidate |

## 7. Technical risks (by severity)

1. Upstream cost of free points (high, high): about 9 to 12 calls per fresh cell on OpenWeather (estimate); a user who stops every 1.5 s causes about 40 cells a minute. Mitigation: a minimum interval between commits (proposal: 2 s trailing), dedupe by cell, no Territorio per point, measure the envelope (S5), decide the quota (WTH-212).
2. A failure destroys the shell (high, high without the preflight): server throw goes to `app/error.tsx`; RSC network failure may hard-navigate (UNVERIFIED). Mitigation: preflight, S3.
3. The map is recreated per weather point (certain in the current code, medium impact): flicker, lost camera, possible extra billed loads (Mapbox pricing UNVERIFIED). Mitigation: M3.
4. Identification feasibility (medium, high impact on decisions 3 and 5): the style draws no labels and no `natural_label`; whether the tiles carry name and height is UNVERIFIED. Mitigation: S1, S2; partial coverage is acceptable ("no name, no card" is approved).
5. Mobile GPU and memory with free pitch and zoom (medium-high, high): unmeasured. Mitigation: S5 budgets; degrade layers by zoom and pitch; keep `setTerrain` out of the MVP.
6. Time contract migration (medium, medium): many consumers, day view, `AutoRefresh`, mock `at`. Mitigation: adapter, golden e2e, M1 before UI.
7. `use cache` per instance on serverless (medium, medium, UNVERIFIED): a preflight landing on another instance could double the upstream calls. Mitigation: S4.
8. Mapbox terms (medium, medium): the cards would read tile attributes into the UI; the terms on extracting or storing Licensed Map Content are not in the repo (UNVERIFIED). Pre-existing: `city-facts.ts` caches Tilequery results server-side for 30 days. RECOMMENDATION: card data from tiles shown client-side only, not persisted server-side; Wikidata (CC0) may be cached.
9. Open-Meteo limits and plan (medium, medium): the free tier is non-commercial; a new lattice cell costs 49 calls for the grid.
10. Accessibility of a free canvas map (medium, high).
11. Free points polluting recents and saved places (`PlaceContext.tsx:59`): needs a product rule.
12. Three transition clocks (low).

## 8. Spikes

| # | Question | Minimal method | Pass or fail | Needs |
| --- | --- | --- | --- | --- |
| S0 | What do Next 16.3.7 and mapbox-gl 3.31.0 actually say? | `npm ci` in a scratch clone; read the Next docs and the mapbox-gl types | every UNVERIFIED claim confirmed or amended | network |
| S1 | Which properties do the tiles carry for summits, lakes, rivers? | Tilequery on `streets-v8` and `terrain-v2` for about 10 known elements | at least 8 of 10 named; at least 7 of 10 summits with an elevation; layers and fields listed | network, token |
| S2 | Can we hit-test? | scratch page with the real `STYLE`: `queryRenderedFeatures` on an invisible layer vs own nearest-by-pixel; padded boxes for thin lines; zooms 9 to 13 | a tap within 24 px (touch) or 8 px (mouse) finds the intended element at least 9 of 10 on a real phone | real device |
| S3 | How does soft navigation behave? | throwaway route, mock provider: `router.replace` in a transition; superseded navigation, server throw, offline, Suspense, `loading.tsx`; RSC payload size | old UI stays while pending; a superseded navigation ends on the last; failure behaviour documented | none |
| S4 | Does the preflight warm the page's `use cache` entry on Vercel? | preview deploy; preflight then page; count upstream calls | one upstream set for both | Vercel preview |
| S5 | Frame rate, memory, bytes under free movement | real devices (mid-tier Android, Pixel 7, an iPhone); option sets default, relief and contours, 3D, traffic; 60 s of free movement | proposal: median at least 50 fps, p95 frame at most 25 ms on Pixel 7; no tab crash on the lowest device; bytes per minute recorded | real devices |
| S6 | What does elevation do? | same summit coordinates to Open-Meteo with and without `elevation`; for OpenWeather One Call 4.0 read the docs or send `elevation` and compare | difference seen; OpenWeather support documented or ruled out | network |
| S7 | Mapbox semantics | scratch: `getCenter()` with `setPadding`, `moveend` after inertia, `originalEvent` for user moves only, `idle` timing, max pitch | each answer recorded; if `getCenter` is not at the pin the crosshair maths changes | browser |
| S8 | One transition clock | register the other variables, set the style `transition`; sample over time | all three end within 100 ms of each other | browser |
| S9 | Phase B feasibility | prototype a local luminosity field from the 49 points; run the legibility tests; measure mobile cost | legibility holds; at least 50 fps on Pixel 7 | device |
| S10 | Quiet threshold | instrument the gap between `moveend` and the next `movestart` in the WTH-227 sessions | pick about the p80 of re-start gaps | real sessions |

## 9. Acceptance criteria (testable)

1. Zero weather requests while moving: with a fake `CameraPort`, between `movestart` and the quiet threshold after `moveend`, no request to our origin carrying `lat=` or `_rsc` (tile requests to Mapbox are outside this rule, see question 6).
2. A new `movestart` in the quiet window cancels the commit (unit, fake timers).
3. Dedupe: two settles in the same rounded cell produce one commit; a settle onto the loaded cell produces none.
4. Stale: with two commits in flight, the aborted one never changes `loaded`; the final loaded cell equals the last candidate.
5. Camera independence: a weather-point change leaves zoom, pitch, bearing and centre identical, and the Mapbox `Map` instance is the same object.
6. The displayed coordinates for candidate and loaded are `roundCoord` values; the URL after a commit equals `placeHref(data.place)`.
7. Instant across time zones: after selecting an instant at Torino and moving to Tokyo, the requested instant is unchanged and the local time equals `formatTime(instant, "Asia/Tokyo")`; for a :30 or :45 zone the label is not an integer hour.
8. "Adesso" follows the clock (40 minutes later it resolves to the frame nearest the clock); a persisted instant never becomes "now" by itself.
9. Unavailable: an instant beyond the last frame, before the first, or on a daily-only day yields `unavailable` with the requested instant kept, no frame, no fallback to frame 0, and the two explicit actions visible.
10. Failure: with the preflight returning 502, the previous palette and data stay, the status says not updated, no automatic retry in 60 s, and one "Riprova" click issues exactly one request.
11. Create and poster regression: `posterSnapshot` for the loaded point, instant and view is unchanged for the existing inputs (golden); the existing `/` e2e suites pass unchanged.
12. Re-render budget: while the camera moves, the React Profiler records no commits for `AtmosphereMain`, the hero and the chapters.
13. Accessibility: a non-gesture way to set a point (search and "Esplora qui"); the status announced once per commit, not while moving; keyboard pan and zoom works and settles; `prefers-reduced-motion` uses `jumpTo`; cards reachable by keyboard and closable with Esc; touch targets at least 44 px.
14. Summit weather is never valley weather: the light cache key includes the quantised elevation (two elevations in the same cell give two keys); the card shows requested versus model elevation when they differ and says "stima del modello".
15. Name and height match: a card's name and height come from the same identified feature (a massif never takes its highest summit's height).
16. Performance budgets (proposals, to set after S5): settle to palette applied at most 1.5 s p75 on a warm cache over 4G; pan median at least 50 fps on Pixel 7.

## 10. Three precisions to confirm (no evidence against an approved decision)

- "No request while the map moves", read literally, is impossible: Mapbox fetches tiles while moving. Smallest change: state it as "no weather request".
- "Not a mathematical correction of the valley temperature": Open-Meteo's `elevation` parameter is itself a statistical downscaling of the model cell (public docs, UNVERIFIED offline, S6). The intent (data requested for the summit point, no subtraction of our own) is met, and the card must say "stima del modello adattata alla quota", which the decision already requires.
- "Zoom, rotate, tilt with no constraint": the engine has limits (max pitch, zoom range, Web Mercator latitude). Smallest change: no product-imposed limits, engine limits only.

## 11. Open product questions (the user decides; the architect did not)

1. The atlas route's name and entry point, and confirmation that ADR-013's pause is lifted for it only.
2. What the hero says for a free point (coordinates? the nearest place as extra?) and the poster's name for a free point.
3. Do free points enter recents and saved places, and how are they named.
4. The instant label anchor (the zone where it was chosen, or only each point's local time) and its format.
5. Back button: replace (recommended) or push on settle; what the URL carries (the point yes; the instant `t`; the camera in the hash?).
6. Confirm that Mapbox tile requests are outside "no request while moving".
7. Desktop: the wheel zooms the map and the page no longer scrolls into it; where the data lives (`ux-ui`).
8. Phone: standard map gestures replace "vertical finger = descent"; what "Ricentra" means now.
9. Summit label typography: DOM labels in the page's fonts (the architect's lean, also better for accessibility) or Mapbox glyphs (needs a `glyphs` URL and a font choice).
10. Territorio in the atlas: omit, on demand, or per place only.
11. How long previous data may stay "not updated" before it is hidden (today `MAX_DATA_AGE_SECONDS` is 1 hour).
12. Is Open-Meteo-only acceptable for summit cards when OpenWeather is the main provider (visible provenance).
13. The quota and cost envelope for exploration (WTH-212).
14. 3D terrain (`setTerrain`) in or out of the MVP.
15. The wording when requested and model elevations differ.

## 12. Verified versus unverified

Verified (repo): section 1, with its paths; `FORECAST_DAYS = 8` for Open-Meteo; the mock gives 48 hours; the free OpenWeather is 5 days at 3 hours (interpolated to hours); the cloud grid has only cloud cover and precipitation; `STYLE` has no text layers; no `queryRenderedFeatures` in the code; the backdrop map is non-interactive; the e2e has no map.

Unverified (and how): OpenWeather One Call 4.0's hourly horizon and elevation support (S6; RECOMMENDATION: assume none and always use Open-Meteo for the summit card, as `nearby.ts` does, showing provenance); Open-Meteo's `elevation` behaviour (S6); soft navigation and `use cache` sharing across a route handler and the page on serverless (S0, S3, S4); Mapbox `getCenter` with padding, `moveend` and inertia, `originalEvent`, the default paint transition, `maxPitch`, `queryRenderedFeatures` on hidden layers, map-load billing and the terms on extracting tile attributes (S0, S2, S7, and reading Mapbox's Product Terms and pricing); the tile schema of `natural_label`, `waterway`, `water` (S1); RSC payload size and mobile numbers (S3, S5).

## 13. Found outside the task (on the board, not implemented)

See WTH-228 to WTH-232.
