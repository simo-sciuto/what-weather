# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-02 (fourth session)
- Worked on: WTH-019 (trains, metro, tram, bus), WTH-016 (colour algorithm), WTH-015 (buildings from above: not solved, see BOARD); WTH-015..019 added to the board.
- Completed: see CHANGELOG, ADR-011 update. Checked: tsc, ESLint, palette, map-style and map-view unit tests (26 passed), screenshots of Tokyo at night with the metro, trains, trams and buses on (the map takes over 12 s to draw at zoom 14 in the headless browser: it is slow there, not broken).
- Not verified: the poster with trams and buses; the transit layers on a phone; the colours of the transit layers by day (the day sky made the map nearly invisible in the screenshots); no e2e (they run without Mapbox). Tram and bus layers only show from zoom 14, which the page reaches in the last fifth of the scroll.
- Next: the user chooses among WTH-017, WTH-018, WTH-010, WTH-009, WTH-013; WTH-012 is still waiting for their sign-off.

## 2026-10-02 (third session)
- Worked on: WTH-014 (3D buildings option and colour separation of water, roads and buildings).
- Completed: see CHANGELOG, ADR-011. Checked: tsc, ESLint, palette and map-style unit tests (new ones for the separation and the 3D layer), a screenshot of Milano with 3D on and the map tilted.
- Not verified: the full `palette.test.ts` in one run: its first test (white text on the sky, nothing to do with the map) took about 560 s in four runs, a single call stalling for that long, while alone it takes 4.5 s and no loop guard ever fired; not explained. The 3D layer on a phone and in the poster; the colour separation in the poster's colour bar; no e2e (they run without Mapbox).
- Next: the modal of "La mappa" (WTH-010), WTH-009, WTH-013.

## 2026-10-02 (second session)
- Worked on: WTH-012 and WTH-008 (the poster's top, the two actions), WTH-011 (random city), WTH-013 added.
- Completed: see CHANGELOG. Checked with a screenshot after each UI change (desktop 1440x900, phone 390x844; the user asked for this), tsc, ESLint, unit tests for the new random code, and e2e for reading, places and phone (8 passed, before the last reorder of the button row).
- Not verified: WTH-012 is not closed (the user has not signed it off); long names and the day picked in the week on the new composition; the random button and the landing have no e2e; the poster dialog and share on a real phone (WTH-013); the scrubbed-hour case of the range block was not looked at.
- Next: the modal of "La mappa" (WTH-010), then the colours of the "tinta" menu (WTH-009).

## 2026-10-02
- Worked on: filled BOARD DONE from git history.
- Completed: DONE rebuilt by theme (WTH-100..163) from the 13 commits' messages and file stats; CHANGELOG aligned with the same ids.
- Not verified: first-build items (WTH-100..119) come from one commit's file list and the README, not from a line-by-line diff review; tests, lint and build not run (docs only).
- Also: interactive board (`scripts/board/`, `npm run board`). Checked on a copy of the file: round trip byte for byte, add, move, delete, rejection of cross-origin and non-JSON writes; ESLint clean on scripts/. Not checked: the page itself in a browser.
- Next: the user picks a task, or confirms the audit candidates WTH-001..007.

## 2026-10-01
- Worked on: bootstrap of the project memory system.
- Completed: audit of the repo; wrote docs/ (ARCHITECTURE, PRODUCT, DECISIONS, BOARD, PROJECT_STATE, ROADMAP, CHANGELOG, INDEX), `.claude/agents/` (6), memory rules in CLAUDE.md.
- Not verified: tests, lint and build were not run (docs only).
- Next: the user picks a task.
