# Decisions

Every decision made without asking, with the reason. Newest milestone last. Database decisions are numbered separately in [database.md](database.md#decisions).

## Milestone 1

1. **The prototype zip was missing its import tools.** The zip had `extract.py`/`verify.py` mentioned but not included, so both were written from scratch. Reason: the product rule is "0 lines lost, proven", and the proof has to be an independent check, so `verify.py` shares no code with `extract.py`.
2. **Lesson markdown is the source of truth and is never edited.** Blocks keep source line ranges; the verifier rebuilds the file from them. Reason: a content author must be able to diff against what they wrote.
3. **Practice items live in `labs.yml`, run instructions in `blocks.yml`.** Reason: markdown stays clean; adding a lesson stays a content task.
4. **Every answer is checked by real CPython at build time**, and the engine itself is checked against CPython (267 snippets). Reason: a wrong "correct answer" is the worst bug a teaching tool can have.
5. **Pyodide 0.28.3 (CPython 3.13.2), not the 3.12 line.** Reason: the lesson and tests target 3.13 behaviour; matching versions avoids differences in error text and `repr`.
6. **Self-hosted Pyodide in a module Web Worker.** Reason: strict CSP with no third-party origins, offline use, and no UI freeze during runs.
7. **Cross-origin isolation (COOP same-origin, COEP require-corp) plus SharedArrayBuffer, with a fallback.** Reason: it is the only way to get a live `input()` prompt and a clean Stop. Where isolation is missing, `input()` reads from a box filled before the run and Stop restarts the engine. Cost: every embedded resource must be same-origin or CORP-tagged; no third-party embeds.
8. **Strict CSP**: `script-src 'self' 'wasm-unsafe-eval'`, no inline script; `style-src 'self'` with inline *attributes* allowed (`style-src-attr`) because React sets style attributes. Reason: lesson content and learner code are untrusted; markdown-it runs with `html: false`.
9. **Safe inline HTML in labs** limited to `code em strong br b i sub sup`, no attributes, enforced at build. Reason: bilingual texts need a little emphasis; nothing else.
10. **Guest mode is the default.** Everything except accounts works without signing in; progress is local and is moved into the account at first sign-in. Reason: a beginner should run code in the first minute, and schools may not want every child to register.
11. **Progress sync is offline-first with deterministic merge rules**, identical client and server (documented in architecture.md). Reason: classroom Wi-Fi is unreliable; the same rules on both sides make order of arrival irrelevant.
12. **Username accounts use a pseudo-email** `username@students.tracepad.app` (domain configurable, must not receive mail). Reason: young learners often have no email. Consequence: a duplicate username is reported by GoTrue as "already registered", so the message says "That username or email already has an account".
13. **Under-13 self sign-up is blocked client-side only.** Reason: there is no consent flow yet. Stated as a limitation; the school or parent must handle consent. A server-side rule needs a consent design (Milestone 3 classes or 5 hardening).
14. **Age band, not birth date.** Only a band (under 13, 13–15, 16–17, adult) is stored. Reason: data minimisation.
15. **All `progress.data` is client-reported in M1** and documented as such in the schema docs and README. Verified grading arrives with the gradebook (Milestone 3).
16. **Authorization lives in the database (RLS)**; the browser holds only the public anon key; the teacher invite code sits in a table no API role can read and the placeholder value is refused.
17. **"Sign out other devices" revokes refresh tokens; it cannot kill an access token already issued** (up to one hour). That is how GoTrue works; documented rather than hidden.
18. **Lesson text stays English until Milestone 4; the interface is fully Persian**, and Persian-language pages show a notice on lessons. Reason: showing English silently would confuse; faking translation would be worse.
19. **Persian conventions**: Persian digits via `nu-arabext`, Jalali calendar via `ca-persian`, logical CSS properties, code blocks always LTR. Vazirmatn for Persian text.
20. **Accessibility is tested, not assumed**: axe (WCAG 2.2 AA) on every page in light, dark, contrast themes and both languages; 320 px and 200 % text reflow; keyboard order.
21. **Tables in lessons scroll inside a focusable region** (`tabindex=0`, labelled) instead of overflowing the page. Reason: axe requires focusable scroll areas; mobile reflow.
22. **Testing auth without a real Supabase**: a stand-in GoTrue/PostgREST subset (`apps/web/e2e/standin`) over a real migrated PostgreSQL, driven by the real `supabase-js`. Reason: Docker and Supabase's release downloads were unreachable in the build environment. Limits are listed in the README; it is a test tool only.
23. **No `docker-compose.yml` was added.** Reason: it could not be run here, and an untested compose file is worse than the Supabase CLI path (`supabase start`) which is the supported local backend.
24. **Sign-up trigger errors are mapped by text** ("Database error saving new user" → username problem) because GoTrue hides the real reason and supabase-js reports the 500 as a retryable fetch error. Found by testing; the mapper checks this before the offline check.
25. **The reset-password page waits for the link exchange.** It used to redirect to sign-in before the code in the URL was exchanged for a session. Found by testing.
26. **Visual regression snapshots were not added.** Reason: they are brittle across fonts and machines; the structural and accessibility tests plus manual viewing at each size were judged more valuable now. Revisit in Milestone 5.

## Milestone 2

27. **Mastery is derived, not stored.** BKT is recomputed from each item's attempt history. Reason: parameters can be tuned without migrating data, and sync stays simple. A hint-used or revealed answer counts as weaker evidence than an unaided one.
28. **Spaced review uses Leitner boxes (1, 2, 4, 8, 16 days)**, a wrong answer moves an item back a box. Reason: explainable to a learner and a teacher; no tuned parameters needed with this little data.
29. **The streak never shames.** It counts local days with any practice; missing a day shows a welcome message instead of a reset warning. Reason: the audience includes children.
30. **Notes and marks use `note:` and `mk:` keys.** Reason: the server's `bm:*` rule is monotonic (never goes backwards), which would make deleting a bookmark impossible.
31. **Practice keys carry only the chapter number.** SQL `class_progress` already parses that format; multi-lesson namespacing is a Milestone 4 migration. Collisions are impossible with one lesson. (Superseded by 81 once a second lesson existed.)
32. **Verdicts are graded against CPython-verified stored answers**, not by running the learner's output through a second oracle in the browser. Reason: the build already proved each answer.
33. **The first answer after a reveal counts as practice, not mastery.** Reason: seeing the answer first would inflate the estimate.
34. **Review shuffles quiz options** so position is not memorised.
35. **Exercise solutions unlock only after all hints are seen**; parameter variants make a retry a different instance of the same skill.
36. **The memory model is capped at 1500 steps** and says so; arrows are decorative with a text description for each step. Reason: performance and accessibility.
37. **Search is a client-side index over the lesson JSON.** Reason: works offline and needs no server; cost is that a lesson must have been opened once.
38. **Shortcuts are `/`, `?`, `[`, `]`** and ignored while typing; a "Notes mode" toggle supports touch screens without a keyboard.
39. **Persian for the error coach, concept names and new UI was written by me and is unreviewed.** Flagged in the README; needs native review.
40. **Parsons, fix-the-bug and code-reading exercises were not built**: the labs schema and data have none, and inventing content would be fake data. They are scoped for later milestones with content.

## Milestone 3

41. **Scores are computed by the database on a frozen snapshot.** `submit_assignment` copies the item list and the learner's stored answers at hand-in time. Reason: later edits to the assignment or to progress must not change a submitted grade, and a browser must not be able to send its own score. Limit (documented): the answers themselves are still browser-reported, because the server cannot run learner code.
42. **Hints cost nothing; a revealed solution earns 0 for that item.** Reason: hints are a learning tool for beginners and children; a revealed answer is not evidence of the skill. Teachers can still override by hand with a reason.
43. **Exercises earn partial credit (share of tests passed); predictions and quizzes are right or wrong.** Reason: a nearly working program should not look the same as a blank one.
44. **Late work is judged with the server clock.** Policies: accept, percentage penalty per day with a cap, or reject. A per-learner extension replaces the deadline for that learner only. Reason: device clocks are not trustworthy and "I handed it in on time" should not be arguable.
45. **Missing work counts as 0 only after its deadline** (or when a close date has passed). Before that it shows "Not due". Reason: a gradebook in week one should not show everyone failing.
46. **Manual scores need a reason and are never silently replaced.** `grade_history` has triggers that refuse UPDATE and TRUNCATE, and the API has no write access to it at all; the audit log gets a row too. A manual score is also never overwritten by a resubmission.
47. **Results are hidden from the learner until the teacher returns them** (per assignment, per learner, reversible). Reason: teachers often grade a class before releasing any grade.
48. **Organization administrators see totals only.** `org_report` gives per-class counts and average, never a learner's rows; admins are not automatically teachers of a class. Reason: a school administrator needs to know classes are used, not read children's answers; a teacher can add the administrator as a co-teacher if they want that.
49. **Join codes and organization invite codes cannot be read through the API.** Column grants exclude them; teachers read them with a function (`class_join_info`, `org_invite_code`) that checks the role. Reason: a class list or an exported row must never leak the code that lets anyone join.
50. **Classes can only be created through `create_class()`.** Direct INSERT is revoked. Reason: the function generates the code, applies the organization's rules and records the owner in one step.
51. **Co-teachers and teaching assistants are separate roles.** A TA can grade and see the class but cannot delete it or change staff. Reason: the common classroom shape, and the least privilege that still works.
52. **Seat limits count distinct learners across an organization's classes** and are enforced when a learner joins. Reason: a limit that is only advisory is not a limit.
53. **Notifications are in-app only.** No e-mail, no push, no "due soon" reminder. Reason: sending mail needs a configured provider and a scheduler that this milestone could not test honestly; a feature that silently does not arrive is worse than a stated gap. They are created by database triggers and functions so they cannot be skipped by a client.
54. **Dashboards poll (15 s, optional) instead of using realtime.** Reason: fewer moving parts; a teacher watching a class does not need sub-second updates. Revisit in Milestone 5 if load tests justify it.
55. **PDF export is the browser's print dialog on a print stylesheet.** Reason: no PDF library is needed, nothing leaves the device, Persian shaping and RTL come from the browser. Cost: the teacher chooses "Save as PDF" themselves.
56. **CSV export neutralises spreadsheet formulas** (a leading `=`, `+`, `-`, `@` is prefixed) and starts with a byte-order mark so Excel reads Persian names correctly. An LMS-style CSV (name, username, one column per assignment) is offered separately. Reason: learner-chosen names are attacker-controlled text.
57. **Integrity signals are observations, labelled as such.** Time in exercises, pastes into the editor, solution reveal. Nothing is penalised automatically and the screen says the signals can be innocent (a learner may paste their own earlier code). Reason: false accusations of cheating against children are worse than missed cheating.
58. **Pastes are counted in the editor** (`onPaste`), summed across visits, and merged with "never goes down" like attempts and hints. `sol`, `pastes`, `secs` joined the exercise merge rule in SQL (`_merge_ex`) and in the client (`sync/merge.ts`); a SQL check and a unit test cover it.
59. **Heat maps and "who may need help" use self-reported progress and say so on screen.** Only submitted assignments are server-scored. Reason: honesty about what the numbers are.
60. **A `reload()` of a list keeps what is on screen.** `useLoad` only shows the loading state when its inputs change. Found by testing: after "archive class" or "new code", the confirmation message vanished because the whole tab was remounted.
61. **The demo organization submits through the real function.** The generated SQL calls `submit_assignment` as each simulated learner and only moves `submitted_at` afterwards. Reason: the demo then exercises exactly the code a real class would, instead of rows that merely look right.
62. **Demo learners have no password.** Nobody can sign in as them. `adopt.sql` makes your own account a teacher of the demo class. Reason: seeded accounts with known passwords are a classic security hole.
63. **The test stand-in was made more faithful when tests exposed gaps:** numeric columns are returned as JSON numbers like PostgREST (node-postgres returns strings, which crashed an export), arrays of plain values are passed as Postgres arrays, multi-statement SQL works in the control endpoint, and the reset truncates with triggers disabled (grade_history refuses TRUNCATE for everyone else).
64. **A real accessibility bug was fixed: a link whose `aria-label` omitted its visible text** (the notification badge and the gradebook cell links). Rule going forward: the accessible name must contain the visible text.
65. **Persian for Milestone 3 (about 350 strings and the Persian guides) was written by me and is unreviewed**, as with Milestone 2.
66. **Not built, on purpose:** bulk account creation and credential sheets, CSV roster import, data-retention settings, e-mail, grade-by-rubric, peer review, plagiarism comparison between learners. Reason: each needs a decision or a service that was not available to test; none was faked.

## Milestone 4: flowcharts

67. **Milestone 4 is scoped to flowcharts, and Persian is not started.** Reason: your instruction. Chart text is English only; the interface and the Persian layout are untouched. Charts mirror for right-to-left so adding Persian labels later needs no layout work.
68. **Flowcharts are generated from the code, not drawn by hand.** Reason: 166 charts in one lesson would go out of date at the first edit; generation also lets the same code chart a learner's own edits.
69. **Layout is structured, not a general graph layout.** Python is block-structured, so fragments (sequence, branch, loop, try) compose predictably and deterministically (the same code always gives the same picture, tested). A general graph layout would be harder to read and to test.
70. **Layout is computed at build time and shipped as coordinates**; the browser only draws. Reason: a small renderer, trivially mirrored for right-to-left, and the picture can be validated (no overlaps, nothing off the canvas) in CI.
71. **Every example gets a chart, including straight-line ones.** Reason: you asked for a flowchart of each example. Long straight-line code is grouped in chunks of 5 lines so the chart stays readable; the lines are still all covered (tested).
72. **A function's body is a separate chart ("Inside f(x)")**, with `return` drawn as a jump to its end. Reason: the body runs only when called, so putting it inline would show a wrong order of events.
73. **A chart is skipped, with a reason, rather than drawn wrongly**: code that is not a program, more than 45 boxes, or wider than 1100 px. Classes are one box; methods are not drawn. Reason: an honest gap beats a misleading picture.
74. **The tracer drives the highlight by source line.** Step lines come from CPython's own tracing; each box carries its line range. Reason: no second interpretation of the program; what runs is what lights up. Loop counts (×N) count a multi-line statement once.
75. **Predictions show the flowchart only after answering.** Reason: the chart shows structure, not output, but a learner should predict first.
76. **Edited code gets a live chart from the same generator, run in the Python engine (Pyodide)**, not a second JavaScript implementation. Reason: one implementation, so the build-time and live charts cannot disagree; works offline. Cost: the first live chart waits for the engine (about 12 MB, cached afterwards); code that does not yet parse says "No chart yet" instead of showing a stale chart.
77. **The generator file ships in `/pyodide/` (immutable cache headers, like `runner.py`).** Consequence: a change to `flowchart.py` or `runner.py` reaches returning visitors only when their cache entry is replaced; renaming the file or bumping the path is the fix. Noted for the deployment guide.
78. **Accessibility of charts**: the SVG has a role and label and points to a text version (nested list) of the same chart; a polite live region announces "Now at: ..." as the trace moves; the scroll region is focusable and labelled; colour is never the only cue (shape and text carry the meaning); forced-colours styles are provided. Found while testing: a link's accessible name must contain its visible text (see 64).
79. **The `try` chart is a teaching simplification**: the "error" arrow leaves the "Try this part" box, though in Python an error can happen part-way through the body. The text version says so ("if an error happens, jump to the matching except part").

## Lesson 2 and multi-lesson support

80. **Lesson 2 is "Python Statements" and replaces three planned lessons.** The supplied lesson covers decisions, `for`, `while`, useful operators and list comprehensions plus an assessment and a capstone. The outline in `course.yml` was changed: planned lessons 2 (conditions), 3 (loops) and the comprehension part of 5 are now covered by Lesson 2; the rest were renumbered (3 functions, 4 iterators and generators, 5 errors, 6 modules, 7 OOP, 8 testing, 9 capstones). Reason: the lesson as written is one module with its own capstone.
81. **Chapter numbers are made unique across lessons at build time** (lesson 1 keeps 1 to 99; lesson N uses N x 100 + the printed number). Reason: progress, notes, read marks, spaced-review keys and the SQL `class_progress` all carry only a chapter number, so this needs no data migration, no schema change and no change to the sync rules, and existing learners keep their progress. `chapterNo()` shows the printed number. Cost: 99 chapters per lesson at most. The alternative (a lesson part in every key) would have meant migrating stored keys and the SQL parsing.
82. **Chapter ids must be unique across lessons**; the build fails otherwise. Reason: assignments store the chapter id.
83. **Practice text and concept names may be English only.** The schema already allowed a missing `fa`; the concept-name check now requires only `en`. Reason: Persian was deliberately not started. The interface falls back to English (decision 7 of Milestone 1).
84. **Flowcharts skip code the Python compiler rejects** (for example `break` outside a loop), not only code that does not parse. Found when a cheat-sheet snippet drew a chart with boxes nothing pointed to.
85. **Teachers pick an assignment chapter from a list grouped by lesson**, since two lessons both have a chapter 1.
86. **Notes page now looks up each note in the lesson that owns its chapter** (it used the first lesson only, which would have hidden every Lesson 2 note).

## Lesson 0 (flowchart primer) and Mermaid diagrams

87. **Lesson 0 uses chapter numbers 10001 and up internally.** Lesson 1 already owns 1 to 99 (existing learner data), lesson N owns N x 100 + n, and the SQL parses keys as plain integers (no negative numbers), so the primer sits above everything. `chapterNo()` still prints 1 to 14. It is first in `course.yml`, so it is first on the course page.
88. **The lesson's Mermaid diagrams are laid out at build time and drawn by our own SVG renderer**, not by the Mermaid library. Reason: no new dependency, nothing to load at run time (strict content-security policy, offline use), the same look, right-to-left handling, text version and accessibility as the generated Python charts, and the layout can be validated (no overlapping boxes, nothing off the canvas) in CI. Cost: only a small subset of Mermaid is understood (see the README); the rest is skipped with a reason and shown as text.
89. **Mermaid layout rule: the first exit of a box continues straight down, other exits get new columns on the right, loops go around the left, long arrows use free slots.** Reason: it is predictable and reads like the Python-generated charts. A general graph layout would draw each diagram differently and be harder to test. A box nothing points to is a build error, not a guessed picture.
90. **The lesson's Mermaid source stays in the lesson and is shown under "Diagram source" on request.** Reason: it is the author's own text, and learners may want to copy it into other tools.
91. **One edit to the supplied lesson text: the `<details>` block (solution to exercise 3) became a bold line.** Reason: raw HTML in lesson text is escaped on purpose (a security decision from Milestone 1), so the tags would have shown as text. Nothing else in the text was changed; the verifier proves no line is lost.
92. **Flowchart scroll area follows the page direction, and English labels stay left-to-right in a right-to-left page.** Found while checking Lesson 0 in Persian mode: a wide chart started scrolled to its far end, and the "?" of "score >= 90?" jumped to the front.

## Lesson 3 (Methods and Functions)

93. **Lesson 3 is published as `03-methods-and-functions`** (the planned `03-functions` entry was renamed to match the lesson). Chapters are numbered 301 to 307 inside the app and shown as 1 to 7.
94. **The lesson text is unchanged** (2241 lines, 0 lost). It had no raw HTML, so no rewriting was needed.
95. **Homework problem statements are run against the solutions.** The Section 6 problem blocks only show calls such as `larger_unless_both_even(2, 4)`, so `blocks.yml` makes each run after the solution block that defines the function. The timing example (C3) is marked nondeterministic, and the cheat-sheet line that shows `global` and `nonlocal` together is skipped (Python rejects it).
96. **Practice items cover chapters 1 to 5 only.** The homework (chapter 6) already has 26 graded problems with solutions, and the appendix is reference material. Expected outputs in predictions and tests were produced by running the code, not typed by hand.

