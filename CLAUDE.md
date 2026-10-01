@AGENTS.md

# what-weather

A calm weather web app styled as a Swiss poster. Next.js 16, React 19, Tailwind 4, Mapbox. Italian UI, English code. Details in docs/PRODUCT.md and docs/ARCHITECTURE.md.

## Project memory

The repository is the source of truth, not the chat. Memory lives in `docs/`; `docs/INDEX.md` says what to read for which task.

At the start of a session read `docs/PROJECT_STATE.md` and `docs/BOARD.md`, then reply briefly: project, active task, last checkpoint, blockers, next step. No long summary. Read other docs only when the task needs them, and code only for the current task.

Never claim something is done unless it was implemented and checked. Do not rely on a feature existing because it was discussed: verify in the code.

## Rules

1. Preserve the architecture. No rewrite without explaining: current problem, why it is insufficient, alternative, migration cost, risks, benefit. Then wait for approval.
2. If a change spans more than one significant part of the architecture, stop and propose a checkpoint first.
3. Keep the provider abstraction and `WeatherData`: the UI never reads raw provider payloads. No API keys in client code.
4. No new dependency without a justification the current stack cannot meet.
5. Do not change APIs or data contracts casually.
6. Preserve the poster identity and progressive disclosure. A visual change needs a functional reason; no arbitrary redesigns.
7. Weather data is product data: mind timezone, timestamps, units, provenance, measured vs interpolated, min/max, missing data. Never hide uncertainty behind polish.
8. Accessibility, responsive behavior and performance are part of done.
9. If a task conflicts with docs/DECISIONS.md, flag it before changing anything.

## No drift

Work on the current task only. Unrelated bugs, ideas and improvements found on the way are added to `docs/BOARD.md`, not implemented.

## Board

When the user says "aggiungi alla board", "mettilo in board", "aggiungiamo questo alla board": add the item to `docs/BOARD.md` right away (next free WTH id, usually in NEXT), confirm in one line, and do not start it.

When the user says "segna come fatto", "completato", "chiudi questo task": move the item to DONE.

Board state is never kept only in chat.

The user can also edit the board in the browser with `npm run board` (http://localhost:4321), which writes `docs/BOARD.md` directly. The file can therefore change between two of your turns: read it again before editing it. Keep the task line format `- [ ] WTH-nnn text`, which that tool parses.

## Working method

Inspect the relevant code, state the approach briefly, make the smallest coherent change, validate it, then stop at a clean checkpoint. For a meaningful checkpoint, have the `reviewer` agent look at it before calling it complete.

Validate with the tests of the code touched, not the whole suite. Do not check the UI with headless Chrome screenshots; the user looks at it themselves.

## Closing a meaningful session

Update `docs/PROJECT_STATE.md`; `docs/BOARD.md` if a task changed state; `docs/CHANGELOG.md` for meaningful completed work; `docs/DECISIONS.md` for a significant decision; `docs/SESSION_LOG.md` briefly (keep about five entries).

## Agents (`.claude/agents/`)

`architect` (structure, advice only), `frontend` (implementation), `ux-ui` (hierarchy and design, no unrequested redesign), `weather-data` (data correctness), `qa` (tests and edge cases), `reviewer` (read-only review). All follow these same rules and the same board.

## Style

Replies to the user in Italian. Code, comments and docs in English. Never use the em dash character.
