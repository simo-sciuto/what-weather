# SESSION LOG

Short diary of the last sessions, newest first. Keep to about five entries; consolidated state goes in PROJECT_STATE.md.

## 2026-10-13 (phone feasibility on the local network, WTH-248 found)
- Worked on: documented the feasibility of phone tests on the local Wi-Fi (`docs/PHONE_LOCAL_TEST.md`): the build served on the LAN with a command-line flag; plain HTTP limits (location and sharing differ, checked in an emulated Pixel 7, not a phone); provider calls stay on the server; the Mapbox token answered from every origin tested, to be checked in the account; the preview's risks on a phone. No project file changed, no push, no deploy, no participant. The server was stopped after the checks.
- Found: the development labs `/lab/atmosfera` and `/lab/record` answer 200 in production and locally (WTH-248).
- Not verified: any real phone. The physical checks are listed in the document.

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
