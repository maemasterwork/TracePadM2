# Administrator guide (English)

The full set-up is in [../deployment.md](../deployment.md). This page is the list of what an administrator does. There are two kinds: the **platform administrator** (runs the deployment) and the **organization administrator** (runs one school or company inside it).

## Platform administrator
**Set up once**: create the Supabase project, apply the migrations, set the teacher invite code, configure e-mail (custom SMTP) and the site URL, build and host the site with the required headers, then do the first-run checklist.

**Teachers**: give them the invite code (keep it secret; change it with one SQL statement when needed). They become teachers in Account. Nobody becomes a teacher or administrator through the app without the code; `platform_admin` and `content_editor` can only be granted by SQL as the database owner:
`update public.profiles set role = 'platform_admin' where id = (select id from auth.users where email = '...');`

**Learners without e-mail** sign in with `username@<VITE_USERNAME_DOMAIN>`. If one forgets the password, reset it in Supabase *Authentication → Users*. To remove a learner, delete the user there (their progress goes with them).

**Learners under 13** cannot self-register. In *Authentication → Users → Add user* use `username@<VITE_USERNAME_DOMAIN>`, set a password, tick auto-confirm, and put `{"full_name": "...", "username": "...", "age_band": "under13"}` in user metadata. (Not tried in the build environment; try one account first.) Bulk creation and a credentials sheet are **not built**.

**Privacy requests**: learners can download and delete their own data in Account. Platform roles cannot self-delete; remove them by hand.

**Feature flags and audit log**: `feature_flags` and `audit_log` are readable and writable only by platform admins, in SQL for now. The audit log records account deletions, role and flag changes, **manual grade changes and returned results**.

**Demo**: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/demo/demo_seed.sql` loads "Tracepad Demo School" with one class and 30 simulated learners (no passwords; nobody can sign in as them). To look around, sign up normally and run `psql ... -v email=you@example.com -f supabase/demo/adopt.sql`. Remove everything with `supabase/demo/remove.sql`. Do not load the demo into a production database that real classes use.

**Adding lessons**: a content task; see the README. Run `npm run content:build`, redeploy.

**Backups and monitoring**: turn on Supabase backups and test a restore. There is no built-in error monitoring or data-retention setting yet (Milestone 5).

## Organization administrator
1. **Teach → Create an organization** (name; you become its administrator). The organization page shows the **invite code** (generate a new one any time; the old one stops working).
2. Teachers who have a teacher account enter the code under **Teach → Join with an invite code**. In the member list you can make someone an administrator, make them a teacher, or remove them. A teacher can leave by themselves.
3. Optional **seat limit**: the maximum number of distinct learners across the organization's classes. When it is full, learners are told to ask the school administrator.
4. **Report**: one row per class (teacher, learners, assignments, submissions, average, last submission, archived). It never shows an individual learner. You are not automatically a teacher of those classes; a teacher can add you as co-teacher.
5. Teachers choose the organization when they create a class.
