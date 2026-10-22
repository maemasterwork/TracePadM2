# Tracepad

A web platform that teaches Python to beginners. Learners read a lesson, run every example in their browser (real CPython via WebAssembly, no server, no install), and keep their progress offline-first. Persian (right-to-left) and English are both first-class.

**Status: Milestones 1 (Foundation), 2 (Learning experience) and 3 (Classes and teaching) of 5 are complete; Milestone 4 is being delivered as flowcharts first (see below).** See [What exists today](#what-exists-today) for exactly what that means, and [Known limitations](#known-limitations) for what does not work yet. The full plan is in [docs/PRODUCT_PROMPT.md](docs/PRODUCT_PROMPT.md).

## What exists today

- **Lesson 2** ("Python Statements": if / elif / else, for and while loops, useful operators, list comprehensions, assessment, Guessing Game capstone; 9 chapters) with 33 predictions, 18 quizzes and 13 exercises, all checked against real CPython. Its practice text is **English only** (Persian not started, by decision).
- **Lesson 1** ("Python Object and Data Structure Basics", 10 chapters), imported from the original markdown with a verifier that proves no line was lost (1923 source lines, 302 blocks, 0 lost).
- **In-browser Python** (Pyodide 0.28.3 = CPython 3.13.2, self-hosted, in a Web Worker): Run, Stop, a time limit, live `input()`, and a per-user virtual disk that survives reloads. All 121 runnable examples in the lesson run; 267 snippets are checked to give the same output in Pyodide as in desktop CPython.
- **Accounts**: email or username sign-up, sign-in, password reset, email change, sign out other devices, two-factor (TOTP) screens, teacher invite code, export my data, delete my account. Learners without an account are *guests*; their progress is kept on the device and moved into the account at first sign-in.
- **Offline-first progress** with a conflict-safe sync to the database.
- **Accessibility and languages**: English and Persian (RTL, Persian digits, Jalali dates), light, dark and high-contrast themes, colour-blind palette, dyslexia-friendly font, text size 80 to 200 %, reduced motion.
- **Installable and offline** (PWA): a lesson you opened keeps working with no network.
- **Database** (Supabase/Postgres): seven migrations, row-level security on every table, rate limits, audit log, feature flags, export and delete functions.

**Milestone 2 added the learning experience:**

- **Practice**: 46 predict-run-compare items, 15 quizzes and 15 exercises (visible tests, leveled hints that unlock the solution only after all hints, attempt history, parameter variants so re-tries differ).
- **Step-by-step tracer and memory model**: a *Trace it* button on code and on predictions steps through execution line by line; chapter 2 draws names, objects and arrows (capped at 1500 steps; arrows are decorative and every step has a text description).
- **Error coach** (English and Persian): plain-language explanation of the common Python errors with a "what to try" line.
- **Mastery, daily review and streak**: a per-concept estimate (Bayesian knowledge tracing, derived from your answers, never stored), a spaced-review queue (Leitner boxes), and a streak that never shames (a missed day shows a welcome back, not a reset warning).
- **Reader tools**: copy, outline, full-text search (works offline once a lesson was opened), bookmarks, notes on any block, reading progress, mark as read, keyboard shortcuts (`/` search, `?` help, `[` `]` chapters) and a Notes mode for touch screens.
- **My progress** and **Review** pages.

**Milestone 3 added classes and teaching:**

- **Organizations**: a school or tutoring company with administrators and teachers (invite code, optional seat limit). Administrators see class-level totals only (no individual learner data).
- **Classes**: join codes with optional expiry, rotation, closing and re-opening; archive and restore; duplicate (optionally with assignments); co-teachers and teaching assistants; term label.
- **Assignments**: a set of practice items from the lesson (each with points), draft / published, release, due and close dates, late policy (accept, percentage penalty per day with a cap, or reject), per-learner deadline extensions, weight, number of submissions allowed, result visibility. Hidden from learners until published.
- **Verified submissions**: when a learner hands in, **the database** freezes the item list and the learner's answers, scores them (partial credit for exercises; a revealed solution earns 0; hints never cost points), applies the late rule using its own clock and stores the result. Resubmission is allowed up to the limit.
- **Gradebook**: per assignment and weighted overall, missing work counted as 0 only after the deadline, manual score overrides (a reason is required; every change is kept in an append-only history and the audit log), comments, return results to the learner (hidden until returned), CSV, LMS-style CSV and print-to-PDF export.
- **Teacher dashboard**: heat map by chapter or by concept, who may need help, score distribution, most-missed items with the wrong answers learners actually gave, hint use, a per-learner timeline; optional live refresh every 15 seconds.
- **Announcements, comments and in-app notifications** (assignment published, deadline extended, result returned, comment, announcement; there is no "due soon" reminder because that needs a scheduler, see limitations), with per-type preferences.
- **Integrity signals, shown honestly**: time spent in exercises, pastes into the editor and use of a revealed solution are shown to the teacher as observations with a plain statement that they are not proof; nothing is penalised automatically.
- **Demo organization**: `supabase/demo/demo_seed.sql` (generated by `tools/demo/gen_seed.py`) loads one school, one teacher, one class and **30 simulated learners** with realistic histories and three assignments, so every teacher screen can be seen with data. The people are invented; they cannot sign in. `adopt.sql` makes your own account a teacher of the demo, `remove.sql` removes it all.

**Milestone 4 (first part): flowcharts of every example**

- **Every runnable example gets a flowchart**, generated from its own code at build time (`tools/content/flowchart.py`): 166 charts in Lesson 1 (41 with branches or loops, 125 straight-line), covering `if`/`elif`/`else`, `for` and `while` (with `break`, `continue` and loop `else`), functions (each gets its own chart, *Inside f(x)*), `try`/`except`/`finally`, `with`, `return` and `raise`. Two lesson snippets are not valid programs (they are shown on purpose with errors) and have no chart; the build says so.
- **Plain-language boxes** ("Set total to 0", "Show x", "For each item in a list of 9 items", "x > 3 ?"), with shapes for start/end, steps, show/ask, yes/no questions and loops, a text version of every chart for screen readers, and a "How to read this chart" note.
- **Linked to the tracer**: with *Trace it* on, the box that is running is highlighted, boxes already visited are tinted and a loop shows how many rounds it ran (×3). Stepping through the memory model moves the highlight.
- **Works on code you change**: edit an example or an exercise and the chart is redrawn from your code by the same generator running in the browser's Python engine (offline too). Code that is not yet a complete program says so instead of showing a wrong chart.
- **Predictions** show their flowchart only after you have answered (so it cannot give the answer away).
- Right-to-left aware (mirrored), light, dark, high-contrast and phone widths (the chart scrolls inside a labelled region instead of shrinking to unreadable).
- Chart labels are **English only for now** (Persian was deliberately not started); the chart still mirrors correctly for right-to-left.
- Verified at build time: no box off the canvas, no overlapping boxes, no arrow leaving the canvas, no box without an incoming arrow; the build fails if a chart breaks these rules.

Not built yet: Parsons, fix-the-bug and code-reading exercise types, assessments, projects and certificates, and more lessons with Persian lesson text are Milestone 4; hardening, load and security review are Milestone 5.

## Quick start (development)

Requirements: Node 22, Python 3.13 with `pyyaml jsonschema`, PostgreSQL 16 binaries (only for the database tests). Optional: the [Supabase CLI](https://supabase.com/docs/guides/local-development) for a full local backend.

```bash
npm ci
npm run build            # builds lesson content, copies Pyodide, type-checks, builds the app
npm run dev              # http://localhost:5173 in guest mode (no backend needed)
```

To run with accounts, start a local Supabase (`supabase start` in this folder applies the migrations), then copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the URL and anon key it prints.

> `supabase start` needs Docker and was **not** run in the environment this was built in (no Docker there). The migrations and the app's use of them were verified another way, described under "How it was verified".

## Adding or changing a lesson (a content task, not a code task)

1. Create `content/lessons/<nn>-<slug>/` with `lesson.md` (your markdown, never edited by the tools), `labs.yml` and, when needed, `blocks.yml`. Add the lesson to `content/course.yml` (`status: published`, `number`, `id` = the folder name).
2. `labs.yml`: per chapter (use the numbers printed in the lesson) `predictions` (code + exact answer), `quizzes` (options + `correct` index) and `exercises` (starter, solution, `tests`, 2 to 4 `hints`). Every text has `en`; `fa` is optional for now (the app falls back to English). Test inputs for exercises use `set` (replaces the first line matching `param.pattern`) and `post` (code appended after the program); exercises get no keyboard input, so use variables or functions.
3. `blocks.yml`: examples that need earlier state (`after`), typed input (`stdin`), random or order-dependent output (`nondeterministic`), or that are not runnable on purpose (`skip`, with a reason). The build tells you which examples fail and why.
4. New concept tags used in `labs.yml` need an English name in `content/concepts.yml`.
5. `npm run content:build` checks everything (no lost lines, schema, safe HTML, every answer and every solution against real CPython, a flowchart for every runnable example) and fails loudly if anything is off. Then `npm run content:test`.

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | content pipeline (7), flowchart generator (22), app unit tests (93): sync merge rules, auth mapping and validation, grading, mastery, spaced review, search, gradebook and analytics logic, CSV safety |
| `bash supabase/tests/run.sh` | 461 SQL checks on a throw-away PostgreSQL (every table and function as anonymous, student, other student, teacher, other teacher, co-teacher, TA, organization admin, platform admin; scoring, late rules, extensions, grade history, return, notifications, archive, duplicate, export/delete) plus 13 checks that the demo seed loads and removes cleanly |
| `python3 -I tools/content/check_labs.py ...` and `node tools/content/engine_check.mjs` | labs against CPython; Pyodide vs CPython differential (see `.github/workflows/ci.yml` for exact calls) |
| `npm run -w apps/web e2e` | 65 browser tests (including the 3 lesson 2 tests and the flowchart tests: drawing, text version, trace highlighting and loop counts, redrawing after editing, exercises, predictions, axe in 2 themes and 2 languages, 360 px) (including practice, tracer, memory model, notes, search, review, shortcuts, and Persian accessibility of the new screens): axe accessibility on every page in 3 themes and 2 languages, RTL, 320 px reflow, 200 % text, offline, keyboard, CSP, runner behaviour |
| `npm run -w apps/web e2e:auth` | 22 browser tests against the real migrations (see below): the 13 account/sync tests, plus classes: teacher creates class and assignment, learner joins and submits, teacher overrides, comments and returns, learner sees it; late rule refusal; organization with invite, co-teacher, seat limit, code rotation, archive; announcements and comments; every class screen for axe accessibility in English/Persian, light/dark and for sideways scroll at 360 px; the demo organization filling every teacher screen |

## How it was verified

Every screen was opened in a real browser at desktop and phone width, light and dark, English and Persian. Two real bugs were found by the auth tests and fixed (a password-reset link bounced to sign-in before the code was exchanged; a duplicate username showed a generic error).

**Honest caveat on authentication.** The build environment could not run a real Supabase (no Docker, no access to its release downloads). So the auth and sync tests run the real `supabase-js` client and the real SQL migrations against a **stand-in server** (`apps/web/e2e/standin/`) that implements only the GoTrue and PostgREST calls the app makes. It is a test tool, not a product. It therefore does **not** prove: real e-mail delivery, TOTP enrolment, Google/Microsoft sign-in, GoTrue's own rate limits and password policy, or Supabase's JWT/refresh timing. Run through those once against your real project (see [docs/deployment.md](docs/deployment.md), "First-run checklist").

## Known limitations

- Practice values are **reported by the learner's browser**. Assignment scores are computed by the database, but from those reported answers: the server cannot re-run a learner's code, so a determined learner using developer tools could report a pass they did not earn. The teacher can open each submitted item (the code snapshot, with a button that re-runs it in the browser) and sees time, paste and solution-reveal signals. Treat scores as classroom grades, not high-stakes proof.
- The under-13 sign-up block is a client-side rule only (it can be bypassed by calling the API directly). Treat it as a courtesy, and get parental or school consent in your own process.
- Lesson text is English only until Milestone 4; the interface is fully Persian. Persian lessons show a notice saying so. The 196 practice texts have Persian translations; have a Persian-speaking teacher review them before you rely on them.
- Other devices stay signed in until their short access token expires (up to one hour) after "sign out other devices"; they can no longer refresh.
- The first visit downloads about 12 MB for the Python engine; after that it is cached.
- Browsers without cross-origin isolation (or if the host omits the COOP/COEP headers) use a fallback: `input()` takes its answers from a text box before the run instead of live, and Stop restarts the engine.

- **Mastery and the dashboards' heat map are self-reported**; only submitted assignments are scored by the server.
- The concept names, error-coach texts and all new interface strings in Persian were written by the builder and have **not** been reviewed by a native-speaker teacher. Review before relying on them.
- Progress keys still carry only a chapter number. Collisions between lessons are prevented by numbering chapters uniquely in the built content (lesson 1: 1 to 99, lesson N: N x 100 + the printed number; see decision 81). Consequence: a lesson can have at most 99 chapters, and teacher screens and exports show the unique numbers only where a person would never see them (they print the lesson's own chapter number).
- Chapter ids (the heading slugs, such as `3-for-loops`) must be unique across lessons, because assignments refer to them; the build stops with a message if two lessons repeat one.
- Lesson 2 flowcharts: 131 drawn, 11 examples without a chart (syntax templates, fragments, and the two largest programs: the Guessing Game solution has more than 45 boxes, and two examples are wider than 1100 px).
- The memory model and tracer stop after 1500 executed steps and say so.
- Search and notes work offline only for lessons opened at least once on this device.
- Exercise types Parsons, fix-the-bug and code-reading are not in the lesson data yet, so they are not built.

## Milestone 3 limitations (read before relying on it)

- Notifications are **in-app only**: no e-mail or push. Learners see them when they open Tracepad.
- Teacher dashboards **poll** (every 15 seconds when live updates are on) rather than use a realtime channel.
- There is **no bulk account creation, credentials sheet or CSV roster import**; learners join with the class code. Administrators create under-13 accounts one at a time in Supabase (see the administrator guide).
- No data-retention settings or scheduled cleanup yet (Milestone 5). Deleting an account removes that person's rows; an organization administrator cannot delete a learner.
- PDF export is the browser's "Print or save as PDF" on a print stylesheet, not a generated file.
- The browser tests for classes run against the **stand-in** API on the real migrations, not a real Supabase (same caveat as authentication).
- The demo learners are simulated by a random model (tools/demo/gen_seed.py); their histories are plausible, not real data, and the demo is for looking around, not for statistics.
- All Persian text added in Milestone 3 (about 350 strings and the Persian guides) was written by the builder and **has not been reviewed by a native-speaking teacher**.

## Documentation

- [docs/architecture.md](docs/architecture.md): how it fits together
- [docs/decisions.md](docs/decisions.md): every decision made and why
- [docs/database.md](docs/database.md): tables, policies, functions
- [docs/deployment.md](docs/deployment.md): hosting, headers, Supabase settings, backups
- [docs/user-guides/](docs/user-guides/): learner, teacher, administrator, in English and Persian
