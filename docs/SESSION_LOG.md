# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-20 (product reset, WTH-339)
- Worked on: the user found the direction unconvincing and asked to restart from the basics. Market scan (web search only: this environment blocks direct page fetches), the user's choices (A with C, Piedmont and the western Alps, non-commercial, only the colour engine, Tavola superseded), proposals by `architect`, `ux-ui`, `frontend`, the new docs and the Claude Design system.
- Found: this session's checkout was stale (2026-10-14) while the branch had moved to Tavola D3; the first draft of the docs was redone on the real code and its ids moved to ADR-030 and WTH-340+. The map is coloured by the weather field (temperature by place), not by one centre's sky; light ink over a bright field is unprotected (WTH-277).
- Not verified: Vercel edge caching, Tiling Service cost, Open-Meteo's daily budget, Wikidata QIDs.
- Next: the user's review of the docs and the design system; then WTH-340 and WTH-341.

## 2026-10-19 (Tavola unica: design, decision, C1)
- Worked on: the user rejected the three-tab home ("troppo separato", "va rivista completamente"). Six concepts and then a deep v2 of the chosen one as a Figma-style design document (artifact, boards W1 to W12 with desktop and phone, motion, states, words); the `ux-ui` agent reviewed it, the `architect` gave "via libera con condizioni" (ADR-028). The user agreed to the six choices. Committed the triptych work as a checkpoint, then C1 (pure data) with a `reviewer` pass.
- Not verified: anything on screen (C1 shows nothing new); the four spikes before the one map (WTH-307); Safari, a real phone, screen readers.
- Spikes S1 to S3 (WTH-307): clip-path and gestures pass in Chrome; the name in the cache key is a real risk, fix designed for C4. C2 (WTH-305) built by the `frontend` agent, reviewed, fixed; the home's e2e green, one load flake in the Keep list (passes alone 4 of 4).
- Next: the user's look at C2 on a computer and a phone; then C3 (the poster in place and the records).

## 2026-10-19 (Atlas weather field)
- Worked on: WTH-272 after the user chose the temperature's colour engine and asked that roads and everything follow each place's weather. First version (a field under the map, tone from the atmosphere engine) was too uniform, as the user's screenshot showed: at night the engine gives one dark colour to every overcast place, and roads and sea sat above the field. Rewritten: the temperature leads, a second layer tints everything.
- Not verified: how it looks at night and on a phone (the user's eyes), the legibility of white text over a bright field, Open-Meteo's meter and terms for about 48 calls per view, the antimeridian.
- Next: the user's look; WTH-277.

## 2026-10-18 (Atlas, place name and the user's new asks)
- Worked on: the place's name by zoom (ADR-024), a real geocoding probe, and the first answer to "the colours are always the same": the engine paints every overcast or rainy NIGHT almost the same dark (measured on twelve real places on 2026-10-18 at 22:26), and what the user means is a colour field over the map, not one sky (WTH-272, proposal only).
- New asks recorded, not started: the field (WTH-272), map controls (WTH-273), city search with a flight (WTH-274), the names' layout (WTH-275, options asked of ux-ui).
- Then, as the user chose (C, search, then controls): the title as option C (WTH-275), the city search with a flight (WTH-274, ADR-025). A real run flew Sicily to Bolzano (11 degrees against 16 in Sicily). The e2e for "a hand cuts the flight to a searched city" was dropped: Mapbox covers most of the distance in the first half of a flight, so distance is no measure and the same cut is tested with a direct flyTo.
- Then the map controls (WTH-273): the home's `MapPanelContent` extracted and reused. The panel as a column at the right on a computer, because the first version covered the crosshair.
- Review of the search, flight and controls applied: Enter left armed after a search that found nothing, the history pushed for a point the search did not ask for (both mutation checked), the panel's Escape taking the search's, the search and the panel fighting for the right of the screen (the search puts the panel away), "La Spezia", the sheet on a phone no longer covers the crosshair.
- Not verified: the geocoder's terms and cost, Safari, a real phone, how the flight looks (the user's).

## 2026-10-15 (Atlas M5)
- Worked on: M5 after the user's "prosegui": the point's sky from the home page's engine through the route, the zoom weight, `SkyDriver`, the map's inks, e2e for the sky (a night is not a morning, the sky holds while the map moves and the zoom sets it after the stop), a real run at Tokyo and Torino.
- Found: the shell now renders five times per stop (router transition, new sky): the mark and the readout are memoised and the render test is tighter for them. A mutation check made the sky test fail when the zoom is read per frame.
- Not verified: the look on a phone and on a computer (the user's), Safari, the dissolve of the markers and the map (WTH-270), the weights (WTH-271).
- Next: the user's review; M6 (the instant across places) not started.
