# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-04 (product direction)
- Worked on: a startup-style review of the product (CEO, product, design, marketing, CTO, data, legal, finance).
- Decided by the user: direction Visual Weather Records (ROADMAP.md, ADR-013).
- Board re-prioritized: WTH-166 (licences) in NOW beside WTH-046; Records track WTH-167 to WTH-173 in NEXT with data trust and WTH-165; layout tasks WTH-017, 018, 022, 009, 015, 024 paused in LATER; WTH-174 to 176 as later products. Board parsed by the board tool.
- Not verified: market figures and licence terms are assumptions until WTH-166 and WTH-167.
- Next: unchanged, the user looks at the lab and K closes.

## 2026-10-04 (map hierarchy)
- Worked on: K closed and committed; WTH-046G. Mid-session the user added three requests (poster glow, transit stops, the poster's left column): on the board as WTH-179, 180, 181, not started.
- Completed: `mapVisualState` and its use in `mapInks`. The separation under weather took four attempts: weights inside the search (reverted, it moved hues with depth), then snow lifting the buildings with the ground (met the streets), the streets and 3D volumes taken out of the weights, and a wrong first measure (`p.map` keeps only the city layers apart: the test must use all layers).
- Checked: 107 tests in six suites; tsc and ESLint; live fingerprint unchanged. A `timeout` command does not exist on this macOS: several silent runs were that, not hangs.
- Reviewer pass: no critical problems; the main finding (separation not guaranteed after the weights) was real: widening the test to every light and ten mixes showed 0.011 with snow and a storm. Added a guard that eases the opacity factor; also made the 3D buildings follow the flat ones' colour. The lab's glow now matches the page's `.sky-glow` (it was harsher, without the clouds' dimming): a small change outside G, noted here.
- Not verified: the look in the lab, the user's.
- Next: the user's look; then H or the three new requests.

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

