# UX VALIDATION PROTOCOL (WTH-227)

Version: 1.2 (changed before the pilot, see section 15). Status: PREPARED, NOT RUN. No session has taken place and no result exists. Nothing in this file is a finding.

Frozen for the sessions. The wording, the blocks and the thresholds do not change between participants. A change is allowed only after session 1 (the pilot, section 3.1), and then it is a new version recorded in section 15.

Purpose: test whether What Weather is understood without explanation (H1), whether people find Create and understand what it does (H2), and whether the poster it makes seems worth keeping, sharing or paying for (H3), as ADR-018 requires before more is built. The question is behaviour, not taste: what people do, where they hesitate, and what they say unprompted.

## 0. Preliminary environment check (2026-10-13, before any recruitment)

Version to validate: `main` at `87b87ea`. Its code is the code of `de8f3f4`; the later commits are documentation only.

| Check | Result |
|---|---|
| Commit in production (Vercel, project `what-weather`, latest production deployment) | `4591712`, from before Explore and Create. `/crea` answers 404. **Production is not the version to validate.** |
| Commit on `origin/main` | `4591712`. Local `main` is 14 commits ahead and not pushed. |
| Local build of `main` from a clean tree | Built without errors. |
| Explore with live data (Open-Meteo, the provider in `.env.local`) | Shows the time of the reading, the tagline, the link to Create and the Dettagli section. No console errors. |
| Create with Mapbox | The preview is drawn: PNG 2480 × 3508, about 13 s on the desktop build. No error message. The download control is present and was not pressed. |
| Provider failure (OpenWeather One Call, answered 401) | The page shows «Impossibile caricare il meteo ... Riprova». A clear message, not a blank page. |
| Mapbox token | The style endpoint answers 200. |
| Actions blocked by WTH-220 | The tasks need no download and no sharing. The preview draws the same image on screen: see the open decision below. |

Environment to use: a local production build of `main` (`npm run build`, then `npm start`) on the test machine. Nothing is deployed, and no deploy was made.

Blockers before recruitment:
- **Phone sessions need a reachable address.** Production does not serve the version. A deploy, or a push of `main` that triggers one, needs the user's authorization. Local alternative: a phone on the same Wi-Fi reaching the test machine. Not checked. The Mapbox token may restrict the origins it accepts.
- **The preview and WTH-220.** WTH-220 concerns the PNG with the Mapbox map. The preview draws that same PNG in the browser, so the block on downloads does not cover it. The user decides whether the preview may be shown during the sessions.
- **The free weather API.** The site uses Open-Meteo's free API, which LICENCES.md marks as non-commercial. The sessions sell nothing, but the user should confirm that this use is acceptable for research.

## 0.1 Conditions for the desktop pilot (decided 2026-10-13)

- **Scope:** one desktop pilot, in the local build of `main`, with one person who does not know What Weather. It is not one of the five valid sessions, and it is used to check the protocol, not to draw conclusions about the product.
- **Version:** the code served is the code of `87b87ea`. The later commit `d1dfd69` is documentation only, and the check of section 0 confirms that the application code is unchanged. The HEAD actually served is recorded in the pilot sheet.
- **Mapbox (operational authorisation, not a legal certification):** the preview may be shown on screen during the pilot, with the required attributions. The attributions are present: the Explore footer reads «Mappe: © Mapbox, © OpenStreetMap», the Mapbox logo of the background map is in the DOM and visible, and the poster image carries «© MAPBOX © OPENSTREETMAP» on its credits line (from the drawing code). Not authorised: downloading, sharing, printing or selling any image. WTH-220 stays open. Before any distribution or sale of exported images, the specific use must be checked against Mapbox's terms, which cover static copies and prints separately.
- **Open-Meteo (research use, documented assumption):** the free API is used for this non-commercial research pilot, without sale, advertising or promotion. Its free terms distinguish some kinds of commercial research and require an appropriate plan for them. Before the results are used for any commercial or promotional activity, the classification of this use must be re-evaluated, and clarified with the provider or a suitable plan chosen.
- **Recruitment:** one person for the pilot. Recruited by the user. Nobody is recruited by the assistant.
- **No deploy, no push, no merge.** The local build is used as it is.

Morning check (before the pilot), all must pass, otherwise the pilot does not run: the commit served, Open-Meteo reading, Mapbox working, Explore reachable, /crea reachable, preview generated, no blocking error. The check of 2026-10-13 passed on all of them, and the morning check must be repeated.

Note on freshness: the weather cache lets the page show a reading up to one hour old while it refreshes in the background (checked 2026-10-13: pages showed "dati di 43 min fa" and "47 min fa"), and the poster's "Adesso" line takes the same reading. The sheet records the time the site shows and the age the page states ("dati di … fa"), not the time of the session.

## 1. Research goals and hypotheses

| | Hypothesis | What would show it |
|---|---|---|
| H1 Comprehension | People understand what What Weather offers without an explanation. | Their first description, in their own words, names more than a weather forecast (a place, a sky, a poster, a visual experience), or at least does not describe it as only a weather app. |
| H2 Discoverability | People find Create without help and understand what it lets them do. | They reach a poster on their own, and describe Create as something that makes an image of a place. |
| H3 Desirability | The poster seems worth keeping, sharing or paying for. | They say they would keep, share or pay for it, and their unprompted behaviour points the same way (section 8, the last two groups). |

Limits, stated up front: five people give no market size and no conversion rate. They show recurring problems of understanding and use, and the first signs of what people want. They do not decide whether the product works commercially. Willingness to pay is only stated, never measured (section 9).

## 2. Participants

Who: five people who have never used What Weather and do not know the project.

Sample: three on a computer, two on a smartphone (decision 1). The phone sessions use the same browser and the same tasks, on a real phone.

Criteria:
- Italian speakers, comfortable with the Italian interface.
- Recruited through indirect acquaintances and word of mouth (decision 5): people the moderator knows only slightly, or through someone else. Not close friends or family, because they will hold back.
- Excluded: anyone who has seen the site or its screens, read about the project, or worked on any part of it, and anyone who receives a reward tied to what they say.
- Mix of design interest: at least two who say they buy or make visual objects for their home or as gifts (the first audience in ADR-018), and at least two who do not. Record each participant's answer to this as a recruitment fact, not a result.
- Record how each person was recruited (the channel), not who they are.

Not recorded: names, contact details, precise location, face or voice. Notes refer to participants as P1 to P5 (section 6). The moderator needs a contact to arrange the session. That list is kept separately from the notes, and deleted when the synthesis is written (consent, section 16).

## 3. Session structure (about 20 minutes)

| Block | Time | Purpose |
|---|---|---|
| Welcome and consent | 2 min | Set the frame, read the consent (section 16), take the answer. |
| A. First impression | 3 min | H1 |
| B. Free exploration | 6 min | H1, the Explore experience |
| C. Discovering Create | 6 min | H2 |
| D. Perceived value | 5 min | H3 |
| Close | 1 min | Thank, ask whether anything is missing. |

The moderator reads only the scripted lines in quotation marks. Anything else is a note, not a question.

Only the moderator speaks. A silent observer (decision 7, optional) writes timestamps and does not speak to the participant.

### 3.1 The pilot
One pilot session comes before the five. It checks whether the instructions are clear, whether 20 minutes is enough, and whether the step from Explore to Create can be observed without suggesting it. The pilot does not count among the five valid sessions (section 14). Its sheet is marked "pilot" and is kept apart from the five (section 13).

After the pilot, only methodological problems may be corrected, and each correction is recorded in section 15. During the five valid sessions the protocol does not change.

### Setup (before each session)
- Computer sessions: browser at 1440 × 900, the live site.
- Phone sessions: a real phone, the same browser, the live site.
- The live site, opened on the default place with no query string, so the participant sees what a stranger sees.
- Nothing open but the site. Notes sheet (section 6) and a timer visible only to the moderator.
- Run the provider check in section 11 before the session starts.

### Block A: first impression (3 min)
Show the homepage. Do not explain the project, the name, the tagline, or what the poster is.

Ask, in these words: «Secondo te, che cos'è questo sito e a cosa serve?»

Record the words used, in order, verbatim. Ask nothing else in this block, even if they are unsure. If they ask what the site is, answer: «Dimmi cosa pensi tu, non c'è una risposta sbagliata.»

### Block B: free exploration (6 min)
Task: «Cerca una città che ti interessa e guarda come cambierà il tempo nelle prossime ore.»

Use the place they choose. If they ask for a hint: «Fai come se fosse il sito che usi di solito.» Do not name any feature, control, or section.

Observe, do not interrupt: scroll behaviour, the map (touches, drags), the timeline, which controls they try, what they read aloud, where they hesitate, the information they look for and whether they find it. Stop at 6 minutes or when they say they are done.

Then ask, once: «Com'è stato? Che cosa ti è sembrato utile e che cosa no?»

### Block C: discovering Create (6 min)
Ask: «Vorresti avere un'immagine di questo posto da tenere. Come faresti?»

Then wait. Do not name any section. Observe whether they find the way to Create on their own, how long it takes, and whether they understand the steps that follow. If they stop completely for 60 seconds, use the hint ladder in section 5.

Once the poster is on screen, do not explain it. Ask: «Cosa vedi qui?» and record the answer.

If they reach the poster, they may look at the formats and the preview. Nothing else is pressed: see the rule on downloads and sharing in section 4. Ask nothing about the result yet.

### Block D: perceived value (5 min)
Ask, in order, and let them answer fully before the next:
1. «Che cosa faresti concretamente di questa immagine?»
2. «C'è qualcosa che cambieresti?»
3. «La terresti? Perché?»
4. «La condivideresti con qualcuno? Con chi?»

Do not ask for a score, a rating, or «ti piace?». Do not show prices or a price list in this block, at any point.

Only at the very end, if the block was reached with time to spare, ask: «Pagheresti per averla? Quanto, a parole tue?» Record the answer as a stated figure, never as a purchase. Do not suggest a figure, and do not show any price. (Decision 4.)

### Close (1 min)
«Grazie. C'è qualcosa che non ti ho chiesto e che avresti voluto dirmi?»

Do not explain the project, its direction, or what it is for. If they ask, say: «Ci piacerebbe capire cosa ne pensi prima di decidere. Te lo spiego a fine ricerca, se ti interessa.»

## 4. Rules for the moderator

- Never say that What Weather is becoming a creative platform, an editor, a studio, or a product for designers. Participants must discover what the product is from the product itself. If they describe it as only a weather app, record it as the result.
- Never say the word Create, nor name the poster, the editor, the download or the sharing before the participant does.
- **No download and no sharing, in any session** (decision 3, and the same rule applied to «Condividi»). On a phone, «Condividi» sends a copy of the image out of the page, which is the same question as the download (WTH-220). If a participant presses «Scarica» or «Condividi», the moderator says: «In questa prova l'immagine resta sullo schermo: non la salviamo né la inviamo.» The attempt is recorded: it is a sign of desirability, not a failure of the task.
- The session must not look like a demo. No explanation of What Weather's vision at the start or during the session. No suggestion of where Create is. No comment on the graphic quality of the poster, positive or negative. No description of a feature before the participant has found it. The point is to learn whether the product works without its creator guiding it.
- Never point at, touch or open anything for the participant.
- Never explain a control or a message. Record the confusion.
- Never react to an opinion with praise or doubt. Say «Capito» or «Dimmi di più».
- Do not repeat the participant's answer back as a question that leads.
- If something breaks, follow section 11 (provider and map failures), not improvisation.

## 5. Hint ladder (for stuck participants only)

Use one step at a time, and record which step was used and when.

| Step | Trigger | Say |
|---|---|---|
| 0 | none | nothing |
| 1 | 60 seconds stuck | «Ci sono altre cose che potresti fare qui: prova a guardare intorno.» |
| 2 | 90 seconds more | «Prova a vedere se trovi qualcosa che riguarda il luogo stesso.» |
| 3 | 2 minutes more | The moderator stops the block and records a failure (not a hint). |

Step 3 never names Create or shows where it is.

## 6. Observation sheet (one per participant)

Fill in during the session in keywords; complete it within 10 minutes of the end. Store it privately (section 13).

```
Protocol version: 1.0 (or later)   Pilot (session 1): yes / no
Participant: P_   Date: __   Time shown on the site (the first reading): __
Device: computer / phone   Design interest: yes / no   Recruited by: channel only
Place chosen in Block B:
Block A, their words, verbatim:
Block A, understood the product? (describes more than a weather app: yes / partly / no)
Block B: what they looked at, hesitations (timestamp):
Block B: controls tried, in order:
Block C: time to find the way to Create (seconds):
Block C: how they found it: alone / after hint 1 / after hint 2 / not found
Block C: time to a poster on screen (seconds):
Block C: formats looked at:
Block C: attempt to download or share (Scarica / Condividi): yes / no, when:
Block D, stated uses, verbatim:
Block D, would keep it? yes / no / unsure, why:
Block D, would share it? yes / no / unsure, with whom:
Block D, stated price, verbatim (if asked):
Reaction to the poster, spontaneous, before any question of Block D (tick all that happen, in order, with timestamps):
  [ ] looks at it and moves on     [ ] tries to change it (what, where):
  [ ] tries to save or share it (Scarica / Condividi pressed or looked for; the moderator says the image stays on screen)
  [ ] asks what it is for     [ ] other, verbatim:
Spontaneous signals (before Block D's questions, unprompted): 
Outcome for Create: autonomous success / assisted success / failure / technical interruption
Problems (use the log in section 7):
Anything unexpected they said or did:
```

## 7. Outcome categories and problem log

### Outcome, per participant, for the Create task
- **Autonomous success:** reached a poster on screen without any hint.
- **Assisted success:** reached a poster after hint 1 or hint 2.
- **Failure:** did not reach a poster by the end of the hint ladder, or gave up.
- **Technical interruption:** the provider or the map failed (section 11) before the task could be completed. Not counted as a success or a failure. Recorded with its cause, and the session is repeated with another participant or later.

### What counts as "unprompted"
An answer is unprompted when it comes before the question that asks for it. For example, a participant who says «la terrei» during Block C has given an unprompted signal. For H1, the question is the first answer to Block A.

### Problem log
Each problem is recorded once, with an ID (U1, U2, ...), and then counted across sessions.

| Field | Values |
|---|---|
| Where | the screen or step (e.g. «scoperta di Create, pagina di Explore») |
| What happened | one line, observed, no interpretation |
| Frequency | number of participants who met it, out of 5 |
| Severity | 1 cosmetic, 2 slowed them, 3 stopped them until a hint, 4 stopped them for good or led them to a wrong conclusion |
| Evidence | participant ID and timestamp |

A problem found in one session is recorded as a candidate. It is counted as recurring only when at least two participants meet it.

## 8. What the synthesis reports, in five separate groups

Keep these five groups apart. Never add them into one score.

1. **Comprensione del prodotto (H1).** What they said the product is, in Block A, without help: the number who described more than a weather app, and their words, most used.
2. **Successo nell'utilizzo (H2).** Outcome for Create: autonomous, assisted, failure, technical interruption. Time to a poster on screen, for autonomous successes only. Grouped by device.
3. **Interesse dichiarato.** What they said in Block D when asked: would keep, would share, what they would change, what they would do with it. Stated, not observed.
4. **Comportamento spontaneo che indica desiderabilità.** Observed, unprompted, before Block D's questions: an attempt to download or share; asking where the image is kept; describing a use without being asked; staying on the poster or returning to it; changing a format to see another. Count each sign once per participant.
5. **Disponibilità dichiarata a pagare.** Only the answer to the last question, as a stated figure, verbatim, with the number who gave one. Never a purchase. Never an average presented as a price.

## 9. What this does and does not test

- It tests understanding, the success of the task, stated interest, and unprompted behaviour.
- It does not test willingness to pay. A stated figure is a claim, not a purchase. A real purchase test, with a declared test checkout, is a separate later experiment (WTH-172, after WTH-166, 211, 212, 219 and 220 are settled).
- It does not test print. Print comes after the first digital sale (ADR-018).
- It does not test past dates (WTH-169), since the sessions use the weather of the day.
- It does not test the download or the sharing (WTH-220).
- Results depend on the day: the weather shown is live, so each sheet records the time shown on the site.

## 10. Decision criteria

These are working thresholds, kept from the earlier version as orientative criteria (decision 9). They are set before the sessions and questioned after them. They are not benchmarks, and five people are not a representative sample. They decide what to look at next, not what is true about the market.

| Result | Reading | Next step |
|---|---|---|
| H1 at least 4 of 5, H2 autonomous or assisted in at least 4 of 5, H3 keep or share in at least 3 of 5 | The value is clear and the way to Create works. | Proceed with Create V1 as the specification says (WTH-228, after the user's decision on the gates of ADR-018). |
| H1 at most 2 of 5, but H3 at least 3 of 5 | The poster is wanted, the site does not explain itself. | Simplify Explore: the first screen says what it is, before the weather. Build nothing in Create until that is tested again. |
| H2 failure in at least 3 of 5 | Create is not found. | Make the way to Create clearer on the existing screen, then test again before building Create's flow further. |
| H3 at most 2 of 5 keep or share, with H1 at least 4 of 5 | The product is understood as a weather app, and the poster is not wanted. | Revisit the positioning in the documents and the interface before more building. |
| Mixed results | Not enough to choose. | Run a second round of five with the one change that the problem log points to. |

Problems of severity 4 are reported to the user at once, whatever the counts.

## 11. Provider and map failures (live data)

The site shows live weather, so it can fail on the day. Failures are handled the same way in every session.

Before each session (the provider check):
- Open the site on the place and the time of the protocol, and wait for the first reading.
- If the reading does not appear within 30 seconds, or the page shows an error, do not start. Reschedule the session.

During a session:
- If the weather stops loading or shows an error: say «Un attimo», note the time, and wait up to 2 minutes.
- If it recovers within 2 minutes, continue from the start of the block that was interrupted, and note the interruption in the sheet. The session is kept.
- If it does not recover within 2 minutes, end the session as a **technical interruption**. It is not counted in any outcome. Repeat it with another participant, or with the same one at a later date.
- If the page shows «Impossibile caricare il meteo», the participant may press «Riprova» once. Let them. The press is noted, and the wait above starts from it.
- If the map does not load, the poster cannot be drawn, because the poster is made with the map. A map failure that stops Block C is a technical interruption.
- If the page shows only part of the data (some chapters missing, or an old time), note what is missing and whether the participant noticed. This is a product observation, recorded in the problem log, with the severity it causes.

Never explain the failure to the participant beyond «Un attimo». Never describe it as a bug of the test.

## 12. The record of the day

Each session sheet records the date and the time shown by the site, because the results depend on the day (section 9). A session on a day of severe weather and a session on a calm day are not comparable as the same experience. Note it, and do not correct for it.

## 13. Where the material lives

- The observation sheets, the recruitment list and the consent forms are kept in a private folder, outside this repository (decision 8). They hold the participants' words and contacts.
- Do not commit any sheet, note, or contact to the repository.
- The pilot's observations are kept in their own folder, labelled "pilota". They are not merged into the synthesis of the five valid sessions, and the synthesis template does not include them.
- The repository keeps this protocol, and, after the sessions, a synthesis with no names, only the P-codes, the counts and the verbatim phrases that carry no personal detail.

## 14. Decisions taken (recorded, 2026-10-13)

1. **Devices:** three computer sessions, two smartphone sessions.
2. **Data:** live weather, with the failure handling in section 11.
3. **Downloads:** none during the tests until WTH-220 is resolved. This also covers «Condividi» (section 4).
4. **Price question:** only at the end, without a suggested price or a price list.
5. **Recruitment:** through indirect acquaintances and word of mouth, excluding anyone who knows the product.
6. **Material:** notes only, no audio or video recording.
7. **Moderator:** the user. A second observer is optional and silent.
8. **Sheets:** stored privately, outside the repository.
9. **Thresholds:** kept as orientative criteria, not as representative results.

10. **The pilot** (section 3.1) does not count among the five valid sessions. Total: one pilot and five participants. Decided 2026-10-13.
11. **Changes after the pilot** are methodological only, and each is documented in section 15. The protocol is frozen during the five valid sessions. Decided 2026-10-13.
12. **Environment check** (section 0) is done before any recruitment. Recruitment and deploy wait for the user's authorization.

## 15. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-13 | First version, with the decisions of section 14. |
| 1.1 | 2026-10-13 | Before the pilot: section 0 (environment check, recorded), section 3.1 (the pilot is not among the five), the «Riprova» rule in section 11, the separation of the pilot's material in section 13, decisions 10 to 12 in section 14. No change to the questions, the blocks or the thresholds. |
| 1.2 | 2026-10-13 | Before the pilot: section 0.1 (desktop pilot conditions, the Mapbox and Open-Meteo authorisations and their limits, the morning check, the freshness of the reading); the no-demo rules in section 4; the spontaneous reaction to the poster in the sheet (section 6). No change to the questions, the blocks, the hint ladder or the thresholds. |

## 16. Consent (Italian draft, for the user's review)

Draft. To be reviewed by the user before use. It is a plain statement, not legal advice; if the user needs a formal privacy notice, it must be checked for the country it is used in.

> **Ricerca sull'esperienza di un sito web: consenso a partecipare**
>
> Grazie per il tempo che dedichi a questa conversazione. Stiamo osservando come le persone usano un sito web in fase di sviluppo, un servizio meteo con una parte dedicata a immagini di luoghi. Non stiamo valutando te: stiamo valutando il sito.
>
> La partecipazione è volontaria. Puoi interrompere in qualsiasi momento, senza doverne spiegare il motivo, e puoi chiedere che le tue risposte non vengano usate.
>
> Durante la sessione chi conduce la prova prende appunti a mano. Gli appunti non riportano il tuo nome né i tuoi contatti: sei indicato con un codice, ad esempio "P1". Il nome e il contatto servono solo a organizzare la sessione: vengono conservati separatamente dagli appunti e cancellati quando la ricerca è conclusa.
>
> Non registriamo audio né video. Non ti chiediamo di acquistare nulla e non scarichiamo né condividiamo alcuna immagine durante la prova.
>
> Useremo gli appunti solo per questa ricerca, e nei risultati scriveremo solo frasi senza dati personali.
>
> Ti chiediamo di confermare, con una risposta sì o no, di aver letto questo testo e di voler partecipare.
>
> Nome del partecipante (solo per l'organizzazione, non negli appunti): __________
> Data: __________   Risposta: sì / no
> Firma o conferma verbale annotata dal moderatore: __________

Notes for the moderator, not read aloud: confirm the consent verbally before the first question, and write «sì» or «no» on the sheet. If the answer is «no», end the session politely and record nothing about the person beyond the fact of the refusal.

## 17. Operational checklist for the first session

Before the session:
- [ ] Environment check (section 0) repeated on the morning of the pilot, with the commit that is served and the provider reading.
- [ ] Consent text (section 16) reviewed by the user.
- [ ] A participant recruited by the agreed channel, not knowing the product.
- [ ] Device ready: a computer at 1440 × 900, or the phone, with the live site opened once.
- [ ] Provider check (section 11) passed on the same day, and the user has decided the open points of section 0 (phone address, the preview).
- [ ] Observation sheet printed or open, marked "pilot" for session 1, with the protocol version.
- [ ] Timer ready, visible only to the moderator.
- [ ] Private folder ready (section 13).

During the session:
- [ ] Consent read and answered (Block welcome).
- [ ] Block A: the exact question, verbatim notes.
- [ ] Block B: the task, one hint at most at a time, the scroll and the map observed.
- [ ] Block C: the task, the hint ladder if stuck, the attempt to download or share recorded if it happens.
- [ ] Block D: the four questions in order, the price question last and only if there is time.
- [ ] Close: the closing question.

After the session:
- [ ] Sheet completed within 10 minutes, keywords expanded.
- [ ] Outcome, the five groups of section 8, and the problem log updated.
- [ ] Session 1 only: note the points the protocol could not support (wording, timing), in section 15 as candidate changes. Do not change the protocol until the pilot is reviewed.
- [ ] Sheet stored in the private folder, nothing committed.

## Related

- ADR-018 and `docs/ROADMAP.md` (the direction, not to be explained to participants).
- `docs/CREATE_SPEC.md` (what Create is meant to do; for the synthesis, not for the moderator).
- WTH-227 (this study), WTH-172, WTH-166, WTH-211, WTH-212, WTH-219, WTH-220 (conditions before any purchase test and before any download).
