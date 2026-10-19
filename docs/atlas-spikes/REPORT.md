# M0 REPORT: technical spikes for WTH-291

Date: 2026-10-14. Authorized by the user the same day (approval of the architecture plan, M0 only). Scope: spikes S0, S1, S3, S6, S7 and S2 (only if a real-device test was possible), no S4. No change to the application code, to `main` or to Create; no deploy, no merge; M1 and M2 not started. Everything ran in scratch directories outside the repository. Raw results are in `results/`, the scripts in `scripts/` (each `.txt` file is a source file: remove the suffix to run it, see "Reproduce" at the end).

Reading guide: VERIFIED means measured or read in this environment, with the evidence named. UNCONFIRMED means not proven here. BLOCKED means the environment does not allow it, and the report says what would unblock it.

## 1. Summary

| Spike | Status | One line |
| --- | --- | --- |
| S0 Install, docs, types | DONE | Versions as pinned; the Next docs and the mapbox-gl types were read; two plan claims amended |
| S1 Tile attributes | BLOCKED | No Mapbox token and no route to `api.mapbox.com` |
| S2 Hit-test on a real device | BLOCKED | No real device. The software semantics of `queryRenderedFeatures` were measured (as extra, section 6) |
| S3 Next navigation | DONE (self-hosted) | Soft navigation, errors, offline, superseded navigations, history, payload and cache sharing measured |
| S4 Preview deploy | NOT RUN | Not authorized, as instructed |
| S6 Elevation parameters | BLOCKED (live), partial | No route to Open-Meteo or OpenWeather, no OpenWeather key. Only the response field and our own code were checked |
| S7 Mapbox GL camera | DONE | Padding, centre, events, inertia, limits, event data and hit-test semantics measured with a blank style |

Decision for the next steps (section 9): GO for M1 and M2 as recommended below; NO-GO for M3 and M4 until the points in section 8 are settled.

## 2. Environment and limits

- Node v22.22.0, npm 10.9.4. Dependencies installed from the repository's own `package-lock.json` (`npm ci --ignore-scripts`, 419 packages, about 16 s). Installed: next 16.3.7, react and react-dom 19.2.8, mapbox-gl 3.31.0, typescript 5.9.3, playwright-core 1.63.0.
- Browser: the pre-installed Chromium 141.0.7390.37, headless, with software rendering (SwiftShader). It worked through `executablePath` although Playwright 1.63 expects a newer build. Only Chromium: Safari, Firefox, touch gestures and real GPUs were not tested, so no performance number from this environment is meaningful.
- Network: the egress proxy answers 403 to `api.open-meteo.com`, `archive-api.open-meteo.com`, `api.mapbox.com`, `docs.mapbox.com`, `api.openweathermap.org`, `query.wikidata.org`, `nextjs.org` and `developer.mozilla.org`. Only the npm registry is reachable. This is the environment's network policy.
- Credentials: the environment has no Mapbox token and no OpenWeather key. Other credentials present (cloud and GitHub) were not used and not printed.
- Next was run self-hosted (`next start`, one process). Vercel serverless was not tested (S4).
- A spike server is a scratch app that mimics the real page's shape (async page reading `searchParams`, a `"use cache"` function, `loading.tsx`, `error.tsx`, `cacheComponents: true`). A second scratch copy of the real application, built with the mock provider and no map token, was used to measure the real page's payload. The repository itself was never built, installed or modified (`git status` clean throughout).

## 3. S0: versions, documentation, types

VERIFIED (evidence: the installed `node_modules`, `package-lock.json`):
- Pinned versions install and match the plan (section 2).
- The Next docs exist at `node_modules/next/dist/docs/` (456 files). Read: `use-router.md`, `error-handling.md`, `error.md`, `linking-and-navigating.md`, `use-cache.md`, `use-cache-remote.md`, `cacheLife.md`.
  - `router.replace` navigates without adding a history entry and takes `{ scroll }`. `router.refresh()` does not invalidate the server-side cache.
  - Expected errors (failed requests) "should be modeled as return values", uncaught exceptions go to error boundaries. This supports a check that does not throw.
  - `use cache` keys are: build id, function id, serializable arguments. Entries live in memory by default. **The docs say that on serverless "cache entries typically don't persist across requests (each request can be a different instance)"** and that `use cache: remote` exists for a shared cache. This amends a plan claim (section 8, R2).
  - `error.tsx` gets `retry()` (re-fetch and re-render the children) and `reset()` (clear the error state without re-fetching). `retry` became stable in 16.3.0, which the real app's `error.tsx` already uses.
- mapbox-gl types (`dist/mapbox-gl.d.ts`): `getCenter()` is "the map's geographical centerpoint"; `setPadding(padding, eventData)` "fires movestart and moveend"; `moveend`/`move` carry an optional `originalEvent`; `maxPitch` defaults to 85, `minPitch` 0; `queryRenderedFeatures` excludes layers with `visibility: none`, layers outside their zoom range and collided symbols, and includes layers with zero opacity.

UNCONFIRMED: Mapbox's default paint transition (the types and the style-spec do not state it; `map.getStyle().transition` is empty). To settle in spike S8.

## 4. S3: Next navigation (self-hosted, Chromium 141, Next 16.3.7)

Method: `scripts/s3-app` (scratch app), `scripts/s3-run-tests.mjs`, `s3b-preflight-and-rsc.mjs`, `s3c-layout-survival.mjs`. Results: `results/s3-result.json`, `s3b-result.json`, `s3c-layout-result.json`. The first run of `s3-result.json` is cold-cache, which matters (an earlier warm run gave misleading instant results and was discarded). The T7 and T9 sections of `s3-result.json` are superseded by `s3b-result.json`.

VERIFIED:
1. **`router.replace` keeps the old UI while the new route renders, and moves the URL at commit.** With a 1.5 s server render: the old content and old URL stay for the whole wait, then both change together at about 1.56 s. This held with an explicit `startTransition` (`isPending` true throughout) and with a plain `router.replace`. `loading.tsx` was present and its fallback never showed for a search-parameter change. Client state of the page was preserved.
2. **The latest navigation wins.** A slow navigation followed 250 ms later by a fast one ends on the fast one's content and URL, and the slow one's result never appears.
3. **A server error during a navigation replaces the page with the error boundary and moves the URL to the failing address.** The old content and the page's client state are gone after about 360 ms. With only the root `error.tsx`, the whole app content was replaced.
4. **Offline: Next falls back to a full document navigation.** With the network off, `router.replace` ended in Chromium's "No internet" page (`chrome-error://chromewebdata/`) and the page's JavaScript state was lost. This is browser behaviour in Chromium only.
5. **History.** `replace` leaves `history.length` unchanged (2 to 2), `push` adds one (2 to 3), back returns to the previous URL.
6. **A failed check before the navigation leaves everything alone.** A route that calls the same cached function and answers 502: the URL, the content and the client state are unchanged. A throwing cached function is not cached, so each retry reaches the upstream again (2 attempts for 2 tries).
7. **Cache sharing, single persistent process only.** A check route followed by the page navigation for the same cell made 1 upstream call in total; the navigation after the check took 36 ms against 833 ms cold; another coordinate in the same two-decimal cell (40.024 and 40.02) took 33 ms and made no new call. **This does not hold on serverless by the docs, and S4 was not run** (section 8, R2).
8. **A layout-level shell survives a server error.** With `app/atlas/layout.tsx` holding a client shell and `app/atlas/error.tsx` as the boundary, the shell's mount id and state were identical before, during and after a throwing navigation, and only the page content was replaced by the boundary.
9. **The error boundary stays stuck across later navigations.** After the error, a good `router.replace` updated the URL but the boundary kept showing the error; only a full reload cleared it. Calling `reset()` from an effect when `useSearchParams()` changes recovered it, with the shell state intact.
10. **Payload of the real page (mock provider, 48 hours, scratch copy of the real app).** A client navigation's RSC response was about 121 KB decoded and about 31.5 KB on the wire (Genova 121,417 and 31,525; Milano 122,828 and 32,101 bytes); the initial document was 257 KB. Real providers return up to 8 days, so this is a lower bound. A synthetic 192-frame timeline in props added about 12.5 KB decoded (14,015 against 1,537 bytes).

UNCONFIRMED: behaviour on Vercel, in Safari and Firefox, and the RSC size with real provider data.

## 5. S6: elevation

BLOCKED for the live checks (no route to Open-Meteo or OpenWeather, no OpenWeather key).

VERIFIED:
- No weather provider and no source in the repository passes an elevation: `latitude`/`longitude` only (`openmeteo.ts`, `nearby.ts`). Elevation is read only in `city-facts.ts`.
- The official Open-Meteo SDK (`WeatherApiResponse` in `@openmeteo/sdk`) exposes `elevation(): number` in the **response**, so the elevation the service used for a location is available to show as provenance.

UNCONFIRMED (to verify with network access, no assumption of equivalence between providers):
- That Open-Meteo's `elevation` **request** parameter adapts the forecast to altitude, and how (the official client's types and README do not document it).
- Whether OpenWeather One Call 4.0 has any elevation parameter. Nothing about it is in the repository or the installed packages.
- OpenWeather's hourly horizon for `timeline/1h`.

## 6. S7 (and the software side of S2): Mapbox GL JS 3.31.0

Method: `scripts/s7-run.mjs`, `s7b-eventdata.mjs`. Results: `results/s7-result.json`, `s7b-result.json`. A blank inline style and inline GeoJSON; no Mapbox service was used. The map did not load from `about:blank` because the GeoJSON worker needs a real origin; the harness serves the page from a routed `https://spike.local/`.

VERIFIED:
1. **`getCenter()` is the geographic point at the centre of the padded area**, not of the canvas. With a 200 px bottom padding on an 800 by 600 map, `getCenter()` equalled `unproject([400, 200])`, while `unproject([400, 300])` was 0.19 degrees south. So with the existing "pin" padding, `getCenter()` is the pin.
2. **Events.** `jumpTo` and `setPadding` emit `movestart`, `move`, `moveend` synchronously, with no `originalEvent`. `easeTo(300 ms)`: `moveend` at 311 ms, `idle` 17 ms later.
3. **The existing backdrop pattern floods the events.** 30 consecutive `jumpTo` calls (one per frame, as `MapBackdropGL` does) produced 30 `movestart` and 30 `moveend`. A settle controller listening to `moveend` cannot be used on that pattern as it is.
4. **Inertia.** After a slow drag stopped, `moveend` fired 6 ms after the pointer was released. After a fast flick, `moveend` fired 407 ms after release. `moveend` is therefore the reliable end of a movement, inertia included.
5. **`originalEvent` cannot tell user moves from programmatic ones in general.** Mouse drag (type `mouseup`) and keyboard (`keydown`) carried it. **Wheel zoom did not** (`movestart` and `moveend` had no `originalEvent`, though `zoomstart` and `zoomend` fired).
6. **Event data tags programmatic moves reliably.** The second argument of `jumpTo`, `easeTo`, `flyTo` and `setPadding` showed up on both `movestart` and `moveend` (including for a 300 ms `flyTo`). This is the recommended way to mark programmatic moves.
7. **Keyboard.** Arrow keys produce a move of about 335 ms with `originalEvent` of type `keydown`. Control plus drag rotates and pitches (pitch 43 and bearing 57 degrees in the test).
8. **Limits.** Pitch 90 is clamped to 85 (`maxPitch` default), zoom 40 to 22 (`maxZoom`), zoom -10 to 0.23 on an 800 by 600 canvas (the world must fit; `minZoom` default is -2), latitude 89 at zoom 3 to 82.17, longitude 200 is kept (world copies). No `maxBounds` by default.
9. **Hit-test semantics (software side of S2).**
   - `visibility: none` layers are never returned; layers with `line-opacity: 0` are.
   - A visible 2 px line is hit only on the line itself and missed at 2 px away; a 14 px wide invisible line is hit up to 7 px away and missed at 8 px; a circle of radius 5 is hit within 3 px and missed at 6 px.
   - A layer with `minzoom: 11` is excluded at zoom 9 and included at zoom 12. At pitch 60 a point on the line is hit and 6 px off it is not.
   - A box query of plus or minus 12 px around the point hits the line.
10. **Creating a map.** With a blank style, constructing a map until `load` took 25 to 33 ms (a lower bound: a real style with tiles takes longer).
11. **Telemetry.** Constructing a map sends requests to `events.mapbox.com` and `api.mapbox.com/map-sessions/v1` even with a placeholder token (blocked here). Recreating the map at each place change therefore costs a session request each time; how Mapbox bills it was not verified.

UNCONFIRMED: touch gestures (pinch, two-finger rotate and tilt), Safari and Firefox, behaviour with the real tilesets and symbol layers, performance. S2 stays BLOCKED: it needs a real phone, real tiles and a token.

## 7. S1: tile attributes

BLOCKED. Needs a Mapbox token and a route to `api.mapbox.com`. Nothing about the properties of `streets-v8` and `terrain-v2` for summits, lakes and rivers could be read offline (the repository's own style reads `ele` of the `contour` layer and the `poi_label` layer only). The plan's claim that the tiles carry names and heights stays UNCONFIRMED.

## 8. Recommendations to change the plan (RECOMMENDATIONS, not decisions)

R1. **Put the atlas shell (map, crosshair, status) in `app/atlas/layout.tsx` and the weather content in the page, under a segment `error.tsx`.** Verified (S3 point 8): the shell survives a server error in the page. This is Next's own mechanism for "the map is created once", and the shell no longer depends on the preflight to survive a failure.

R2. **Do not rely on the preflight to warm the page's cache on Vercel.** On a persistent process it works (S3 point 7), but the Next docs say serverless entries typically do not persist across requests. Before M4, S4 (preview deploy) must settle it, or one of: accept that the page render may repeat the upstream calls (up to doubling the cost of a stop), have the check return what the client needs so the page render is not the fetch, or use `use cache: remote` (cost). The preflight stays useful for three other reasons: the URL is not updated if the weather does not arrive (S3 points 3 and 6, the user's rule), a stale check can be aborted, and it avoids the offline hard navigation (S3 point 4).

R3. **The segment `error.tsx` must reset itself when the URL changes** (S3 point 9) and offer `retry()` as the manual "Riprova". A render that fails after a successful check is rare but would otherwise leave the atlas stuck.

R4. **Mark programmatic camera moves with event data** (S7 point 6) and never infer user moves from `originalEvent` (S7 point 5). The existing `MapBackdropGL` pattern (a `jumpTo` per frame, S7 point 3) must not be reused in the atlas.

R5. **Start the quiet period at `moveend`**, which already covers inertia (S7 point 4). The initial value of 800 ms stays provisional until S10.

R6. **For element hit-testing use dedicated invisible hit layers with opacity 0, never `visibility: none`**, and sized hit areas (a thin line is missed at 2 px), with the layer's zoom range covering the zoom where it must be touchable (S7 point 9).

R7. **Keep the map out of the page's per-place remount** (R1) also for cost: each construction contacts Mapbox's session endpoint (S7 point 11).

R8. **Keep the atlas page's payload lean.** The real page's navigation payload is about 31.5 KB on the wire with mock data (S3 point 10); 40 stops a minute at that size is over 1 MB a minute before the real data. The `/atlas` page should render only what the atlas shows, not all the chapters of the home.

R9. **Never derive "unavailable moment" from a constant.** The OpenWeather horizon is UNCONFIRMED (section 5); derive it from the frames each provider actually returns (M1).

## 9. GO / NO-GO

- **M1 (time contract, pure, adapter): GO, recommended.** Nothing it needs is blocked. Conditions: pure functions and unit tests only (DST, India and Nepal offsets, 3-hourly providers, mock `at`, frame 0 off the hour, beyond the horizon, daily-only); the unavailable rule from actual frames (R9); no UI.
- **M2 (settle controller and camera port, pure): GO, recommended.** The Mapbox semantics it needs are measured (S7). Conditions: quiet starts at `moveend` (R5), programmatic moves tagged with event data (R4), the adapter tested with a harness like `s7-run.mjs`.
- **M3 and M4: NO-GO for now.** They wait for: the preflight and cache decision (R2, S4), the layout-level shell design (R1, R3), and the unblocked spikes below. M3 (a route with the camera only) has no blocker of its own but depends on R1.

Blocking risk for M4 only: R2 (cache sharing on serverless, undecided). No blocking risk found for M1 and M2.

## 10. What would unblock the rest

- **S1, S6 live, and part of S2:** the environment's network policy must allow `api.mapbox.com`, `api.open-meteo.com` and `api.openweathermap.org` (and a docs host if wanted), and a Mapbox public token and an OpenWeather key must be provided as environment secrets (never in the chat or the repository). S2 additionally needs a real phone and a deployment or tunnel it can reach.
- **S4:** a preview deployment, which is not authorized.
- **Not in M0 scope, not run:** S5 (performance on devices), S8 (one transition clock), S9 (phase B), S10 (quiet threshold with real sessions).

## Reproduce

Scratch layout used: `m0/s0` (a copy of `package.json` and `package-lock.json`, `npm ci --ignore-scripts`), `m0/s3` (the scratch Next app: copy `scripts/s3-app/*.txt` to `app/` without the `.txt`, plus a `package.json`, `package-lock.json` and `tsconfig.json` as in the repository, `npm ci`, `next build`, `next start -p 3101`), `m0/s3c` (a copy of the repository without `docs`, built with `WEATHER_PROVIDER=mock NEXT_PUBLIC_MAPBOX_TOKEN=`, started on port 3102), `m0/s7`. Scripts take the scratch install as an argument or resolve `playwright-core` from it. Set `CHROME` to a Chromium binary if it is not at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Run each `.mjs` with `node` after removing the `.txt` suffix. No script contains a credential; the placeholder `pk.unused` is not a token.
