# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-04 (calibration round two)
- Worked on: round one committed (`45bfcfb`); then the snow decision. The user said rain, snow and fog are separate values, which settled both open points: no precipitation counted as haze, and snow with its own strength.
- Completed: `snowInfluence`, `hazeLoss` as the residual after the fall's own strength, heat and cold at 0.8. The three snow scenarios, heavy rain and humid fog came back to the expectations written before measuring.
- Checked: 90 tests in five suites; tsc and ESLint; live palette unchanged.
- Not verified: the look in the lab, the user's. Downpours and snowfalls with bad visibility no longer flatten the map: to be judged there.
- Next: the user looks; commit; K's remaining invariants (grayscale, timeline, conflicts).

## 2026-10-04 (calibration round one)
- Worked on: F committed (`d58c2ff`), then WTH-046K's first round after asking the user three questions (signature, haze, UV).
- Completed: signature by weights (cloud 0.6, haze past the onset), visibility-led haze with a 10-to-1 km loss, six scenario expectations corrected from the measurements, two gate tests. Changing the weights alone would not have kept rain with 9 km of view out of the fog depth: the visibility curve had to move too.
- Checked: 89 tests in five suites (visual-input, atmosphere, pipeline, sky, palette); tsc and ESLint; the live fingerprint unchanged.
- Not verified: the look of the new scenarios in the lab (the user's). Snow still open.
- Next: the user looks; commit K; decide snow.

## 2026-10-04 (atmospheric depth)
- Worked on: WTH-165 added to the board (phone search bar); E committed after the user's sign-off; WTH-046F.
- Completed: depth from haze and map planes as a final opacity step. A first version that lowered contrast targets before the separation search jumped between colour variants (a layer could come back stronger or change hue): replaced.
- Checked: live inks byte-identical on 2,232 sets, now guarded by a fingerprint test; 31 tests in `atmosphere-sky` (42 with `palette`); tsc and ESLint. Reviewer: no critical problems; fixed a tautological test, added separation and visibility tests, kept 3D buildings opaque; integration follow-ups on WTH-046L. Full-page lab screenshot sent to the user at their request.
- Not verified: the look, which is the user's call. Snow and rain with moderate visibility reach near-zero depth because of the saturated-air haze baseline (K finding).
- Next: user looks at F; commit; WTH-046K.

## 2026-10-04 (atmosphere transform)
- Worked on: board tidy-up (WTH-046 plan moved into WEATHER_VISUAL_ENGINE.md), checkpoint commit of A-D on `feature/visual-engine`, then WTH-046E with the start of K.
- Completed: the bounded OKLCH transform, the shared finish, 16 calibration scenarios, the dev-only lab. A first trial collapsed every wet sky onto one grey (multiplied pulls, a veil above the white-text cap): fixed with combined pulls, a veil cap at 0.56 and the haze onset at 0.45. A four-lens review workflow confirmed 13 problems (floors bypassed, snow veil turning magenta at dusk, tests that could not fail, lab twilight, docs); all fixed.
- Checked: live `skyPalette` byte-identical on 4,464 palettes; 135 tests across nine suites (24 new, one verified to fail when the green rule is removed); tsc and ESLint; the lab served 200 by the dev server.
- Not verified: how the scenarios look, which is the user's call in the lab; no screenshots taken (project rule). Not on the live page, map or poster.
- Next: the user looks at `/lab/atmosfera`; then WTH-046F. Open K findings: signature grammar (A), saturated-air haze and UV curve (B).

## 2026-10-04 (timeline checkpoint)
- Worked on: WTH-046C, atmospheric transport through provider adapters, hourly samples, frames and FrameLook.
- Completed: optional atmospheric measurements/origin metadata, unit conversion and unavailable-value handling; labelled free-tier dew estimates; missing-aware interpolation and exact endpoints; synthetic daily overviews; selected-frame atmosphere derivation alongside the unchanged palette. Updated architecture, board, project state and ADR-012.
- Checked: 92 tests passed across six relevant suites (10 new pipeline tests, provider fixtures and existing model/narrative/activity/best-window regressions); targeted ESLint passed. Code/doc diff and board parser/ID preservation reviewed. Full TypeScript check (`tsc --noEmit --incremental false`) passed.
- Not verified: live provider accounts, browser/E2E or final visual calibration. Current-detail numeric defaults remain for compatibility, but are excluded from the atmospheric pipeline. No UI, map, poster or palette changes.
- Next: WTH-046D, solar base palette. WTH-046M remains PARKED.

