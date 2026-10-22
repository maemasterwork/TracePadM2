# Architecture (Milestones 1 to 3, and flowcharts from Milestone 4)

```
 lesson.md + labs.yml + blocks.yml           (content/, the source of truth)
        │  tools/content: extract → verify (0 lines lost) → check_labs (CPython) → build
        ▼
 apps/web/public/content/*.json              typed blocks with source line ranges, bilingual labs
        │
        ▼
 Browser (React + TypeScript, Vite, PWA)
   ├─ pages / design system / i18n (ICU messages, en + fa, RTL)
   ├─ runner: main thread ⇄ Web Worker ⇄ Pyodide (CPython 3.13)  + runner.py (capture, trace, input)
   ├─ progress store: IndexedDB rows + outbox  ──sync──►  Supabase RPC save_progress
   └─ auth: supabase-js (PKCE) → GoTrue
                                                     Supabase: Postgres (RLS) + GoTrue
```

## Content pipeline (`tools/content/`)
`extract.py` turns the markdown into typed blocks (headings, paragraphs, lists with nested code, tables, quotes, code) keeping each block's source line range. `verify.py` is an independent check: sha256 of the source, ranges cover every line exactly once, the document rebuilds to the original, counts match. `check_labs.py` validates `labs.yml` against `labs.schema.json`, restricts inline HTML to a safe set, and runs every prediction, exercise (solution must pass all tests, starter must fail one) and lesson code block in real CPython. `engine_check.mjs` runs the same snippets in Pyodide and compares to CPython. `build.py` runs all of it and writes the JSON the app loads. Lesson text is rendered with markdown-it with raw HTML disabled.

## Runner (`apps/web/src/runner/`)
- `worker.ts` loads self-hosted Pyodide and `runner.py` (the same file the CI differential test runs).
- `runner.run()` swaps `sys.stdout/stderr/input`, executes the learner's code as `__main__` in a fresh namespace, and returns ordered events, output, and a structured error. Output is capped.
- With `trace=True` it records one snapshot per executed line (frames, heap objects with stable ids, objects that became unreachable) via `sys.settrace`. The visualiser UI is Milestone 2; the data is already produced and tested.
- Stop: with cross-origin isolation a SharedArrayBuffer carries an interrupt signal (`KeyboardInterrupt`) and live `input()` via `Atomics.wait`. Without it the worker is terminated and respawned.
- Files live under `/u-<userKey>` on an IndexedDB-backed disk, one per user.

## Progress and sync (`src/sync/`)
Rows are `{key, data, client_ts}`. Local save applies the same merge rules as the server, writes the row and an outbox entry, and flushes in batches of 200 with backoff. Rules (identical in `merge.ts` and in SQL `save_progress`): last writer wins by `client_ts` (ties go to the incoming row); `ex:*` merge field by field (pass is OR, attempts and hints are max); `read:*` and `bm:*` never go backwards. After sign-in, `adopt('guest')` moves guest rows to the account, `pullAndMerge` brings down the server's rows, `flush` sends the rest.

## Learning experience (`src/learn/`, `src/memory/`, `src/notes/`, `src/search/`)
- **Row keys**: `pred:<ch>:<id>`, `quiz:<ch>:<id>`, `ex:<ch>:<id>` (per-item attempt history in `hist`), `rev:<itemKey>` (review state `{box,due,last,lapses,done}`), `read:<ch>`, `bm:`/`mk:`; bookmarks use `mk:` and notes use `note:` (not `bm:`, whose server rule is monotonic), all in the existing progress store and sync path. Nothing here needs a new table.
- `grading.ts` compares output with CPython-verified stored answers (and runs exercise tests, including `post` checks and parameter variants). `coach.ts` maps Python errors to explanations. `mastery.ts` computes BKT per concept from `hist` (never stored). `srs.ts` holds the Leitner ladder (1, 2, 4, 8, 16 days), due-item selection and the streak (local-day activity). `record.ts` writes rows; `hooks.ts` subscribes components to row changes; `Cards.tsx`/`LabsPanel.tsx` render practice.
- `memory/MemoryModel.tsx` renders tracer snapshots as frame, name and object boxes with SVG arrows (side by side on desktop, stacked on phones).
- `notes/` wraps lesson blocks (`Annotated`) so notes, bookmarks and copy appear on every block; `search/index.ts` builds a client-side index over lesson JSON (accent-insensitive, Persian digits normalised, did-you-mean by edit distance).
- Concepts live in `content/concepts.yml`; the build refuses practice items that name an unknown concept.

## Database (`supabase/`, see docs/database.md)
Authorization lives in Postgres: RLS on every table, helper functions (`is_teacher`, `teaches_class`, `teaches_student`, `in_class`), privileged roles that the API can never grant, rate limits inside the functions, an append-only audit log, `export_my_data` and `delete_my_account`. Secrets (the teacher code) are in a table no API role can read. The browser holds only the public anon key.

## Classes and teaching (`src/teach/`, `src/pages/Classes.tsx`, `Teach*.tsx`, `OrgAdmin.tsx`, `Notifications.tsx`)
- `teach/api.ts` (`makeTeachApi(client)`) is the only code that talks to the class tables and RPCs; `teachErr` maps database errors to translated messages (`err.*`). Screens never see raw errors.
- `teach/logic.ts` is pure and unit-tested: gradebook rows and overall grade, cell status, heat map (by chapter or concept), most-missed items and common wrong answers, who may need help, hint use, distribution, learner timeline, integrity notes, late penalty preview, and CSV (with a guard that stops spreadsheet formula injection).
- `teach/hooks.tsx`: `useLoad` (data + optional polling; a `reload()` keeps what is on screen instead of flashing a loading state), `useAction` (busy + success/error line), `Gate` (teacher-only area).
- `teach/tabs/*`: Overview, Students, Assignments (+ extensions), Gradebook, Announcements, Settings. `pages/TeachClass.tsx` holds the tabs (`?tab=`); `TeachReview.tsx` is the per-learner review (items, code snapshot, re-run in the browser, signals, manual score, history, comments).
- Learners hand in from `Classes.tsx`: it first flushes the offline queue so the server has the latest answers, then calls `submit_assignment` with observation signals (seconds, pastes).
- Live updates are polling (15 s, only while the tab is visible and the box is ticked). No realtime channel.

### Why scoring is in the database
A teacher's grade must not depend on what a browser says *at grading time*. `submit_assignment` freezes the assignment's item list, copies the learner's stored answers into a snapshot, scores them (`_score_items`: prediction and quiz = right/wrong, exercise = share of tests passed, revealed solution = 0, hints free), applies the late rule with the server clock (`_effective_due` honours extensions) and stores raw, penalty and final. Later edits to the assignment or progress cannot change a submitted score; only a teacher can, through `set_grade`, which writes `grade_history`.

## Flowcharts (`tools/content/flowchart.py`, `src/flow/`)
```
 example code ──► Python `ast` ──► structured layout (build time, plain coordinates) ──► flow.json
        │                                                                             │
        └─ same file runs in the Pyodide worker for edited code ───────────────────────┘
 browser: <Flowchart> draws boxes and arrows as SVG; tracer line numbers pick the running box
```
- **Generator**: statements are walked recursively and laid out as *fragments*: a sequence stacks vertically, an `if` splits into columns and joins at a dot, a loop has its body below, a back edge on the left and its exit on the right, `try` puts handlers in extra columns with dashed "error" arrows. Every box records the source lines it comes from; every chart has an outline (nested list) for screen readers. Layout is computed here, so the browser only draws.
- **Limits** (`MAX_NODES` 45 per chart, `MAX_WIDTH` 1100 px): bigger code gets no chart and a stated reason. Long straight-line code is grouped in chunks of 5 lines ("Run lines 3–7") so a ten-line example is not a ten-box tower. Classes are one box (methods not drawn); comprehensions and lambdas stay inside the box's text; `match` is one box.
- **Validation** (`validate()`): no box outside the canvas or on another box, no arrow outside the canvas, no box without an incoming arrow. `build.py` refuses a lesson whose chart fails, and `test_flowchart.py` runs it against every chart of the lesson.
- **Files**: `public/content/<lesson>/flow.json` maps `block:<block id>` (lesson examples) and `pred:<chapter>:<id>` (prediction programs) to charts. `FlowProvider` (in `LessonPage`) loads it; `CodeBlock` and `PredictionCard` look their key up. `tools/content/flowchart.py` is also copied to `public/pyodide/` and loaded by the worker (`runner.flow(code)`, queued behind any run) so edited code and exercise editors get live charts (`useLiveFlow`, 500 ms after typing stops).
- **Highlighting** (`flow/lib.ts`): the tracer step's line number selects the box with the narrowest line range containing it; the history of lines up to the current step gives visited boxes and loop counts (a multi-line statement counts once).
- **Not generated at runtime for the lesson's own examples**: those come from `flow.json`, so they appear instantly and offline; only edited code needs the engine.

## Security headers
`security-headers.ts` is the single source for the CSP and cross-origin isolation headers. It feeds the dev server, the preview server and a generated `_headers` file for static hosts. CSP: scripts from self plus `wasm-unsafe-eval` (needed for WebAssembly), no inline script, `connect-src` limited to self and the configured Supabase origin.

## Frontend structure
`pages/` (route components), `design/ui.tsx` (Field, Notice, Spinner), `styles/*.css` (tokens, themes, RTL via logical properties), `i18n/` (ICU, Persian digits, Jalali), `prefs/` (theme, language, text size, palette, font, motion; stored locally), `content/` (loading and rendering lessons), `auth/` (client, API wrapper, provider), `db/types.ts` (generated from the migrations).
