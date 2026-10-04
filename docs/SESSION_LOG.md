# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-04 (product direction)
- Worked on: a startup-style review of the product (CEO, product, design, marketing, CTO, data, legal, finance).
- Decided by the user: direction Visual Weather Records (ROADMAP.md, ADR-013).
- Board re-prioritized: WTH-166 (licences) in NOW beside WTH-046; Records track WTH-167 to WTH-173 in NEXT with data trust and WTH-165; layout tasks WTH-017, 018, 022, 009, 015, 024 paused in LATER; WTH-174 to 176 as later products. Board parsed by the board tool.
- Not verified: market figures and licence terms are assumptions until WTH-166 and WTH-167.
- Next: unchanged, the user looks at the lab and K closes.

## 2026-10-04 (unified palette)
- Worked on: WTH-046H, after "ok" (WTH-181 committed first, `ff6026e`).
- Completed: the evaluation (one place makes the live palette, three readers) and the smallest contract that fits it: `SkyPalette.air`, passed by the map controls, quantized to 0.02. Not added: the plan's `atmosphere` and `surfaces` groups (a second copy of state that already travels in `FrameLook`).
- Checked: 44 sky tests (4 new), palette, invariants, map-style, bloom and pipeline suites; tsc and ESLint; the live fingerprint with `air` set aside. A test failed once on a weight at exactly half a step (0.85 / 0.02): chosen away from the boundary.
- Reviewer: no critical or important problems; the weights test now starts from a hand-written air at step centres, a faint air is tested to be clear air, and the doc's G note was reconciled.
- Next: WTH-046I.

## 2026-10-04 (poster without sentences)
- Worked on: WTH-181, after "proseguiamo": the outlook sentences removed from the hero, the name and temperature block to the top, the Luogo, Giorno, Ora row to the foot (on a phone the name rises, the facts stay at the foot).
- Found late: ADR-013 (the user's product direction of the same day) pauses layout work on the live app, WTH-017 among it. I should have read DECISIONS.md before starting: flagged, change left uncommitted, WTH-182 (stop overlap) was added meanwhile.
- Checked: tsc and ESLint clean. Not run: e2e. Not verified: the look.
- The user confirmed WTH-181 knowingly ("ok per tutto"), with PRODUCT.md updated and WTH-024 closed. Recorded in DECISIONS as a one-off exception to ADR-013's pause.
- Next: WTH-046H, or whatever the user picks (WTH-182 stops overlap, WTH-165 phone search).

