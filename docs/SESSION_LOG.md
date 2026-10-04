# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-04 (product direction)
- Worked on: a startup-style review of the product (CEO, product, design, marketing, CTO, data, legal, finance).
- Decided by the user: direction Visual Weather Records (ROADMAP.md, ADR-013).
- Board re-prioritized: WTH-166 (licences) in NOW beside WTH-046; Records track WTH-167 to WTH-173 in NEXT with data trust and WTH-165; layout tasks WTH-017, 018, 022, 009, 015, 024 paused in LATER; WTH-174 to 176 as later products. Board parsed by the board tool.
- Not verified: market figures and licence terms are assumptions until WTH-166 and WTH-167.
- Next: unchanged, the user looks at the lab and K closes.

## 2026-10-04 (calibration round three)
- Worked on: round two committed (`b30b48b`); then K's remaining invariants.
- Completed: grayscale, timeline and conflict tests. The timeline sweep found the noon jitter (14/255, non-monotone): traced through two wrong guesses (the final gamut step, then the text protection) to the stepped gamut reduction inside it; fixed in the atmosphere path with bisection, live path untouched.
- Checked: 101 tests in six suites; tsc and ESLint; live fingerprint unchanged. Thresholds are measured values with a point of margin.
- Reviewer pass: no critical problems; fixed the bisection's final check, the tripwire (now sky and map), the conflict contrast test, removed an empty test.
- Not verified: the look, the user's.
- Next: user's look; commit; close K; WTH-046G.

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
