# CREATE SPEC

Create (ADR-018): a place and a moment become a composition worth keeping. This file is the specification of Create V1: what it does, how it is built and how we know it works. Tasks live in BOARD.md (WTH-232 to WTH-240); decisions in DECISIONS.md.

Status: specification (WTH-232). Only WTH-233 (`CreateRecord` v1) is authorised for implementation. WTH-228 (Create MVP) stays behind the validation gates of ADR-018 (WTH-167, WTH-227) and the licences (WTH-166, 211, 212, 219, 220).

## Decisions this spec rests on (the user, 2026-10-13)

- Three **treatments** of the existing composition engine: Editorial (the default), Monochrome, Chromatic (`docs/COMPETITORS.md`). The A/B/C layouts removed on 2026-10-06 do not come back.
- **Bold** is the art direction, not a new identity: strong hierarchy, expressive type, controlled contrast, a closer relation between geography and text. Current faces (Syne, Inter Tight, Schibsted Grotesk) and `atmospherePalette` stay. Every visual change has a reason and a check.
- **Fixed map view** (ADR-018): zoom 11, flat, north up. No zoom or framing control in the MVP.
- **No paid export**, checkout or paid service until the licences are settled. No file is called print-ready before its print characteristics are verified (WTH-239).

## Flow

PLACE AND MOMENT, then COMPOSE, then REFINE, then EXPORT, in one persistent editor on `/crea`, never four pages.

1. **Place and moment.** The place from the URL (never random, ADR-017). The moment: now, or an hour of the live forecast (WTH-236). The past only through the historical provider and only as a reconstruction (ADR-016), after the validation gate.
2. **Compose.** The record engine composes automatically; the user never faces an empty canvas. Editorial is the default and already looks finished.
3. **Refine.** A short inspector: treatment, format, information shown (temperature, coordinates). Nothing technical.
4. **Export.** A final preview, then a PNG at the format's full size.

## Editor layout

- **Desktop:** inspector left, the composition centre and dominant, treatments as thumbnails right. Controls never compete with the artwork.
- **Phone:** the composition fills the screen, compact top bar, a bottom sheet for the inspector, treatments as a horizontal row, Export always reachable. Everything works without hover; safe areas, 44 px touch targets, reduced motion respected.

## The record model (WTH-233)

`CreateRecord` (`src/lib/record/create-record.ts`), the canonical, serializable description of one composition. Preview and export are both drawn from it.

```text
WeatherData -> PosterSnapshot -> CreateRecord { weather half | design half } -> RecordScene -> SVG -> PNG
```

- `v`: the schema version (1). A reader refuses a version it does not know rather than guess; a later version adds a migration from the previous one.
- **What was recorded** (never edited by the user):
  - `at` (Unix seconds) and `timeZone` (IANA or offset).
  - `weather`: the `RecordInput` snapshot, frozen when the record is made. Place, local clock, figures, provenance (interpolated, partial range, estimated) and credit travel inside it. Absent stays absent.
  - `source`: `provider` (the adapter's name), `kind` and, for a reconstruction, its `method` (reanalysis or forecast archive), `model` and `confidence`. A reconstruction only comes from the historical provider, and the historical provider only gives reconstructions. `kind` is one of:
    - `current`: the provider's current conditions (the live moment);
    - `forecast`: a model's value for any other hour of the live timeline, earlier hours of today included;
    - `reconstruction`: the past from the historical provider (reanalysis or forecast archive, ADR-016).
    There is no `observed`: no provider in use gives a station reading for the place, and the record must not claim one (rule 7).
  - `fetchedAt`: when the weather was read (Unix seconds).
- **How it is drawn** (the user's choices):
  - `design.treatment`: `editorial` | `monochrome` | `chromatic`.
  - `design.format`: `a4` | `story` | `square` (the format's id, not a print claim; WTH-239 aligns the poster's own key and label).
  - `design.show`: `{ temperature, coordinates }`, both on by default.
  - `design.view`: the map view, fixed to the base view in v1 (`{ zoom: 11, pitch: 0, bearing: 0 }`): `createRecordOf` does not take it and parsing refuses any other. It is stored so a future change is a new version, not a silent one.
- Serialization: JSON (`serializeCreateRecord`, `parseCreateRecord`). Parsing validates every field and returns a reason on failure; it never throws on bad input. It also checks that the fields tell one story (rule 7): `weather.date` is the day of `at` in `timeZone`; `current` is neither a whole day nor more than three hours from `fetchedAt`; a reconstruction is before `fetchedAt` and not before 1940, and a forecast archive not before 2017.
- Open, not decided: the shareable URL. A URL carrying the weather half reproduces the record exactly but its figures can be edited by hand; a URL carrying only place and moment reads the weather again and a forecast may have changed. To decide with the user before any public URL.

## Preview and export (WTH-234, WTH-235)

- The preview uses a **reduced resolution** sized for interaction; the export uses the **final resolution** of the chosen format. Both come from the same `CreateRecord` and the same composition (`getRecordComposition`), so layout, proportions, type and colour agree; only the pixel count differs.
- The map image is drawn once and cached. Its key covers: place, view, format (aspect), **resolution**, **palette** and the **identity of the weather data** (the snapshot's facts and `fetchedAt`, not the record object). Changing treatment, information shown or a design choice that does not touch the map recomposes the scene only.
- Export states: IDLE, PREPARING (fonts, map), RENDERING, READY; FAILED with a reason and a retry; UNSUPPORTED (no Mapbox token, a canvas too large for the device). One export at a time: a second click while one runs does nothing.
- Fonts loaded before measuring and before export (as today). Map attribution and the weather credit always printed.

### WTH-234 technical design (proposal, 2026-10-13; design only, nothing implemented)

**How a poster is drawn today** (`render-poster.ts`, `record-map.ts`, `browser.ts`), read from the code:

1. The scene is composed (`getRecordComposition`, raster path): this fixes `cityAt` and `nameBox`.
2. `drawRecordMap` opens an offscreen Mapbox map whose CSS box is the poster's size over `PIXEL_RATIO` (2), with `devicePixelRatio` overridden to 2, so the WebGL canvas is the poster's full size. `mapZoom` sets the zoom from that CSS box so the sheet spans `SPAN_METRES` whatever the size. It renders up to five times: the whole map, a water-only pass for the sea mask, and one to three tiers of the "cut" lines, choosing the fullest tier whose coverage of `nameBox` stays under `CUT_BUDGET`. Every pass is copied to a full-size 2D canvas; both results leave as PNG data URLs.
3. `calmestSlot` measures the whole map (downsampled by 8) and may move the facts to a calmer cell; the scene is composed again with `factsAt`.
4. The SVG, with the fonts and both map images inlined as data URLs, is drawn onto a full-size canvas and encoded as PNG. The preview is this final PNG.

So the map image depends on the place, the view, the CSS box (aspect and size), the palette (`map` inks and `sky2`), the map options, the sun (time and place), `cityAt` and, for the cut only, `nameBox`. The scene depends on the record and on `factsAt`, which depends on the map's pixels.

**Proposal.**

- **One map, two pixel densities.** Keep the CSS box of the final format for both preview and export and change only the pixel density: the preview at a low density (for example 0.5: a quarter of the export's width and height; to be settled by the benchmark), the export at 2 as today. Mapbox then picks the same zoom, the same tiles and the same features at both sizes; only rasterization differs. Shrinking the CSS box instead would lower the zoom by up to two levels at preview size and drop minor roads and labels, so the preview would show a different map from the export.
- **The map cache.** In memory only, for the editor's session (persisting Mapbox imagery would raise caching terms, WTH-219). Each entry holds the whole map, the sea mask and **all three cut tiers**, so the tier is chosen afterwards against `nameBox` in 2D, and a design change that moves the name never redraws the map. Key: place (lat, lon to 4 decimals), view, format (aspect), density, a digest of the palette's `map` inks and `sky2`, the map options, and the weather's identity (`source.provider`, `at`, `fetchedAt`). `cityAt` is in the key too: on the raster path it depends only on the aspect, and a test pins that so a future layout cannot break the cache silently. Entries as `ImageBitmap` or `Blob`, not data URLs; at most the current format's preview and one export entry; everything released when the editor closes.
- **The live preview without rasterizing.** The scene drawn as inline SVG in the page, with the map images as `blob:` URLs and the page's own fonts (already loaded for measuring). A design change recomposes the scene (pure, milliseconds) and re-renders the SVG; no Mapbox, no PNG. Text is escaped by `renderSvg` (`esc`). Only the export goes through `svgToPng`, where the SVG must stay self-contained (an SVG drawn as an image loads nothing), so data URLs are made only there.
- **The facts' cell decided once.** `calmestSlot` measured on the preview map, resampled to a fixed small size, and passed to the export as `factsAt`, so the facts never jump between preview and export. Today it runs on each size's own pixels and two sizes could choose differently.
- **The export.** Draw the map at density 2 (cache miss) or reuse it, compose with the preview's `factsAt`, `svgToPng`. Release each intermediate canvas (width set to 0) as soon as it has been used.

**Memory on a phone (estimates, to measure).** At 2480 × 3508 one RGBA canvas is about 35 MB. Today's export holds, at its peak, the WebGL drawing buffer, the whole copy, the sea mask, a tier canvas, the shadowed cut, the final canvas and two base64 strings, about 200 to 250 MB, near the canvas budget of iOS Safari. The proposal lowers the peak by releasing canvases early and by never building the preview at full size, but the export itself stays large. If the benchmark shows failures on an iPhone, the export says UNSUPPORTED for that format (WTH-235), never a half-drawn file.

**Impact on existing code.** `record-map.ts`: a density parameter in place of the fixed `PIXEL_RATIO`, all three tiers returned, canvases or blobs returned in place of data URLs. `render-poster.ts`: split into map preparation, composition and export. `PosterButton.tsx`: becomes the editor (WTH-235 and the inspector), reading a `CreateRecord`. `compose.ts`, `render-svg.ts` and `svgToPng`: unchanged. The lab's `record-on-map.ts`: untouched, keeps its own path. Explore: untouched.

**Risks.** A pixel density under 1 in Mapbox GL (to check; the code already overrides `devicePixelRatio`). Hairlines and labels thinner at preview density than they look at export. Each offscreen map is a WebGL context: keep one alive per editor session or remove it after each draw, never more. Tile loading dominates a cold render, so the first preview is no faster than today's; only the later changes are. The three tiers cost two extra render passes per map. Browser text measuring stays a cross-browser difference (WTH-195).

**Alternatives.**

| | Preview cost | Consistency | Memory on a phone | Cost and risk |
|---|---|---|---|---|
| A. Today plus a cache of finished PNGs | seconds per change | exact | high, every change | small change, preview stays slow |
| B. The proposal: one map at two densities, inline SVG preview | milliseconds after the first map | same map, same scene; rasterization differs | low for the preview, export as today minus waste | moderate change in three files |
| C. Draw the map once at export size, downscale it for the preview | one slow first render | exact | high from the first preview | simple, poor on phones |
| D. Server rendering (headless or a static map API) | network round trip | exact, fixes WTH-195 | none on the device | new infrastructure, cost, Mapbox terms (WTH-219, 220): not now |

**Criteria to choose, measured by the benchmark.** Time to the first preview and to a recomposed preview (target: under 100 ms after the map is cached); the difference between the preview and the export scaled down (layout identical, map features identical, a small per-pixel tolerance); the facts in the same cell; peak memory of an export on a recent iPhone and on a mid-range Android; no new dependency.

**The benchmark (isolated, not run yet).** A dev-only page under `/lab`, never shipped, that draws one place at densities 0.5, 1 and 2 with the same CSS box and records the render time, the zoom Mapbox reports, the rendered features in a fixed box (`queryRenderedFeatures`), `calmestSlot` at each size and, in Chrome, the JS heap. It needs a Mapbox token and a real browser, so it is run by hand on a computer and a phone; the e2e build has no token.

## Typography

- Display: Syne (the large type). Name and wordmark: Inter Tight. Metadata: Schibsted Grotesk. Numbers: tabular figures.
- Fitting before clipping: a long name is fitted (`fitName`, `fit.ts`), never cut.
- Test names: Oslo, Torino, San Sebastián, Reykjavík, Ho Chi Minh City (and "Thành phố Hồ Chí Minh"), Castellammare di Stabia. The Vietnamese letters (U+1EA0 to U+1EF1) are outside today's font subsets: WTH-237.

## Colour

`atmospherePalette` is the input. A treatment is a pure function of it (WTH-238): Editorial keeps it as today, Monochrome reduces it to paper and one ink, Chromatic opens it to the full range. Different weather stays distinguishable in every treatment; contrast of text on paper is checked (WCAG AA for small type).

## Measure (WTH-240, with WTH-226)

Events added to `lib/analytics`: treatment chosen, export started, export done, export failed (with the state it failed in). No personal data, no cookie, no service until WTH-226 chooses one.

## Acceptance for Create V1

- A first composition appears without any choice and looks finished.
- The same `CreateRecord` gives the same scene (same browser); the preview and the export agree in layout, proportion, type and colour.
- Provenance is on the record and never hidden: interpolated hours approximate, reconstructions said to be so.
- Works on a phone and a computer; keyboard and screen reader can reach every control.
- The export reaches READY or a clear FAILED or UNSUPPORTED, never hangs.
- Explore keeps working: the e2e specs reading, timeline, week, details, create pass.
