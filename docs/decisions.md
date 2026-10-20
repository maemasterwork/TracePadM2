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
31. **Practice keys carry only the chapter number.** SQL `class_progress` already parses that format; multi-lesson namespacing is a Milestone 4 migration. Collisions are impossible with one lesson.
32. **Verdicts are graded against CPython-verified stored answers**, not by running the learner's output through a second oracle in the browser. Reason: the build already proved each answer.
33. **The first answer after a reveal counts as practice, not mastery.** Reason: seeing the answer first would inflate the estimate.
34. **Review shuffles quiz options** so position is not memorised.
35. **Exercise solutions unlock only after all hints are seen**; parameter variants make a retry a different instance of the same skill.
36. **The memory model is capped at 1500 steps** and says so; arrows are decorative with a text description for each step. Reason: performance and accessibility.
37. **Search is a client-side index over the lesson JSON.** Reason: works offline and needs no server; cost is that a lesson must have been opened once.
38. **Shortcuts are `/`, `?`, `[`, `]`** and ignored while typing; a "Notes mode" toggle supports touch screens without a keyboard.
39. **Persian for the error coach, concept names and new UI was written by me and is unreviewed.** Flagged in the README; needs native review.
40. **Parsons, fix-the-bug and code-reading exercises were not built**: the labs schema and data have none, and inventing content would be fake data. They are scoped for later milestones with content.
