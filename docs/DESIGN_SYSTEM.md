# DESIGN SYSTEM

Status: proposal of 2026-10-20 (WTH-339), from the `ux-ui` and `frontend` agents, checked against the code at `a08157c`. The visual reference lives in Claude Design (section 6); this file is its contract with the code. When the two differ, the difference is a bug in one of them, to fix on purpose.

The only identity element kept is the colour engine: the atmosphere palette (`src/lib/weather/palette.ts`), the temperature scale (`temp-color.ts`) and the field colour (`src/lib/atlas/field-color.ts`). Everything below is built on it.

## 1. Polarity and what is under the interface

- The page sky is darkened by the engine until white at 86% reads at 4.5 to 4.8:1 (`finishPalette`). Interface text is light ink.
- Over the atlas the backdrop is not that sky: it is the weather field, a rich temperature colour at 0.9 under the map's lines and 0.38 over them, bright by day (aqua, butter). Light ink over it has no guarantee today (WTH-277). Every surface and every scrim is therefore measured against the field colours in view, which are already on the client (`WeatherField.colors`).
- There is no light and dark mode. Day and night change hue and saturation, never the direction of contrast: dragging the time bar from 18:00 to 21:00 must not flip the screen. Night is the place's at the instant shown. The page declares `color-scheme: dark`.

## 2. Tokens

### Primitive (static, Tailwind 4 `@theme`)

| Group | Tokens |
| --- | --- |
| Type | One family with tabular figures. Today the UI is Inter Tight (`layout.tsx`); the Claude Design system proposes Inter (steadier at 12 to 16 px, one more request). The user chooses. Optional: Source Serif 4 italic for water and valley names in a card header. Syne goes with the old home and the explainer, its only users |
| Scale | `caption` 12/16 (the floor: today's 11 px uppercase labels in `PointReading`, `CenterReadout` and the field note move up), `small` 14/20, `body` 16/24, `title` 20/26 w600, `figure` 40/44 w500 (48 on desktop) |
| Spacing | 4 px grid: 4, 8, 12, 16, 24, 32; gutter `max(16px, env(safe-area-inset-*))` |
| Radius | 10 controls and fields; 16 sheet and panel; full for the "Adesso" chip and the thumb |
| Elevation | L1 controls: `surface-1`, 12 px blur, hairline. L2 sheet and panel: `surface-2`, shadow `0 8px 24px rgb(0 0 0 / .28)`. No third level |
| Motion | sheet 240 ms `cubic-bezier(.2,.8,.2,1)`; fades 160 ms; camera ease 600 ms (search flights keep ADR-025's length by distance); colour 300 ms in the proposal against today's 0.9 s `.atmosphere` transition, to settle by eye. Reduced motion: fades only, jumps, no colour cross-fade |

### Semantic, dynamic

One pure function, `uiTokens(sky, fieldColors, inkColors)` (`src/lib/weather/ui-tokens.ts`, built in WTH-342), tested like `palette.ts`, replaces both writers that exist today: `paletteVars` in `src/components/atlas/atlas-look.ts` and the hand-written variables of `AtmosphereMain` in `src/components/time/TimeContext.tsx` (WTH-262).

| Token | Derivation | Guarantee |
| --- | --- | --- |
| `--sky-1..3`, `--glow`, `--sun`, `--cloud` | the point's sky by zoom (`skyFor`), as today | existing tests |
| `--ink` | `#fff` | |
| `--ink-muted` | white at 86%, one shared constant (today two literals: `globals.css` and `palette.ts` `muted`) | 4.5:1 on every surface |
| `--surface-1` | the `sky1` veil, alpha raised until muted text is 4.5:1 against the lightest field colour in view composited at the field opacity, and the lightest active map ink; no cap, opaque if needed | AA over the real map (new test, WTH-277) |
| `--surface-2` | same veil, target 7:1 | AAA for card text |
| `--line` | white 14% decorative, 24% dividers, 40% control borders | 3:1 where it marks a control |
| `--accent`, `--on-accent` | the `sun` hue (warm by day, periwinkle at night); today `--accent` is fixed butter | 3:1 on `surface-1` and `surface-2` |
| `--verdict-good/-caution/-no/-unknown` | fixed OKLCH hues 150, 80, 25 and neutral, L 0.86, C 0.10; never from the sky or the field | 7:1 on `surface-2`, always with shape and word |

Plumbing: today the variables are inline on the shell element (rendered on the server, so server and client match) and portals re-pass them by hand (`AtlasMapPanel`'s `MapPanel` re-sets `--sky-1..3`). The proposal writes them once on `document.documentElement` after hydration, coalesced to one animation frame, so portalled sheets inherit them and the shell does not re-render on a scrub (ADR-008, ADR-021). Only `--sky-1..3` are registered with `@property` today; the other colours switch at once (WTH-270).

Contrast helpers: `luminance` and `contrast` are private in `palette.ts` and copied in three tests; one exported `contrastRatio` serves code and tests.

Preferences: `prefers-contrast: more` uses `surface-2` everywhere and full white; `prefers-reduced-transparency` drops the blur; `forced-colors` keeps shape and word for the verdict.

## 3. Components

| Component | Purpose | States | From today's code |
| --- | --- | --- | --- |
| MapCanvas | The one map | loading, ready, no token, failed | `AtlasMap.tsx`, keep (its relief sun is Torino's now: to take the instant and point, WTH-343) |
| Crosshair | The point being read | still, moving | `Crosshair.tsx`, keep |
| CentreReading | Place, temperature, sky, instant, provenance | moving, loading, ready, partial, error with "Riprova", instant unavailable | `PointReading.tsx`, adapt: drop the "Crea il poster" and "Il meteo del luogo" links, add the instant |
| Legend | What the colour is | normal, sample data, now-only | the field note in `WeatherFieldLayer.tsx`, adapt (section 4 of EXPERIENCE.md) |
| MapControl | Zoom, locate, north | rest, hover, focus, pressed, disabled | new base from the 44 px round button repeated in `AtlasSearch` and `AtlasMapPanel`; locate from `LocationSearch`'s geolocation; north from `MapCompass` reading the camera port |
| LayerSwitch | One of three layers | selected, focus, loading, unavailable here | new; the `.dock*` CSS (glass sibling, fallbacks, contrast and forced-colours handling) is the visual base, with radiogroup semantics instead of navigation |
| TimeBar + NowChip | The instant | now, chosen, dragging, days only, out of range | adapt `components/bar/MomentTrack.tsx` and `moment-keys.ts`; add day ticks, days-only range, fade after day 3, End |
| SearchField | Places now; peaks, lakes, routes later (WTH-355) | empty, typing, results, none, error, offline | `AtlasSearch.tsx`, adapt; extract the combobox shared with `LocationSearch` |
| NearbyList ("Qui intorno") | The map without the map | empty, list, loading | new; seed from `city-facts.ts` (`nearby`, `waters`, `peaks`) |
| Sheet (phone) / Panel (desktop) | One element laid out by CSS | peek, half, full; open, dragging, closed | adapt `MapPanel` in `AtlasMapPanel.tsx` (no drag or stops yet) |
| Card | Header, weather, facts, source | loading, ready, partial, error, instant unavailable | new; `TerritoryLine` and `CityFacts` content for the fact line |
| Verdict, WindowStrip | The answer and its hours | computing, ready | new; logic seed `best-window.ts` |
| DataRow, ProvenanceTag, CertaintyNote | Value with source and certainty | measured, model, estimated in altitude, missing | new; provenance words exist in `PointReading` |
| Status | One-line messages | info, error with action | new |
| Attribution | Mapbox, OSM, Open-Meteo, Wikidata | collapsed, expanded | new; `weatherCredit` moved out of `lib/record` (WTH-340) |
| WeatherIcon, Disclosure | Glyphs, detail on demand | | keep as they are |

## 4. Rules already true in the code

- Layers switch with `setLayoutProperty(visibility)` through `syncMap`; no `setStyle` anywhere.
- Zero React renders per camera frame, guarded by e2e render counters.
- The field is an image source updated with `updateImage`; feature overlays (routes, peaks) will be GeoJSON or a tileset with `setFeatureState`, stacked above the field's tint (WTH-350).
- `mapbox-gl.css` is imported three times today (`AtlasMap`, `MapBackdropGL`, `StylizedMap`); only `AtlasMap`'s stays.

## 5. Open for the user

- Inter Tight (today) or Inter (proposed); one family or with a serif italic for water names.
- The verdict hues, once seen over real fields.

## 6. Claude Design

"what-weather Atlante": https://claude.ai/artifact/4ecgeDMLxKfXqHspB4nE7a (private until the user shares it).

- Its seven themes are seven skies computed by the engine (`atmospherePalette` on clear midday, low sun, rain, snow, fog, thunderstorm, clear night); the engine files are unchanged at `a08157c`, so the values hold.
- Its `surface-1` and `surface-2` (alpha 0.62 and 0.92) hold over the field too: measured in code (WTH-342) over sunny fields from 10° to 36° with the map's inks, clear, rainy and night skies need 0.58 and 0.72; the scrim behind the reading needs 0.91 to 0.93 by day and 0.61 at night.
- Components there: MapControl, LayerSwitch, TimeBar, SearchField, CentreReading, NearbyList, Verdict, DataRow, Card, RouteCard, Status, and the FirstScreen page; the three layout examples and why are in its "Layout examples" section.
