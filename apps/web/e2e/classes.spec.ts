import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { axeClean } from './helpers';
import type { Labs } from '../src/learn/types';

// Runs against the stand-in Supabase with the real migrations (see e2e/run-auth.sh).
const API = 'http://127.0.0.1:54321';
const PW = 'correct-horse-9';
const labs = JSON.parse(readFileSync('public/content/01-objects-and-data-structures/labs.json', 'utf8')) as Labs;
const CH1 = labs.chapters['1'];
const N_PRED = CH1.predictions!.length, N_EX = CH1.exercises!.length;
const MAX = N_PRED * 1 + N_EX * 5; // default points: prediction 1, exercise 5

async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const r = await fetch(`${API}/__test/sql`, { method: 'POST', body: JSON.stringify({ sql: query, params }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message);
  return j as T[];
}
import { mkdirSync } from 'node:fs';
async function shot(page: Page, name: string, locale: string, theme: string) {
  if (!process.env.SHOTS) return;
  mkdirSync('/tmp/shots', { recursive: true });
  await page.screenshot({ path: `/tmp/shots/${locale}-${theme}-${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`, fullPage: true });
}
test.beforeEach(async () => { await fetch(`${API}/__test/reset`); });

async function signUp(page: Page, name: string, username: string) {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Your age').selectOption('adult');
  await page.getByLabel(/no email address/i).check();
  await page.getByRole('textbox', { name: 'Username' }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PW);
  await page.getByRole('button', { name: 'Create your account' }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}
async function applyPrefs(x: { page: Page; id: string }, prefs: { locale: string; theme: string }) {
  await sql(`update public.profiles set locale=$2, display_prefs = jsonb_build_object('theme', $3::text, 'touched', true) where id=$1`, [x.id, prefs.locale, prefs.theme]);
  await x.page.goto('/'); await x.page.reload();
}
async function person(browser: Browser, name: string, username: string, teacher = false, prefs?: Record<string, unknown>) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signUp(page, name, username);
  const id = (await sql<{ id: string }>(`select id from public.profiles where username=$1`, [username]))[0].id;
  if (teacher) { await sql(`update public.profiles set role='teacher' where username=$1`, [username]); await page.reload(); await expect(page.getByRole('link', { name: 'Teach', exact: true })).toBeVisible(); }
  return { ctx, page, id };
}
const accept = (page: Page) => page.once('dialog', (d) => void d.accept());

async function createClass(page: Page, name: string, org?: string) {
  await page.goto('/teach');
  await page.getByLabel('Class name').fill(name);
  if (org) await page.getByLabel('Organization', { exact: true }).selectOption({ label: org });
  await page.getByRole('button', { name: 'Create class' }).click();
  await expect(page.getByTestId('join-code')).toHaveText(/[A-Z0-9]{8}/);
  const code = (await page.getByTestId('join-code').innerText()).trim();
  const id = page.url().match(/teach\/([0-9a-f-]{36})/)![1];
  return { code, id };
}
async function publish(page: Page, classId: string, title: string, opts: { late?: string } = {}) {
  await page.goto(`/teach/${classId}?tab=assignments`);
  await page.getByRole('button', { name: 'New assignment' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Chapter').selectOption({ label: '1. Numbers' }); // lesson 1 chapter 1: seedWork() fills in answers for it
  if (opts.late) await page.getByLabel('Late work').selectOption(opts.late);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published. Students in the class were notified.')).toBeVisible();
}
async function seedWork(studentId: string, right = 2) {
  const rows: [string, object][] = [];
  CH1.predictions!.forEach((p, i) => rows.push([`pred:1:${p.id}`, { right: i < right, tries: 1, guess: i < right ? 'ok' : '4 4 4', hist: [{ t: Date.now(), ok: i < right }] }]));
  CH1.exercises!.forEach((e) => rows.push([`ex:1:${e.id}`, { pass: true, hints: 1, attempts: 2, code: 'print(1)', secs: 300, pastes: 1, hist: [{ t: Date.now(), ok: true }] }]));
  for (const [k, d] of rows) await sql(`insert into public.progress(user_id, key, data, client_ts) values ($1,$2,$3::jsonb,$4)`, [studentId, k, JSON.stringify(d), Date.now()]);
}

test('teacher creates a class, student joins and submits, teacher grades and returns, student sees the result', async ({ browser }) => {
  const t = await person(browser, 'Tina Teacher', 'tina_t', true);
  const s = await person(browser, 'Stu One', 'stu_one');

  // a student cannot use the teacher area
  await s.page.goto('/teach');
  await expect(s.page.getByText('This area is for teachers.')).toBeVisible();

  const { code, id } = await createClass(t.page, 'Algebra');
  await publish(t.page, id, 'Week 1');

  await s.page.goto('/classes');
  await s.page.getByLabel('Class code').fill('WRONG123');
  await s.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(s.page.getByText(/No open class has that code/)).toBeVisible();
  await s.page.getByLabel('Class code').fill(code.toLowerCase());
  await s.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(s.page.getByText('You joined Algebra.')).toBeVisible();
  await expect(s.page.getByRole('link', { name: 'Week 1' })).toBeVisible(); // under "To do"

  await seedWork(s.id, 2);
  await s.page.getByRole('link', { name: 'Algebra' }).click();
  await expect(s.page.getByRole('heading', { name: 'Week 1' })).toBeVisible();
  accept(s.page);
  await s.page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(s.page.getByText('Your result appears here when your teacher returns it.')).toBeVisible();
  await expect(s.page.getByText(/Score:/)).toHaveCount(0); // hidden until returned
  const auto = 2 + 5 * N_EX;
  const [row] = await sql<{ score: string; max_score: string }>(`select score, max_score from public.submissions`);
  expect([Number(row.score), Number(row.max_score)]).toEqual([auto, MAX]);

  // teacher: overview, gradebook, review
  await t.page.goto(`/teach/${id}`);
  await expect(t.page.getByRole('heading', { name: 'Class heat map' })).toBeVisible();
  await expect(t.page.getByRole('cell', { name: /%/ }).first()).toBeVisible();
  await t.page.getByRole('tab', { name: 'Gradebook' }).click();
  await expect(t.page.getByRole('link', { name: 'Stu One, Week 1' })).toHaveText(`${auto}/${MAX}`);
  t.page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const dl = t.page.waitForEvent('download', { timeout: 8000 });
  await t.page.getByRole('button', { name: 'Download CSV', exact: true }).click({ timeout: 5000 });
  const csv = readFileSync(await (await dl).path()!, 'utf8');
  expect(csv).toContain('Stu One,stu_one');
  expect(csv).toContain(`Week 1 (/${MAX})`);
  await t.page.getByRole('link', { name: 'Stu One, Week 1' }).click();
  await expect(t.page.getByRole('heading', { name: 'Week 1' })).toBeVisible();
  await expect(t.page.getByText(`Automatic score: ${auto} of ${MAX}`)).toBeVisible();
  await expect(t.page.getByText(/Pastes into exercise editors: \d+/)).toBeVisible();
  await t.page.getByLabel('Set score by hand').fill('3');
  await t.page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(t.page.getByText('Give a short reason (at least 3 characters) when you set a score by hand.')).toBeVisible(); // reason is required
  await t.page.getByLabel('Reason').fill('Partial credit after reading the code');
  await t.page.getByLabel('Comment for the student').fill('Nice work, see line 2');
  await t.page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(t.page.getByText('Saved.')).toBeVisible();
  await expect(t.page.getByText(/Partial credit after reading the code/)).toBeVisible(); // history
  await t.page.getByRole('button', { name: 'Return to student' }).click();
  await expect(t.page.getByText('Returned to student')).toBeVisible();

  // student sees the manual score, the comment and a notification
  await s.page.reload();
  await expect(s.page.getByText(`Score: 3 of ${MAX}`)).toBeVisible();
  await expect(s.page.getByText('Nice work, see line 2')).toBeVisible();
  await s.page.getByRole('link', { name: /Notifications/ }).click();
  await expect(s.page.getByText('Result returned').first()).toBeVisible();
  await expect(s.page.getByText('New assignment').first()).toBeVisible();

  // the audit trail and history exist in the database
  expect((await sql(`select 1 from public.audit_log where action='grade.override'`)).length).toBe(1);
  await t.ctx.close(); await s.ctx.close();
});

test('late rules: a past-due assignment that rejects late work refuses the submission', async ({ browser }) => {
  const t = await person(browser, 'Tina Teacher', 'tina_t', true);
  const s = await person(browser, 'Stu One', 'stu_one');
  const { code, id } = await createClass(t.page, 'Late class');
  await publish(t.page, id, 'Strict', { late: 'reject' });
  await sql(`update public.assignments set due_at = now() - interval '1 hour'`);
  await s.page.goto('/classes');
  await s.page.getByLabel('Class code').fill(code);
  await s.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(s.page.getByText('You joined Late class.')).toBeVisible();
  await s.page.getByRole('link', { name: 'Late class' }).click();
  await expect(s.page.getByText('Missed').first()).toBeVisible();
  await expect(s.page.getByText('This assignment no longer accepts submissions.')).toBeVisible();
  await expect(s.page.getByRole('button', { name: 'Submit', exact: true })).toHaveCount(0);
  await t.ctx.close(); await s.ctx.close();
});

test('organizations: invite a teacher, add a co-teacher, seat limit, class code rotation and archive', async ({ browser }) => {
  const a = await person(browser, 'Ann Admin', 'ann_a', true);
  const b = await person(browser, 'Bo Teacher', 'bo_t', true);
  const s1 = await person(browser, 'Stu One', 'stu_one');
  const s2 = await person(browser, 'Stu Two', 'stu_two');

  await a.page.goto('/teach');
  await a.page.getByLabel('Create an organization').fill('Hill School');
  await a.page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(a.page.getByRole('heading', { name: 'Hill School' })).toBeVisible();
  const orgCode = (await a.page.getByTestId('org-code').innerText()).trim();
  expect(orgCode).toMatch(/^[A-Z0-9]{10}$/);

  await b.page.goto('/teach');
  await b.page.getByLabel('Join with an invite code').fill('BADCODE123');
  await b.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(b.page.getByText('No organization has that code.')).toBeVisible();
  await b.page.getByLabel('Join with an invite code').fill(orgCode);
  await b.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(b.page.getByText('You joined Hill School.')).toBeVisible();

  const { code, id } = await createClass(a.page, 'Physics', 'Hill School');
  await a.page.getByLabel('Add from your organization').selectOption({ label: 'Bo Teacher' });
  await a.page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(a.page.locator('span.chip', { hasText: 'Teaching assistant' })).toBeVisible();
  await b.page.goto('/teach');
  await expect(b.page.getByText('Co-teaching')).toBeVisible();
  await b.page.getByRole('link', { name: 'Physics' }).click();
  await b.page.getByRole('tab', { name: 'Settings' }).click();
  await expect(b.page.getByRole('button', { name: 'Delete this class' })).toHaveCount(0); // a TA cannot delete

  // seat limit of 1
  await a.page.goto('/teach');
  await a.page.getByRole('link', { name: 'Manage' }).click();
  await a.page.getByLabel('Seat limit').fill('1');
  await a.page.getByRole('button', { name: 'Save' }).first().click();
  await expect(a.page.getByText('Saved.').first()).toBeVisible();
  await s1.page.goto('/classes');
  await s1.page.getByLabel('Class code').fill(code);
  await s1.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(s1.page.getByText('You joined Physics.')).toBeVisible();
  await s2.page.goto('/classes');
  await s2.page.getByLabel('Class code').fill(code);
  await s2.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(s2.page.getByText('This organization has no seats left. Ask your school administrator.')).toBeVisible();

  // rotate the code: the old one stops working; archive blocks joining
  await a.page.goto(`/teach/${id}?tab=settings`);
  await a.page.getByRole('button', { name: 'Make a new code' }).click();
  await expect(a.page.getByText('New code created. The old one no longer works.')).toBeVisible();
  await a.page.goto('/teach');
  await a.page.getByRole('link', { name: 'Manage' }).click();
  await expect(a.page.getByRole('rowheader', { name: /Physics/ })).toBeVisible(); // organization report row
  await expect(a.page.getByText('Totals only.')).toBeVisible();
  await a.page.goto(`/teach/${id}?tab=settings`);
  accept(a.page);
  await a.page.getByRole('button', { name: 'Archive class' }).click();
  await expect(a.page.getByRole('button', { name: 'Restore class' })).toBeVisible();
  await s1.page.goto(`/classes`);
  await s1.page.getByRole('link', { name: 'Physics' }).click();
  await expect(s1.page.getByText('This class is archived.')).toBeVisible();
  for (const x of [a, b, s1, s2]) await x.ctx.close();
});

test('teacher announcements reach students; comments go both ways', async ({ browser }) => {
  const t = await person(browser, 'Tina Teacher', 'tina_t', true);
  const s = await person(browser, 'Stu One', 'stu_one');
  const { code, id } = await createClass(t.page, 'Chat class');
  await publish(t.page, id, 'Task A');
  await s.page.goto('/classes');
  await s.page.getByLabel('Class code').fill(code);
  await s.page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(s.page.getByText('You joined Chat class.')).toBeVisible();
  await t.page.goto(`/teach/${id}?tab=announcements`);
  await t.page.getByLabel('Title').fill('Quiz on Friday');
  await t.page.getByLabel('Message').fill('Bring a pencil');
  await t.page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(t.page.getByText('Posted.')).toBeVisible();
  await s.page.getByRole('link', { name: 'Chat class' }).click();
  await expect(s.page.getByText('Quiz on Friday')).toBeVisible();
  await expect(s.page.getByText('Bring a pencil')).toBeVisible();
  await s.page.locator('details', { hasText: 'Comments' }).locator('summary').click();
  await s.page.getByLabel('Write a comment').fill('Is the due date flexible?');
  await s.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(s.page.getByText('Is the due date flexible?')).toBeVisible();
  await t.page.goto('/notifications');
  await expect(t.page.getByText('Is the due date flexible?')).toBeVisible();
  await t.ctx.close(); await s.ctx.close();
});

for (const locale of ['en', 'fa'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`all class screens pass accessibility checks (${locale}, ${theme}), phone width has no sideways scroll`, async ({ browser }) => {
      const prefs = { theme: theme as string, locale: locale as string };
      const t = await person(browser, 'Tina Teacher', 'tina_t', true);
      const s = await person(browser, 'Stu One', 'stu_one');
      const s2 = await person(browser, 'Stu Two', 'stu_two');
      const { code, id } = await createClass(t.page, 'Algebra');
      await publish(t.page, id, 'Week 1');
      for (const x of [s, s2]) { await x.page.goto('/classes'); await x.page.getByLabel('Class code').fill(code); await x.page.locator('form button[type=submit]').click(); await expect(x.page.getByRole('link', { name: 'Algebra' }).first()).toBeVisible(); }
      await seedWork(s.id, 3);
      await sql(`insert into public.progress(user_id,key,data,client_ts) values ($1,'quiz:2:q1','{"right":false,"tries":3,"pick":1}'::jsonb,$2),($1,'pred:2:p1','{"right":false,"tries":3,"guess":"7"}'::jsonb,$2)`, [s2.id, Date.now()]);
      await sql(`insert into public.submissions(assignment_id, student_id, n, raw_score, score, max_score, detail, snapshot, signals)
                 select a.id, $1, 1, 4, 4, 12, '[{"key":"ex:1:e1","points":5,"earned":4,"state":"partial","hints":1,"attempts":2,"pastes":1}]'::jsonb, '{"ex:1:e1":{"code":"print(1)","pass":false,"sol":true}}'::jsonb, '{"secs":20,"pastes":2}'::jsonb from public.assignments a`, [s.id]);
      await sql(`insert into public.announcements(class_id, author_id, title, body, pinned) select id, teacher_id, 'Welcome', 'Hello class', true from public.classes`);
      const aid = (await sql<{ id: string }>(`select id from public.assignments`))[0].id;
      for (const x of [t, s, s2]) await applyPrefs(x, prefs);

      const studentPages = ['/classes', `/classes/${id}`, '/notifications'];
      for (const p of studentPages) { await s.page.goto(p); await expect(s.page.locator('main h1')).toBeVisible(); await axeClean(s.page, `${p} ${locale} ${theme}`); await shot(s.page, `s-${p}`, locale, theme); }
      const teacherPages = ['/teach', `/teach/${id}`, `/teach/${id}?tab=students&student=${s.id}`, `/teach/${id}?tab=assignments`, `/teach/${id}?tab=gradebook`, `/teach/${id}?tab=announcements`, `/teach/${id}?tab=settings`, `/teach/${id}/review/${aid}/${s.id}`];
      for (const p of teacherPages) { await t.page.goto(p); await expect(t.page.locator('main h1')).toBeVisible(); await expect(t.page.getByText(/…|Loading|در حال/)).toHaveCount(0, { timeout: 15_000 }).catch(() => undefined); await axeClean(t.page, `${p} ${locale} ${theme}`); await shot(t.page, `t-${p}`, locale, theme); }
      // heat map: rows for both students, a stuck student, the most-missed table
      await t.page.goto(`/teach/${id}`);
      await expect(t.page.locator('table.heat tbody tr')).toHaveCount(3);
      await t.page.setViewportSize({ width: 360, height: 800 });
      for (const p of [`/teach/${id}`, `/teach/${id}?tab=gradebook`, `/teach/${id}?tab=assignments`, `/classes/${id}`, `/teach/${id}/review/${aid}/${s.id}`]) {
        await t.page.goto(p); await expect(t.page.locator('main h1')).toBeVisible();
        const over = await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await shot(t.page, `m-${p}`, locale, theme);
        expect(over, `horizontal overflow at 360px on ${p}`).toBeLessThanOrEqual(1);
      }
      await t.ctx.close(); await s.ctx.close(); await s2.ctx.close();
    });
  }
}

test('the demo organization: thirty simulated students fill every teacher screen', async ({ browser }) => {
  test.setTimeout(180_000);
  const t = await person(browser, 'Real Teacher', 'real_teacher', true);
  await sql(readFileSync('../../supabase/demo/demo_seed.sql', 'utf8'));
  await sql(`insert into public.org_members (org_id, user_id, role) select o.id, $1, 'admin' from public.organizations o where o.name='Tracepad Demo School'`, [t.id]);
  await sql(`insert into public.class_teachers (class_id, user_id, role) select c.id, $1, 'teacher' from public.classes c`, [t.id]);
  const id = (await sql<{ id: string }>(`select id from public.classes`))[0].id;
  const org = (await sql<{ id: string }>(`select id from public.organizations`))[0].id;
  await t.page.goto(`/teach/${id}`);
  await expect(t.page.getByText(/30 students/)).toBeVisible();
  await expect(t.page.locator('table.heat tbody tr')).toHaveCount(31); // 30 students + the class average
  await t.page.goto(`/teach/${id}?tab=gradebook`);
  await expect.poll(() => t.page.locator('tbody tr').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(30);
  await expect(t.page.getByRole('rowheader', { name: 'Ali Karimi' })).toBeVisible();
  await t.page.goto(`/teach/${id}?tab=students`);
  await expect(t.page.getByText('Ali Karimi').first()).toBeVisible();
  await t.page.goto(`/teach/org/${org}`);
  await expect(t.page.getByRole('rowheader', { name: /Python 101/ })).toBeVisible();
  for (const [name, path] of [['overview', `/teach/${id}`], ['students', `/teach/${id}?tab=students`], ['gradebook', `/teach/${id}?tab=gradebook`], ['org', `/teach/org/${org}`]]) {
    await t.page.goto(path); await expect(t.page.locator('main h1')).toBeVisible();
    await axeClean(t.page, `demo ${name}`); await shot(t.page, `demo-${name}`, 'en', 'light');
  }
  await t.ctx.close();
});
