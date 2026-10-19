# Tavola unica: spikes before the one map (WTH-307, ADR-028)

Run 2026-10-19 on the branch `claude/atlas-foundation`. Each answers one question that decides whether C4 (the one map) is safe to build. Scripts here: `s1.html` (a real Mapbox GL map over an empty style, no token, fixed behind a scrolling page, its box clipped by `clip-path`), `s1.mjs` (frame times), `s2.mjs` (touch gestures). To rerun: copy `node_modules/mapbox-gl/dist/mapbox-gl.js` and `.css` next to them and run the `.mjs` files from that directory with Node (they serve the page on a local port and drive the installed Chrome through `playwright-core`).

## S1: clip-path on a fixed WebGL canvas. Passed in Chrome, not yet on Safari or a phone
- The map box opens from a window to the full viewport with `clip-path: inset(...)`, 520 ms, `cubic-bezier(.3, 0, 0, 1)`; no `map.resize()`; the page scrolls over it.
- Frame times in Chrome on this Mac (Intel Iris 6100): 16.7 ms on average, at most 16.8 ms, no frame over 50 ms, in five cases (idle, open, close, open while `flyTo` runs, page scroll), at 1440x900 and at 390x844 with touch and a device pixel ratio of 2.
- Not shown: Safari (the target that matters most), a real phone GPU, a map with real tiles and the weather field's two raster layers (an empty style is light work for the GPU). Criterion for C4: the same numbers on an iPhone with the real map and the field. Until then S1 is a pass in Chrome only.

## S2: gestures against page scroll. Passed in Chrome, and it settled the design
- First run, the map behind the page (`z-index: -1`): with the map "open" a vertical swipe still scrolled the page and the map did not move. The page's boxes get the touch first, whatever `pointer-events` they have.
- Second run, the map raised above the stations when open (`z-index`, `touch-action: none`): the same swipe moved the map (latitude 45.46 to 42.84), the page stayed at 0; a horizontal drag moved it too. Closed, the same swipe scrolled the page (0 to 396) and the map stayed.
- Consequence for the design: when the map opens it goes above the page (and the stations become `inert`); it is not just clipped wider. And on a phone the map in its window cannot be dragged with one finger (that would trap the scroll): in the window it is a picture with a tap to open it, and it is panned only when open. On a computer the window can take wheel and drag. This refines choice 2 of WTH-303 for the phone; say if you disagree.

## S3: one cache key for a cell, with and without a name. Confirmed risk, fix designed, not built
- `load()` in `lib/weather-page.ts` is a `"use cache"` function keyed on all its arguments, `name`, `region` and `country` among them. `/api/atlas/point` calls `weatherFor({ lat, lon })` with no name. The home, given `?lat&lon&name=...`, calls it with a name: another key, so another set of upstream calls (forecast, yesterday, pollen) and, because the region and country are missing, one more place search (`namesFor`). Same coordinates, since `cellOf` and `roundCoord` use the same rounding.
- Today's Atlas to home link avoids it by giving no name unless the point is inside a town (`placeRefOf`, WTH-301), and when it does give one, it pays the second load.
- Fix, for C4 (changes a shared function, so it needs the user's look): key `load()` on the coordinates, the scenario and the hour only; apply the name, region and country after it, outside the cache; cache `namesFor` on its own (name and coordinates). Then the point route, the home, the poster and the saved places all share one entry per cell. Criterion: one set of upstream calls per cell whatever the name; a unit test with a counting provider.

## S4: no server render during map stops. Not measured, by design
- It can only be measured once the map sits in the home. Today `useAtlasEngine` calls `router.replace('/atlas?lat&lon')` on each stop; C4 replaces that with `history.replaceState` (the Next docs for this version say it syncs `useSearchParams` and does not re-run server components; `mode.ts` already uses it on the home). Criterion for C4: ten stops, zero runs of `loadWeatherPage`, one when the place is adopted.

## Cut or left
- S5 (a redirect from `/atlas` and `/crea` that keeps the fragment) is not needed: ADR-028 keeps them as plain addresses that open the page already open.
- S6 (the real reduced poster preview) waits for C3.
