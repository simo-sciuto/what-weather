# AI USER TEST REPORT (WTH-251)

Status: EXECUTED. Ten missions were run by autonomous agents in isolated browser sessions against `http://localhost:3300` (application code of `3b68f9a`, served from the local production build). Results are only what the service logs and the agents' reports show. This report is separate from the human validation of WTH-227, which is not changed and not replaced by it.

## Method
- Each mission ran in its own browser context (cookies, localStorage and cache isolated), in a new agent session that received only the URL, the mission and the rules. No agent read the repository, the board or the documentation.
- The agent observes the page as text and a numbered list of visible controls, decides, acts, and verifies. The service records every observation and action in `ai-user-test/logs/<mission>.jsonl` (outside the repository), with timestamps; the agents cannot write to those logs.
- Browser: Chrome, headless, through Playwright 1.63 from the project's dependencies. No screenshots were taken and no image was downloaded, shared or printed.
- Devices: A08 is a Pixel 7 emulation in Chrome. It is not a real phone.
- Injected fault: A10 only. Mapbox requests were refused by the test service from 13:30:37 to 13:34:01 (UTC). The service logged both events. The refusal is not a product failure.

## Results by mission
| Mission | Device | Actions (failed) | Result | Evidence (from the log and the agent report) |
|---|---|---|---|---|
| A01 run 1 | desktop | 5 (4) | BLOCKED | Harness fault, not product: the service resolved element indexes differently in observation and action. Fixed in the service before run 2. Kept as evidence. |
| A01 run 2 | desktop | 5 (0) | PASS | Torino found through the search (5 suggestions); current conditions and next hours read from the page. |
| A02 | desktop | 9 (0) | PASS | Reached the preview of a Torino poster without naming any feature; drawing took about 12 s. Scarica and Condividi not pressed. |
| A03 | desktop | 6 (0) | PASS | Lisbona found; current conditions, next hours and eight days read; "Altri 5 giorni" opened. |
| A04 | desktop | 7 (0) | PASS | A non-existent place showed "Località non trovata. Prova con un altro nome." (shown twice in the page text). Recovery through Roma: 23°, sereno. |
| A05 | desktop | 9 (0) | PASS, limited | Napoli saved and still listed after F5. The reload URL already carried `name=Napoli`, so the check does not separate storage from the URL. Needs a visit to `/` without parameters to confirm persistence. |
| A06 | desktop | 10 (0) | PASS | Story format shown as "Storia 9:16 · PNG · 1440 × 2560 px". |
| A07 | desktop | 4 (0) | PASS | The territory section read: place, neighbouring towns, waters and peaks. |
| A08 | mobile emulation | 7 (0) | PASS | Torino to the preview on the phone emulation, through the poster tab. Not a device. |
| A09 | desktop | 20 (2) | BLOCKED | The hour 18:00 was chosen on the timeline, and the page header on the create page read "Previsione · Martedì 13 ottobre, 18:00". The moment line inside the image could not be read: the service is text-only and the rules forbid screenshots. The check is not possible with this method. |
| A10 | desktop | 13 (0) | PASS, limited | Injected Mapbox refusal. The app showed "La mappa non si carica. Controlla la connessione e riprova." The first retry failed; the refusal was lifted at 13:34:01 and the second retry drew the preview. The image itself was not seen: the agent judged the preview from the page state. |

Totals: 9 PASS (two of them with a stated limit: A05, A10), 1 BLOCKED by the method (A09), and the first run of A01 BLOCKED by a harness fault and superseded by its second run.

## Problems found in the product (observed, not yet verified by people)
1. **Old data shown as current.** On the same pages the header read "dati di 43 min fa" (A01), "dati di 47 min fa" (A07, A08, A10) while the footer read "Aggiornato alle 14:45" and the clock read about 15:30. The create page and the poster write "Adesso · Martedì 13 ottobre, 14:45" for that same reading. The cache allows a reading up to one hour old (`MAX_DATA_AGE_SECONDS`, with stale-while-revalidate). The label "Adesso" therefore describes data that is up to an hour old. The earlier claim in the protocol (about ten minutes) was wrong and is corrected here. Needs a product decision, not a change in this report.
2. **Selecting a suggestion takes a few seconds to show.** In A01, A02, A03, A04, A06, A07, A08 and A10, the first reply after clicking a suggestion still showed the previous city; the change appeared on the next observation (2 to 4 s).
3. **Poster drawing takes 10 to 15 s** on the desktop build (A02, A06, A09, A10). The agents waited for it; a human may not.
4. **Keyboard on the hour slider.** In A09 ArrowRight did not move the slider; filling its value did. The timeline end-to-end spec uses ArrowRight and passes, so this may depend on focus in the agent's flow. To verify with a person.
5. **Duplicate not-found message.** In A04 "Località non trovata" appears twice in the page text. Minor.

## Limits of the method
- The service is text-only. It cannot check what an image shows: the attributions in the picture, the moment line inside the image, the layout, the legibility. Those need a person looking at the picture, under the project's rules on screenshots. A09 is blocked for that reason.
- Agents chose their own steps, but the same model family built the product in this repository. The agents did not read the repository; this is a separate check, not a neutral one.
- Timings are the agents' own measures, taken around actions that take a few seconds each; they are indicative.
- Mobile results are a viewport emulation, not a device. A physical phone check is still required (see `docs/PHONE_LOCAL_TEST.md`).
- Five of the ten missions depend on which city the start page shows (the bare address lands on a random city, per ADR-017), so the agents' starting points differ. The results do not depend on it, because each mission searched for its own place.
- A PASS means the agent reached the state the mission asked for and read it in the page text. It is not a judgement of quality, usefulness or desire to keep the result.

## Not part of this report
- No human participant results. WTH-227 is unchanged.
- No UX conclusions. The problems above are observations to be checked by people.
