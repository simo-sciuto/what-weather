# ROADMAP

The atmospheric atlas (VISION.md, ADR-030), in checkpoints. Each is small, mergeable alone and approved by the user before the next; only the first two are ready to start, the rest is revisited at each checkpoint (CLAUDE.md rule 2). From the `architect` agent's plan of 2026-10-20, checked against `a08157c`. The direction before the reset is `archive/ROADMAP_v1.md`.

Already built and kept (no checkpoint): the point after a stop (ADR-022), the sky from the point (ADR-023), place names (ADR-024), search with a flight (ADR-025), the weather field (ADR-026), the load key without names, the moment in the address.

## Now

Done on 2026-10-20: WTH-340, WTH-342 to WTH-348 (see BOARD.md DONE).

1. WTH-339: the user's review of the docs, the design system and the atlas at `/`.
2. WTH-341: data spike for Piedmont (extracts, sizes, Tiling Service, Open-Meteo call counting, LICENCES.md). No app code.

## The atlas

3. WTH-342: UI tokens in code, scoped to the Atlas shell, measured against the field.
4. WTH-343: time, data side (`AtlasPoint.frames`, `timeStore`, client `frameLook`, relief sun at the instant and point).
5. WTH-344: the time bar.
6. WTH-345: the hourly field.
7. WTH-346: the layer switch skeleton (Meteo, Territorio; the fate of the tuning panel).
8. WTH-347: `/` becomes the atlas. Gate: the user's look; then the user decides about `main`.
9. WTH-348: delete the superseded tree.
10. WTH-349 (optional): the point's cost and edge caching.

## Territory and routes

11. WTH-350: routes, peaks and population in the colour contract.
12. WTH-351: Territorio data and cards.
13. WTH-352: weather at a peak or lake, elevation-aware (its own ADR).
14. WTH-353: Percorsi (ODbL publication before going live).
15. WTH-354: "È un buon momento per andarci?".
16. WTH-355: search over peaks, lakes and routes (candidate).
