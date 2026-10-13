# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-13 (WTH-227 pilot authorised, protocol v1.2)
- Worked on: the morning checks on the local build (commit served, Open-Meteo reading, Mapbox and its attributions on Explore and on the poster, /crea, the preview, no blocking error): all passed. Protocol v1.2 before the pilot: section 0.1 with the authorisations and their limits, the no-demo rules, the spontaneous reaction to the poster in the sheet. Board: WTH-227 authorised for one desktop pilot, not complete; WTH-220 stays open.
- No push, merge, deploy or recruitment by the assistant. The pilot's material is kept apart from the five.

## 2026-10-13 (WTH-227 environment check, protocol v1.1)
- Worked on: checked the version to validate. Production serves `4591712` (Create answers 404); the code to validate is `87b87ea` (= `de8f3f4`), built locally: Explore with live data, Create with Mapbox, and the provider-failure message. Protocol v1.1 before the pilot: section 0 (the check), the pilot kept apart, the «Riprova» rule, decisions 10 to 12. No deploy, no push, no recruitment.
- Blocked for the phone sessions: a reachable address (needs authorization); the preview and WTH-220; the free API's licence for research.

## 2026-10-13 (WTH-227 protocol v1.0, decisions recorded)
- Worked on: applied the user's nine decisions to `docs/UX_VALIDATION_PROTOCOL.md` (v1.0, frozen for the sessions): three computer and two phone sessions, live weather with failure handling, no download or sharing until WTH-220, the price question last, indirect recruitment, notes only, the user as moderator, private sheets, orientative thresholds. Added the five separate synthesis groups, the consent draft in Italian, and the operational checklist. No code, no UI, no data changed. No result exists.
- Open for the user: whether session 1, the pilot, counts among the five.

## 2026-10-13 (WTH-227 protocol prepared, not run)
- Worked on: wrote `docs/UX_VALIDATION_PROTOCOL.md`: three hypotheses, five new participants, a 20-minute session, scripted wording, hint ladder, observation sheet, outcome categories, problem log, synthesis template, decision thresholds, and nine decisions for the user before recruitment. No code, no UI, no data changed. No result exists.
- Next: the user's decisions in section 12 of the protocol (devices, live or sample data, whether a download may be pressed while WTH-220 is open, price question, recruitment, recording, moderator, where the sheets live, thresholds).

## 2026-10-13 (merge to main, WTH-241, WTH-243, WTH-247 decided)
- Worked on: fixed the map's descent on the screen (WTH-241, 1.5 screens, calibrated on the closed page) and Create's poster independent of Explore's stored choices (WTH-243, poster bytes identical). Checked with Mapbox and the e2e suite. Merged `claude/create-record` into `main` as a fast-forward (`de8f3f4`, after the user's approval); no squash, no deploy. WTH-247: the week to a secondary section (ADR-018 update), not implemented.
- Verified after the merge: typecheck, lint, 433 unit tests. Not verified: the visual checks (descent with Dettagli, the dialog and preview by eye, a real phone).
- Next: product validation with five people (WTH-227), three questions: does Explore say what it is, is Explore → Create clear, would someone keep the poster. No features until then.
