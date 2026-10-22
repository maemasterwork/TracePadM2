#!/usr/bin/env python3
"""Generates supabase/demo/demo_seed.sql: one demo organization, one teacher, one class and thirty SIMULATED students.

The students are invented (names, usernames @demo.invalid, no password: nobody can sign in as them). Their histories are
produced by a seeded random model (see ARCHETYPES) and then written as ordinary progress rows. Submissions are NOT
written directly: the generated SQL calls the real submit_assignment() as each student, so scoring, snapshots and the
frozen item lists go through the same code as a real submission. Only the clock is moved afterwards (submitted_at).
Everything is relative to the moment the file is loaded, so the demo never looks stale.

  python3 tools/demo/gen_seed.py > supabase/demo/demo_seed.sql      (deterministic: same output every run)
"""
import json, random, sys, uuid, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LABS = json.loads((ROOT / 'apps/web/public/content/01-objects-and-data-structures/labs.json').read_text('utf-8'))
NS = uuid.UUID('7c1a5a3e-0000-4000-8000-00000000d3a0')
R = random.Random(20261021)
DAY = 86_400_000
HOUR = 3_600_000
q = lambda s: "'" + str(s).replace("'", "''") + "'"
uid = lambda name: str(uuid.uuid5(NS, name))

TEACHER = ('demo-teacher', 'Ms. Mina Rahimi', 'demo_teacher')
NAMES = ['Ali Karimi', 'Sara Ahmadi', 'Reza Hosseini', 'Neda Mohammadi', 'Arash Jafari', 'Maryam Sadeghi', 'Omid Rostami',
         'Leila Ghorbani', 'Kian Fathi', 'Parisa Noori', 'Sina Ebrahimi', 'Niloofar Azizi', 'Amir Tehrani', 'Hana Moradi',
         'Daniel Reyes', 'Emma Larsson', 'Noah Becker', 'Mia Fontaine', 'Lucas Silva', 'Aiko Tanaka', 'Omar Haddad',
         'Zoe Walker', 'Ravi Menon', 'Chloe Martin', 'Yusuf Demir', 'Anna Kowalska', 'Ben Cohen', 'Sofia Rossi',
         'Mehdi Zare', 'Tara Bagheri']
# kind, count, ability (chance of a right first answer), chapters reached (min, max), work pace
ARCHETYPES = [('strong', 6, .88, (8, 9)), ('steady', 11, .70, (5, 8)), ('struggling', 6, .45, (3, 6)),
              ('stalled', 4, .55, (1, 3)), ('light', 3, .6, (1, 2))]

def pools():
    items = []
    for chs, c in LABS['chapters'].items():
        ch = int(chs)
        for p in c.get('predictions', []): items.append(('pred', ch, p))
        for z in c.get('quizzes', []): items.append(('quiz', ch, z))
        for e in c.get('exercises', []): items.append(('ex', ch, e))
    return items
ITEMS = pools()

def difficulty(key):  # stable per-item difficulty: some items are genuinely harder (they become "most missed")
    h = int(hashlib.sha1(key.encode()).hexdigest()[:6], 16) / 0xFFFFFF
    return -.28 if h > .86 else (-.12 if h > .6 else .05)

def wrong_guesses(kind, p):
    if kind == 'quiz':
        n = len(p['options']); c = p['correct']
        order = [i for i in range(n) if i != c]; R.shuffle(order); return order
    toks = str(p['answer']).split()
    cands = []
    for i, t in enumerate(toks):
        try: v = int(t); w = toks.copy(); w[i] = str(v + 1); cands.append(' '.join(w))
        except ValueError:
            try: v = float(t); w = toks.copy(); w[i] = str(int(v)) if v != int(v) else str(v + .5); cands.append(' '.join(w))
            except ValueError: pass
    if len(toks) > 1: cands.append(' '.join(reversed(toks)))
    cands.append('Error')
    seen = []; [seen.append(x) for x in cands if x != p['answer'] and x not in seen]
    return seen or ['0']

def code_of(e, ok):
    v = e.get('solution') if ok else e.get('starter')
    if isinstance(v, dict): v = v.get('en') or next(iter(v.values()), '')
    return str(v or '')[:2000]

rows, students = [], []   # rows: (uid, key, base, hist[{o,ok,hint}], updated_offset_ms)
def add(u, key, base, hist, off): rows.append((u, key, base, hist, off))

n = 0
for kind, count, ability, (lo, hi) in ARCHETYPES:
    for _ in range(count):
        name = NAMES[n]; n += 1
        u = uid(f'student-{n}')
        reach = R.randint(lo, hi)
        join_days = R.randint(34, 41)
        students.append(dict(uid=u, name=name, username=f'demo_{n:02d}', kind=kind, join=join_days))
        pace = R.choice([2, 3, 3, 4])             # days per chapter
        paste_habit = 2 if (n in (7, 22)) else 0   # two learners paste a lot (an observation, never a penalty)
        weak_tags = set(R.sample(['true-division', 'naming', 'aliasing', 'slicing', 'mutable', 'float-eq'], 2))
        for kind_i, ch, p in ITEMS:
            if ch > reach + (1 if kind in ('struggling', 'steady') and R.random() < .35 else 0):
                continue
            partial = ch == reach and R.random() < .35   # the last chapter is often half done
            if partial and R.random() < .5: continue
            key = f'{kind_i}:{ch}:{p["id"]}'
            skill = ability + difficulty(key) - (.18 if p.get('tag') in weak_tags else 0) + R.uniform(-.1, .1)
            day0 = join_days - (ch - 1) * pace - R.randint(0, 1)
            when = max(0, day0) * DAY + R.randint(0, 20) * HOUR
            hist, tries = [], 0
            if kind_i in ('pred', 'quiz'):
                skill = skill * .8 - .08   # predicting output is harder than it looks; this is what the misconception tables are for
                cands = wrong_guesses(kind_i, p); ok = False
                while tries < 3 and not ok:
                    ok = R.random() < (skill if tries == 0 else min(.95, skill + .25 * tries))
                    hist.append(dict(o=when - tries * 90_000, ok=ok)); tries += 1
                    if not ok: last_wrong = cands[0] if R.random() < .7 or len(cands) == 1 else R.choice(cands[1:])
                hist.reverse()
                base = dict(right=ok, tries=tries)
                if kind_i == 'pred': base['guess'] = str(p['answer']) if ok else str(last_wrong)
                else: base['pick'] = p['correct'] if ok else last_wrong
                add(u, key, base, hist, when - (tries - 1) * 90_000)
            else:
                total = max(1, len(p.get('tests', [])) or 3)
                attempts = 1 + int(R.expovariate(1.2 + 2 * skill)); hints = 0
                if skill < .6: hints = R.choice([0, 1, 1, 2, 3])
                elif R.random() < .25: hints = 1
                solved = R.random() < (.55 + skill * .5) and not (kind == 'stalled' and ch > 1 and R.random() < .6)
                sol = (not solved and R.random() < .25) or (solved and skill < .5 and R.random() < .12)
                secs = int(R.uniform(150, 600) * attempts ** .5 * (1.3 if skill < .6 else 1))
                pastes = paste_habit * R.randint(1, 3) if paste_habit else (1 if R.random() < .04 else 0)
                for a in range(attempts):
                    hist.append(dict(o=when - (attempts - 1 - a) * 4 * 60_000, ok=solved and a == attempts - 1, **({'hint': True} if hints and a >= 1 else {})))
                last = dict(passed=total if solved else R.randint(0, total - 1), total=total)
                base = {'pass': solved, 'attempts': attempts, 'hints': hints, 'secs': secs, 'last': last, 'code': code_of(p, solved)}
                if sol: base['sol'] = True
                if pastes: base['pastes'] = pastes
                add(u, key, base, hist, when)

# ---- assignments: (title, chapters, due offset days (negative = past), weight)
ASSIGN = [('Numbers & variables', [1, 2], -16, 1), ('Strings & printing', [3, 4], -6, 1), ('Lists, dictionaries & tuples', [5, 6, 7], 7, 2)]
def items_for(chs):
    out = []
    for kind_i, ch, p in ITEMS:
        if ch in chs: out.append(dict(key=f'{kind_i}:{ch}:{p["id"]}', points=5 if kind_i == 'ex' else 1))
    return out

out = []
w = out.append
w('-- GENERATED by tools/demo/gen_seed.py: do not edit by hand. All people here are invented; the students cannot sign in.')
w('-- Load: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/demo/demo_seed.sql   (as a superuser / the postgres role)')
w('-- Remove: supabase/demo/remove.sql.  To look around as a teacher: supabase/demo/adopt.sql.')
w("do $$ begin if exists (select 1 from public.organizations where name = 'Tracepad Demo School') then raise exception 'demo data already loaded: run supabase/demo/remove.sql first'; end if; end $$;")
w('begin;')
tid = uid('teacher')
for u, name, uname, email in [(tid, TEACHER[1], TEACHER[2], 'demo-teacher@demo.invalid')] + [(s['uid'], s['name'], s['username'], f'demo-{s["username"][5:]}@demo.invalid') for s in students]:
    w(f"insert into auth.users (id, email, raw_user_meta_data) values ({q(u)}, {q(email)}, {q(json.dumps({'full_name': name, 'username': uname}))}::jsonb);")
w(f"update public.profiles set role = 'teacher' where id = {q(tid)};")
w("update public.profiles set created_at = now() - interval '45 days' where id in (select id from auth.users where email like 'demo-%@demo.invalid');")
oid, cid = uid('org'), uid('class')
w(f"insert into public.organizations (id, name, seat_limit, invite_code, created_by) values ({q(oid)}, 'Tracepad Demo School', 60, public._new_code(10), {q(tid)});")
w(f"insert into public.org_members (org_id, user_id, role) values ({q(oid)}, {q(tid)}, 'admin');")
w(f"insert into public.classes (id, teacher_id, name, join_code, org_id, term, created_at) values ({q(cid)}, {q(tid)}, 'Python 101 (demo)', public._new_code(8), {q(oid)}, 'Autumn 2026', now() - interval '42 days');")
for s in students:
    w(f"insert into public.enrollments (class_id, student_id, joined_at) values ({q(cid)}, {q(s['uid'])}, now() - interval '{s['join']} days');")
# progress: base + hist with times relative to load time
w('create temp table _demo_rows (uid uuid, key text, base jsonb, hist jsonb, off bigint) on commit drop;')
CH = 250
for i in range(0, len(rows), CH):
    vals = ',\n'.join(f"({q(u)}, {q(k)}, {q(json.dumps(b))}::jsonb, {q(json.dumps(h))}::jsonb, {off})" for u, k, b, h, off in rows[i:i + CH])
    w(f'insert into _demo_rows values\n{vals};')
w("""insert into public.progress (user_id, key, data, client_ts, updated_at)
select uid, key,
       base || jsonb_build_object('hist', (select coalesce(jsonb_agg(jsonb_build_object('t', n.ms - (h ->> 'o')::bigint) || (h - 'o')), '[]'::jsonb) from jsonb_array_elements(hist) h)),
       n.ms - off, to_timestamp((n.ms - off) / 1000.0)
from _demo_rows, (select (extract(epoch from now()) * 1000)::bigint as ms) n;""")
# assignments (published; due dates are set after submitting so the real late rules do not refuse the seed)
aids = []
for i, (title, chs, due, weight) in enumerate(ASSIGN):
    a = uid(f'assignment-{i}'); aids.append(a)
    w(f"insert into public.assignments (id, class_id, page_id, title, description, items, status, late_policy, weight, max_submissions, show_results, created_at) values ({q(a)}, {q(cid)}, '1-numbers', {q(title)}, '', {q(json.dumps(items_for(chs)))}::jsonb, 'published', '{{\"mode\":\"accept\"}}'::jsonb, {weight}, 1, 'on_return', now() - interval '{abs(due) + 10 if due < 0 else 12} days');")
# submissions through the real function
w("""create or replace function pg_temp.submit_as(p_user uuid, p_asg uuid, p_secs int, p_pastes int) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform public.submit_assignment(p_asg, jsonb_build_object('secs', p_secs, 'pastes', p_pastes));
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $f$;""")
sub_rows = []
for s in students:
    done = {int(k.split(':')[1]) for (u, k, *_r) in rows if u == s['uid']}
    for i, (title, chs, due, weight) in enumerate(ASSIGN):
        # who hands in: students who got through the chapters (or most of them); stalled and light learners often do not
        reached = sum(1 for c in chs if c in done)
        p_sub = {0: 0, 1: .45}.get(reached, .93) if reached < len(chs) else .95
        if due > 0: p_sub *= .35   # the open assignment: only the early birds
        if R.random() >= p_sub: continue
        deadline_ms = due * DAY
        late = R.random() < (.22 if s['kind'] in ('struggling', 'light') else .07) and due < 0
        off = (-deadline_ms if due < 0 else 0) + 0
        # hand-in time (ms before load): usually shortly before the deadline; late ones a day or two after it
        ago = (abs(due) * DAY + R.randint(1, 36) * HOUR) if not late else (abs(due) * DAY - R.randint(5, 60) * HOUR)
        if due > 0: ago = R.randint(2, 70) * HOUR
        secs = R.randint(600, 4200)
        sub_rows.append((s['uid'], aids[i], max(ago, 3 * HOUR), secs, 2 if s['username'] in ('demo_07', 'demo_22') else 0, i))
for u, a, ago, secs, pastes, i in sub_rows:
    w(f"do $$ begin perform pg_temp.submit_as({q(u)}, {q(a)}, {secs}, {pastes}); end $$;")
    w(f"update public.submissions set submitted_at = now() - interval '{ago // 1000} seconds' where assignment_id = {q(a)} and student_id = {q(u)};")
for i, (title, chs, due, weight) in enumerate(ASSIGN):
    w(f"update public.assignments set due_at = now() + interval '{due} days', updated_at = now() where id = {q(aids[i])};")
    w(f"update public.submissions set late_seconds = greatest(0, extract(epoch from submitted_at - (now() + interval '{due} days'))::int) where assignment_id = {q(aids[i])};")
# grades: the two past assignments are marked and returned; a few hand-set scores with reasons; the open one stays unmarked
w(f"insert into public.grades (assignment_id, student_id, returned_at, updated_by) select assignment_id, student_id, submitted_at + interval '2 days', {q(tid)} from public.submissions where assignment_id in ({q(aids[0])}, {q(aids[1])});")
R2 = random.Random(7)
REASONS = ['Read the code: correct idea, small typo cost the tests', 'Partial credit after a conversation in class', 'Resubmitted the working version after office hours']
picks = R2.sample([r for r in sub_rows if r[5] < 2], 5)
for k, (u, a, *_x) in enumerate(picks):
    reason = REASONS[k % 3]
    w(f"""with s as (select score, max_score from public.submissions where assignment_id = {q(a)} and student_id = {q(u)}),
 up as (update public.grades g set override_score = least((select max_score from s), (select score from s) + {R2.randint(1, 4)}), comment = {q('Good effort: ' + reason.lower() + '.')} where g.assignment_id = {q(a)} and g.student_id = {q(u)} returning g.override_score)
insert into public.grade_history (assignment_id, student_id, actor, at, old_score, new_score, reason) select {q(a)}, {q(u)}, {q(tid)}, now() - interval '{R2.randint(1, 5)} days', (select score from s), override_score, {q(reason)} from up;""")
ANN = [('Welcome to Python 101', 'Start with chapter 1. Do the predictions before you run the code: it is the habit that matters.', True, 40),
       ('Assignment 2 is due Friday', 'Strings and printing. If a test fails, read the message before you change anything.', False, 8),
       ('Office hours moved', 'Thursday office hours start 30 minutes later this week.', False, 2)]
for title, body, pin, days in ANN:
    w(f"insert into public.announcements (class_id, author_id, title, body, pinned, created_at) values ({q(cid)}, {q(tid)}, {q(title)}, {q(body)}, {str(pin).lower()}, now() - interval '{days} days');")
for (u, a, *_x) in picks[:3]:
    w(f"insert into public.comments (assignment_id, student_id, author_id, body, created_at) values ({q(a)}, {q(u)}, {q(tid)}, 'Nice use of a loop here. Try naming the variable for what it holds.', now() - interval '3 days');")
w('commit;')
sys.stdout.write('\n'.join(out) + '\n')
sys.stderr.write(f'{len(students)} students, {len(rows)} progress rows, {len(sub_rows)} submissions\n')
