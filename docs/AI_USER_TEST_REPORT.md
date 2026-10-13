# AI USER TEST REPORT (WTH-251)

Status: NOT EXECUTED. No agent session has run, and no result exists. This report is separate from the human validation of WTH-227 and does not replace it.

## Why it did not run (2026-10-13)
- An interactive browser for agents, isolated per mission, is not available in this environment. The local Playwright setup runs fixed scripts, so it does not let an agent choose its next action. The Chrome extension tools act on the user's own profile, which is not isolated.
- The rule that agents do not read code or the board before a test cannot be enforced inside this repository. It would need an empty workspace with only the URL.
- Mobile missions would be viewport emulation, not a real device, and must be reported as such.
- Mission A10 needs an injected Mapbox failure, which must be declared as an injected fault.

## Missions (not run)
A01 Torino weather · A02 spontaneous path to Create and preview · A03 Lisbona forecast · A04 empty search and recovery · A05 persistent favourites · A06 story format · A07 territorial exploration · A08 mobile Explore → Create · A09 future hour carried into the record · A10 injected Mapbox error and recovery.

## Results
None. Every mission is to be recorded with: agent ID, goal, browser and viewport, commit tested, actions, observable evidence, measured time, PASS / FAIL / BLOCKED, errors, and limits of the check.
