# PROJECT STATE

Last updated: 2026-10-20 (product reset, WTH-339; branch `claude/atlas-foundation` at `a08157c` plus the reset docs; nothing on `main` since 2026-10-12)

## Project
what-weather, an atmospheric atlas of Piedmont and the western Alps: a full-screen map painted by the weather, a time bar, three layers (Meteo, Territorio, Percorsi), cards for places, peaks, lakes and routes, and "È un buon momento per andarci?" on routes and peaks. Next.js 16 / React 19 / Tailwind 4 / Mapbox. Non-commercial. See VISION.md.

## Direction
Reset by the user on 2026-10-20 (ADR-030): Visual Weather Records, Explore and Create, and Tavola unica are dropped. Kept: the weather data layer, the colour engine (the only identity), the map style, the Atlas (ADR-019 to ADR-026, built). Pre-reset state: `a08157c`.

## Phase
Design and documentation. The code is still the Tavola app (ADR-029 D3) plus `/atlas`; nothing of the new UI is built.

## Active task
WTH-339. Step 1 (market scan) done. Steps 2 (docs) and 3 (design system) written and waiting for the user's review:
- docs: VISION, PRINCIPLES, EXPERIENCE, DESIGN_SYSTEM, ARCHITECTURE, ROADMAP, ADR-030; old docs in `docs/archive/` (`ARCHITECTURE_tavola.md` describes the code as it is).
- design system: "what-weather Atlante", https://claude.ai/artifact/4ecgeDMLxKfXqHspB4nE7a (private until shared): tokens from seven real skies of the engine, 11 components, the first screen.
Made with the `architect`, `ux-ui` and `frontend` agents. A first draft written on a stale checkout (2026-10-14) was redone on the real code; it survives only on a local branch.

## Last checkpoint
2026-10-20: the reset docs (this commit). Before it: Tavola unica D3 (`b2c9839`), superseded.

## Known problems / open questions
- For the user: Inter Tight (today) or Inter; a serif italic for water names or not; the verdict hues; the wording or east edge of the region box (it holds western Lombardy and Ticino); whether "colour engine" includes the field colour (assumed yes).
- The design system's surface alphas were measured without the weather field: to measure again (WTH-342, WTH-277).
- Not verified: Vercel's edge with `max-age` and no `s-maxage`; Mapbox Tiling Service cost; Open-Meteo's daily budget for point, field, spot and route; the Wikidata QIDs; Next docs on error and loading under a route group.
- This cloud environment cannot reach Wikipedia, Overpass or most websites: the data spike (WTH-341) needs access or a local run.

## Constraints to respect
- Provider abstraction and `WeatherData` (ADR-001); no keys in the client (ADR-002); one cached unit per place (ADR-003).
- The colour engine is the identity (ADR-012, ADR-026, ADR-030); PRINCIPLES.md.
- Italian copy, English code and docs.

## Next checkpoint
The user's review of the docs and the design system. Then WTH-340 (decouple the Atlas, moves only) and WTH-341 (data spike).
