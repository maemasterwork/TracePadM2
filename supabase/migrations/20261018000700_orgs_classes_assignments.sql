-- Tracepad migration 7: organizations, co-teachers, class lifecycle, assignments v2, submissions, grades,
-- comments, announcements, notifications, extensions, analytics functions. Idempotent.
--
-- DESIGN NOTES
--   * Tables that hold results (submissions, grades, grade_history) have RLS on and NO table grants: every read and
--     write goes through a function that checks who is asking. That way a student can never read a score before it
--     is returned, and a score can never be written except by the rules below.
--   * "Verified" here means: the SERVER stamps the submission time, applies the lateness rule, freezes a snapshot
--     of the learner's rows and computes the score from that snapshot. The correctness bits inside the snapshot
--     (pass / right) are still reported by the learner's browser; the teacher review screen can re-run the stored
--     code in the teacher's own browser to check them. See docs/database.md.

------------------------------------------------------------------------------
-- merge rule update: more exercise fields only go up (pastes, secs)
------------------------------------------------------------------------------
create or replace function public._merge_ex(older jsonb, newer jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  m jsonb := coalesce(older, '{}'::jsonb) || coalesce(newer, '{}'::jsonb);
  k text; a numeric; b numeric;
begin
  if (older ->> 'pass') = 'true' or (newer ->> 'pass') = 'true' then
    m := m || jsonb_build_object('pass', true);
  end if;
  if (older ->> 'sol') = 'true' or (newer ->> 'sol') = 'true' then
    m := m || jsonb_build_object('sol', true);
  end if;
  foreach k in array array['attempts', 'hints', 'pastes', 'secs'] loop
    a := case when jsonb_typeof(older -> k) = 'number' then (older ->> k)::numeric end;
    b := case when jsonb_typeof(newer -> k) = 'number' then (newer ->> k)::numeric end;
    if a is not null or b is not null then m := m || jsonb_build_object(k, greatest(a, b)); end if;
  end loop;
  return m;
end $$;

------------------------------------------------------------------------------
-- organizations
------------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  seat_limit  int check (seat_limit is null or seat_limit >= 1),
  invite_code text not null unique,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create table if not exists public.org_members (
  org_id   uuid not null references public.organizations (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  role     text not null check (role in ('admin', 'teacher')),
  added_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members (user_id);

------------------------------------------------------------------------------
-- classes: lifecycle columns, co-teachers
------------------------------------------------------------------------------
alter table public.classes add column if not exists org_id uuid references public.organizations (id) on delete set null;
alter table public.classes add column if not exists term text not null default '';
alter table public.classes add column if not exists archived_at timestamptz;
alter table public.classes add column if not exists join_code_expires_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'classes_term_check' and conrelid = 'public.classes'::regclass) then
    alter table public.classes add constraint classes_term_check check (char_length(term) <= 40);
  end if;
end $$;
create index if not exists classes_org_idx on public.classes (org_id);

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  role     text not null check (role in ('teacher', 'ta')),
  added_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_teachers_user_idx on public.class_teachers (user_id);

------------------------------------------------------------------------------
-- helpers (redefined: co-teachers and organization admins)
------------------------------------------------------------------------------
create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and exists (select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role = 'admin');
$$;
create or replace function public.in_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and exists (select 1 from public.org_members where org_id = p_org and user_id = auth.uid());
$$;

-- Owner or co-teacher or TA (and still a teacher account).
create or replace function public.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher() and exists (
    select 1 from public.classes c where c.id = p_class and (
      c.teacher_id = auth.uid()
      or exists (select 1 from public.class_teachers t where t.class_id = c.id and t.user_id = auth.uid())));
$$;
-- Owner, or admin of the class's organization: may delete the class, add or remove co-teachers.
create or replace function public.owns_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher() and exists (
    select 1 from public.classes c where c.id = p_class
      and (c.teacher_id = auth.uid() or public.is_org_admin(c.org_id)));
$$;
create or replace function public.views_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.teaches_class(p_class) or public.owns_class(p_class);
$$;
create or replace function public.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher() and exists (
    select 1 from public.enrollments e where e.student_id = p_student and public.teaches_class(e.class_id));
$$;
create or replace function public.assignment_class(p_assignment uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select class_id from public.assignments where id = p_assignment;
$$;

------------------------------------------------------------------------------
-- assignments v2
------------------------------------------------------------------------------
alter table public.assignments add column if not exists description text not null default '';
alter table public.assignments add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.assignments add column if not exists status text not null default 'draft';
alter table public.assignments add column if not exists release_at timestamptz;
alter table public.assignments add column if not exists close_at timestamptz;
alter table public.assignments add column if not exists late_policy jsonb not null default '{"mode":"accept"}'::jsonb;
alter table public.assignments add column if not exists weight numeric not null default 1;
alter table public.assignments add column if not exists max_submissions int not null default 1;
alter table public.assignments add column if not exists show_results text not null default 'on_return';
alter table public.assignments add column if not exists updated_at timestamptz not null default now();

create or replace function public.assignments_check() returns trigger
language plpgsql set search_path = public as $$
declare it jsonb; lp jsonb := new.late_policy;
begin
  if new.status not in ('draft', 'published') then raise exception 'bad status' using errcode = '22023'; end if;
  if new.show_results not in ('on_submit', 'on_return') then raise exception 'bad show_results' using errcode = '22023'; end if;
  if char_length(new.title) > 120 or char_length(new.description) > 2000 then
    raise exception 'title or description too long' using errcode = '22023';
  end if;
  if new.weight < 0 or new.weight > 100 then raise exception 'bad weight' using errcode = '22023'; end if;
  if new.max_submissions not between 1 and 20 then raise exception 'bad max_submissions' using errcode = '22023'; end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) > 200 then
    raise exception 'items must be an array of at most 200' using errcode = '22023';
  end if;
  for it in select value from jsonb_array_elements(new.items) loop
    if jsonb_typeof(it) <> 'object' or jsonb_typeof(it -> 'key') <> 'string'
       or (it ->> 'key') !~ '^(pred|quiz|ex):[0-9]+:[a-z0-9_-]{1,60}$'
       or jsonb_typeof(it -> 'points') <> 'number' or (it ->> 'points')::numeric not between 0 and 100 then
      raise exception 'bad item %', it using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(lp) <> 'object' or (lp ->> 'mode') not in ('reject', 'accept', 'penalty')
     or (lp ? 'per_day' and (jsonb_typeof(lp -> 'per_day') <> 'number' or (lp ->> 'per_day')::numeric not between 0 and 100))
     or (lp ? 'max' and (jsonb_typeof(lp -> 'max') <> 'number' or (lp ->> 'max')::numeric not between 0 and 100)) then
    raise exception 'bad late_policy' using errcode = '22023';
  end if;
  if new.status = 'published' and jsonb_array_length(new.items) = 0 then
    raise exception 'a published assignment needs at least one item' using errcode = '22023';
  end if;
  if new.close_at is not null and new.due_at is not null and new.close_at < new.due_at then
    raise exception 'close_at is before due_at' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists assignments_check on public.assignments;
create trigger assignments_check before insert or update on public.assignments
  for each row execute function public.assignments_check();

------------------------------------------------------------------------------
-- notifications (in-app). Created only by the functions below, never by the API.
------------------------------------------------------------------------------
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('assignment', 'grade', 'announcement', 'comment', 'class')),
  title      text not null check (char_length(title) <= 200),
  body       text not null default '' check (char_length(body) <= 1000),
  link       text not null default '' check (char_length(link) <= 200),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Skips users who switched this kind off (profiles.display_prefs -> notify -> <kind> = false). Keeps the latest 200.
create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  if exists (select 1 from public.profiles where id = p_user and display_prefs -> 'notify' ->> p_kind = 'false') then return; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 1000), left(coalesce(p_link, ''), 200));
  delete from public.notifications where user_id = p_user and id not in
    (select id from public.notifications where user_id = p_user order by id desc limit 200);
end $$;

------------------------------------------------------------------------------
-- announcements, comments, extensions
------------------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  body       text not null default '' check (char_length(body) <= 4000),
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists announcements_class_idx on public.announcements (class_id, created_at desc);

create table if not exists public.comments (
  id            bigint generated always as identity primary key,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  author_id     uuid references public.profiles (id) on delete set null,
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now()
);
create index if not exists comments_asg_idx on public.comments (assignment_id, student_id, id);

create table if not exists public.extensions (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  due_at        timestamptz not null,
  reason        text not null default '' check (char_length(reason) <= 300),
  granted_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

------------------------------------------------------------------------------
-- submissions, grades, grade_history (no direct grants: functions only)
------------------------------------------------------------------------------
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  n             int not null,
  submitted_at  timestamptz not null default now(),
  late_seconds  int not null default 0,
  penalty_pct   numeric not null default 0,
  raw_score     numeric not null,
  score         numeric not null,
  max_score     numeric not null,
  detail        jsonb not null default '[]'::jsonb,
  snapshot      jsonb not null default '{}'::jsonb check (pg_column_size(snapshot) < 1000000),
  signals       jsonb not null default '{}'::jsonb,
  unique (assignment_id, student_id, n)
);
create index if not exists submissions_student_idx on public.submissions (student_id);

create table if not exists public.grades (
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  override_score numeric check (override_score is null or override_score >= 0),
  comment        text not null default '' check (char_length(comment) <= 2000),
  returned_at    timestamptz,
  updated_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

-- Every change of a manual score, who made it and why. The API can neither write nor change it.
create table if not exists public.grade_history (
  id            bigint generated always as identity primary key,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  actor         uuid,
  at            timestamptz not null default now(),
  old_score     numeric,
  new_score     numeric,
  reason        text not null default ''
);
create index if not exists grade_history_asg_idx on public.grade_history (assignment_id, student_id, id);
create or replace function public.grade_history_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'grade_history cannot be changed' using errcode = '42501';
end $$;
drop trigger if exists grade_history_no_update on public.grade_history;
create trigger grade_history_no_update before update on public.grade_history
  for each row execute function public.grade_history_immutable();
drop trigger if exists grade_history_no_truncate on public.grade_history;
create trigger grade_history_no_truncate before truncate on public.grade_history
  for each statement execute function public.grade_history_immutable();

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.organizations  enable row level security;
alter table public.org_members    enable row level security;
alter table public.class_teachers enable row level security;
alter table public.notifications  enable row level security;
alter table public.announcements  enable row level security;
alter table public.comments       enable row level security;
alter table public.extensions     enable row level security;
alter table public.submissions    enable row level security;
alter table public.grades         enable row level security;
alter table public.grade_history  enable row level security;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using (public.in_org(id));
drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- Members see only their own membership rows; names of colleagues come from org_members_list().
drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members for select to authenticated using (user_id = auth.uid());

drop policy if exists class_teachers_select on public.class_teachers;
create policy class_teachers_select on public.class_teachers for select to authenticated
  using (user_id = auth.uid() or public.views_class(class_id));

-- classes
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (public.views_class(id) or public.in_class(id));
drop policy if exists classes_insert on public.classes;   -- classes are created by create_class()
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (public.teaches_class(id)) with check (public.teaches_class(id));
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated using (public.owns_class(id));

-- assignments: staff see everything of their classes; students only what is published and released.
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
  using (public.views_class(class_id)
         or (public.in_class(class_id) and status = 'published' and (release_at is null or release_at <= now())));

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (public.views_class(class_id) or public.in_class(class_id));
drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.teaches_class(class_id) and author_id = auth.uid());
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.teaches_class(class_id));

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (student_id = auth.uid() or public.teaches_class(public.assignment_class(assignment_id)));

drop policy if exists extensions_select on public.extensions;
create policy extensions_select on public.extensions for select to authenticated
  using (student_id = auth.uid() or public.teaches_class(public.assignment_class(assignment_id)));
drop policy if exists extensions_write on public.extensions;
create policy extensions_write on public.extensions for all to authenticated
  using (public.teaches_class(public.assignment_class(assignment_id)))
  with check (public.teaches_class(public.assignment_class(assignment_id))
              and exists (select 1 from public.enrollments e where e.class_id = public.assignment_class(assignment_id)
                          and e.student_id = extensions.student_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

------------------------------------------------------------------------------
-- notification and audit triggers
------------------------------------------------------------------------------
create or replace function public.assignments_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  if tg_op = 'DELETE' then
    perform public._audit('assignment.delete', old.id::text, jsonb_build_object('class', old.class_id));
    return old;
  end if;
  if tg_op = 'INSERT' then
    perform public._audit('assignment.create', new.id::text, jsonb_build_object('class', new.class_id, 'status', new.status));
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform public._audit('assignment.publish', new.id::text, jsonb_build_object('class', new.class_id));
    if new.release_at is null or new.release_at <= now() then
      for s in select student_id from public.enrollments where class_id = new.class_id loop
        perform public._notify(s, 'assignment', new.title, '', '/classes/' || new.class_id::text);
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists assignments_after on public.assignments;
create trigger assignments_after after insert or update or delete on public.assignments
  for each row execute function public.assignments_after();

create or replace function public.announcements_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  for s in select student_id from public.enrollments where class_id = new.class_id loop
    perform public._notify(s, 'announcement', new.title, left(new.body, 200), '/classes/' || new.class_id::text);
  end loop;
  return new;
end $$;
drop trigger if exists announcements_after on public.announcements;
create trigger announcements_after after insert on public.announcements
  for each row execute function public.announcements_after();

create or replace function public.extensions_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._audit('assignment.extend', new.assignment_id::text,
    jsonb_build_object('student', new.student_id, 'due_at', new.due_at));
  perform public._notify(new.student_id, 'assignment', (select title from public.assignments where id = new.assignment_id),
    '', '/classes/' || public.assignment_class(new.assignment_id)::text);
  return new;
end $$;
drop trigger if exists extensions_after on public.extensions;
create trigger extensions_after after insert or update on public.extensions
  for each row execute function public.extensions_after();

------------------------------------------------------------------------------
-- organizations: functions
------------------------------------------------------------------------------
create or replace function public._new_code(p_len int) returns text
language sql volatile set search_path = public as $$
  -- 31 characters (no 0 O 1 I L) from the database's secure random source
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + (get_byte(decode(substr(md5(random()::text || gen_random_uuid()::text), 1, 2), 'hex'), 0) % 31), 1), '')
  from generate_series(1, p_len);
$$;

create or replace function public.create_org(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_teacher() then raise exception 'teachers only' using errcode = '42501'; end if;
  if not public.check_rate('create_org', 5, 3600) then raise exception 'rate limited' using errcode = 'P0001'; end if;
  insert into public.organizations (name, invite_code, created_by)
  values (btrim(p_name), public._new_code(10), auth.uid()) returning id into v_id;
  insert into public.org_members (org_id, user_id, role) values (v_id, auth.uid(), 'admin');
  perform public._audit('org.create', v_id::text, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end $$;

-- A teacher joins an organization with its invite code. Unknown code: no rows (so wrong guesses stay counted).
create or replace function public.org_join(p_code text) returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_teacher() then raise exception 'teachers only' using errcode = '42501'; end if;
  if not public.check_rate('org_join', 10, 60) then raise exception 'rate limited' using errcode = 'P0001'; end if;
  select * into o from public.organizations where invite_code = upper(btrim(p_code));
  if not found then return; end if;
  insert into public.org_members (org_id, user_id, role) values (o.id, auth.uid(), 'teacher') on conflict do nothing;
  return query select o.id, o.name;
end $$;

create or replace function public.rotate_org_invite(p_org uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text := public._new_code(10);
begin
  if not public.is_org_admin(p_org) then raise exception 'not an organization admin' using errcode = '42501'; end if;
  update public.organizations set invite_code = c where id = p_org;
  perform public._audit('org.rotate_invite', p_org::text, '{}'::jsonb);
  return c;
end $$;

create or replace function public.org_invite_code(p_org uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org) then raise exception 'not an organization admin' using errcode = '42501'; end if;
  return (select invite_code from public.organizations where id = p_org);
end $$;

create or replace function public.org_members_list(p_org uuid)
returns table (user_id uuid, full_name text, username text, role text, classes int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.in_org(p_org) then raise exception 'not a member' using errcode = '42501'; end if;
  return query
  select m.user_id, p.full_name, p.username, m.role,
         (select count(*)::int from public.classes c where c.org_id = p_org and c.teacher_id = m.user_id)
  from public.org_members m join public.profiles p on p.id = m.user_id
  where m.org_id = p_org order by m.role, p.full_name;
end $$;

-- p_role null removes the member. The last admin can never be removed or demoted.
create or replace function public.org_set_member(p_org uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_admins int;
begin
  if not public.is_org_admin(p_org) then raise exception 'not an organization admin' using errcode = '42501'; end if;
  if p_role is not null and p_role not in ('admin', 'teacher') then raise exception 'bad role' using errcode = '22023'; end if;
  if not exists (select 1 from public.org_members where org_id = p_org and user_id = p_user) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  select count(*) into v_admins from public.org_members where org_id = p_org and role = 'admin' and user_id <> p_user;
  if v_admins = 0 and p_role is distinct from 'admin' then
    raise exception 'an organization needs at least one admin' using errcode = '23514';
  end if;
  if p_role is null then
    delete from public.org_members where org_id = p_org and user_id = p_user;
    delete from public.class_teachers ct using public.classes c
      where ct.class_id = c.id and c.org_id = p_org and ct.user_id = p_user;
  else
    update public.org_members set role = p_role where org_id = p_org and user_id = p_user;
  end if;
  perform public._audit('org.member', p_org::text, jsonb_build_object('user', p_user, 'role', p_role));
end $$;

create or replace function public.org_leave(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_org(p_org) then return; end if;
  if (select role from public.org_members where org_id = p_org and user_id = auth.uid()) = 'admin'
     and not exists (select 1 from public.org_members where org_id = p_org and role = 'admin' and user_id <> auth.uid()) then
    raise exception 'an organization needs at least one admin' using errcode = '23514';
  end if;
  delete from public.org_members where org_id = p_org and user_id = auth.uid();
  delete from public.class_teachers ct using public.classes c
    where ct.class_id = c.id and c.org_id = p_org and ct.user_id = auth.uid();
  update public.classes set org_id = null where org_id = p_org and teacher_id = auth.uid();
end $$;

create or replace function public.org_summary(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org) then raise exception 'not an organization admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'seat_limit', (select seat_limit from public.organizations where id = p_org),
    'seats_used', (select count(distinct e.student_id) from public.enrollments e join public.classes c on c.id = e.class_id where c.org_id = p_org),
    'teachers', (select count(*) from public.org_members where org_id = p_org),
    'classes', (select count(*) from public.classes where org_id = p_org and archived_at is null),
    'archived_classes', (select count(*) from public.classes where org_id = p_org and archived_at is not null));
end $$;

-- Organization-wide report: one row per class, aggregates only (no student names or answers).
create or replace function public.org_report(p_org uuid)
returns table (class_id uuid, name text, term text, archived boolean, teacher_name text, students int,
               assignments int, submissions int, avg_pct numeric, last_submission timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_org_admin(p_org) then raise exception 'not an organization admin' using errcode = '42501'; end if;
  return query
  select c.id, c.name, c.term, c.archived_at is not null, p.full_name,
         (select count(*)::int from public.enrollments e where e.class_id = c.id),
         (select count(*)::int from public.assignments a where a.class_id = c.id and a.status = 'published'),
         (select count(*)::int from public.submissions s join public.assignments a on a.id = s.assignment_id where a.class_id = c.id),
         (select round(avg(case when s.max_score > 0 then 100 * s.score / s.max_score end), 1)
            from public.submissions s join public.assignments a on a.id = s.assignment_id
            where a.class_id = c.id
              and s.n = (select max(s2.n) from public.submissions s2 where s2.assignment_id = s.assignment_id and s2.student_id = s.student_id)),
         (select max(s.submitted_at) from public.submissions s join public.assignments a on a.id = s.assignment_id where a.class_id = c.id)
  from public.classes c join public.profiles p on p.id = c.teacher_id
  where c.org_id = p_org order by c.archived_at is not null, c.name;
end $$;

------------------------------------------------------------------------------
-- classes: functions
------------------------------------------------------------------------------
create or replace function public.create_class(p_name text, p_term text default '', p_org uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_teacher() then raise exception 'teachers only' using errcode = '42501'; end if;
  if p_org is not null and not public.in_org(p_org) then raise exception 'not a member of that organization' using errcode = '42501'; end if;
  if not public.check_rate('create_class', 30, 3600) then raise exception 'rate limited' using errcode = 'P0001'; end if;
  insert into public.classes (teacher_id, name, term, org_id, join_code)
  values (auth.uid(), btrim(p_name), coalesce(btrim(p_term), ''), p_org, public._new_code(8)) returning id into v_id;
  perform public._audit('class.create', v_id::text, jsonb_build_object('org', p_org));
  return v_id;
end $$;

-- New code (always) and an optional expiry in days (null = no expiry).
create or replace function public.rotate_join_code(p_class uuid, p_expires_in_days int default null) returns text
language plpgsql security definer set search_path = public as $$
declare c text := public._new_code(8);
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  if p_expires_in_days is not null and p_expires_in_days not between 1 and 365 then
    raise exception 'expiry must be 1 to 365 days' using errcode = '22023';
  end if;
  update public.classes set join_code = c,
    join_code_expires_at = case when p_expires_in_days is null then null else now() + make_interval(days => p_expires_in_days) end
  where id = p_class;
  perform public._audit('class.rotate_code', p_class::text, jsonb_build_object('expires_in_days', p_expires_in_days));
  return c;
end $$;

-- Turn joining off (expire now) without changing the code.
create or replace function public.close_joining(p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  update public.classes set join_code_expires_at = now() where id = p_class;
  perform public._audit('class.close_joining', p_class::text, '{}'::jsonb);
end $$;

create or replace function public.set_class_archived(p_class uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  update public.classes set archived_at = case when p_archived then coalesce(archived_at, now()) else null end where id = p_class;
  perform public._audit('class.archive', p_class::text, jsonb_build_object('archived', p_archived));
end $$;

-- Next term: same name (or a new one), same organization, the assignments copied as DRAFTS without dates.
create or replace function public.duplicate_class(p_class uuid, p_name text, p_term text default '', p_copy_assignments boolean default true)
returns uuid
language plpgsql security definer set search_path = public as $$
declare src public.classes; v_id uuid;
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  if not public.check_rate('create_class', 30, 3600) then raise exception 'rate limited' using errcode = 'P0001'; end if;
  select * into src from public.classes where id = p_class;
  insert into public.classes (teacher_id, name, term, org_id, join_code)
  values (auth.uid(), btrim(p_name), coalesce(btrim(p_term), ''), src.org_id, public._new_code(8)) returning id into v_id;
  if p_copy_assignments then
    insert into public.assignments (class_id, page_id, title, description, items, status, late_policy, weight, max_submissions, show_results)
    select v_id, page_id, title, description, items, 'draft', late_policy, weight, max_submissions, show_results
    from public.assignments where class_id = p_class;
  end if;
  perform public._audit('class.duplicate', v_id::text, jsonb_build_object('from', p_class));
  return v_id;
end $$;

-- p_role null removes the person. The target must be a teacher in the class's organization; the owner is fixed.
create or replace function public.class_set_teacher(p_class uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  if not public.owns_class(p_class) then raise exception 'only the class owner or an organization admin can do that' using errcode = '42501'; end if;
  select * into c from public.classes where id = p_class;
  if p_user = c.teacher_id then raise exception 'the owner cannot be changed here' using errcode = '22023'; end if;
  if p_role is null then
    delete from public.class_teachers where class_id = p_class and user_id = p_user;
  else
    if p_role not in ('teacher', 'ta') then raise exception 'bad role' using errcode = '22023'; end if;
    if c.org_id is null or not exists (select 1 from public.org_members where org_id = c.org_id and user_id = p_user) then
      raise exception 'that person is not in this class''s organization' using errcode = '22023';
    end if;
    insert into public.class_teachers (class_id, user_id, role) values (p_class, p_user, p_role)
      on conflict (class_id, user_id) do update set role = excluded.role;
  end if;
  perform public._audit('class.staff', p_class::text, jsonb_build_object('user', p_user, 'role', p_role));
end $$;

create or replace function public.class_staff(p_class uuid) returns table (user_id uuid, full_name text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.views_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  return query
  select c.teacher_id, p.full_name, 'owner'::text from public.classes c join public.profiles p on p.id = c.teacher_id where c.id = p_class
  union all
  select t.user_id, p.full_name, t.role from public.class_teachers t join public.profiles p on p.id = t.user_id where t.class_id = p_class;
end $$;

-- join_class: archived classes and expired codes behave like an unknown code; organization seat limit enforced.
create or replace function public.join_class(p_code text) returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare c public.classes; o public.organizations; v_used int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.check_rate('join_class', 10, 60) then
    raise exception 'rate limited' using errcode = 'P0001';
  end if;
  select * into c from public.classes where join_code = upper(btrim(p_code))
    and archived_at is null and (join_code_expires_at is null or join_code_expires_at > now());
  if not found then return; end if;
  if c.org_id is not null and not exists (select 1 from public.enrollments where class_id = c.id and student_id = auth.uid()) then
    select * into o from public.organizations where organizations.id = c.org_id;
    if o.seat_limit is not null
       and not exists (select 1 from public.enrollments e join public.classes c2 on c2.id = e.class_id
                       where c2.org_id = c.org_id and e.student_id = auth.uid()) then
      select count(distinct e.student_id) into v_used from public.enrollments e join public.classes c2 on c2.id = e.class_id where c2.org_id = c.org_id;
      if v_used >= o.seat_limit then
        -- (raising rolls back this attempt's rate-limit count; acceptable here because the code was already valid)
        raise exception 'no seats left' using errcode = 'P0001', hint = 'no_seats';
      end if;
    end if;
  end if;
  insert into public.enrollments (class_id, student_id) values (c.id, auth.uid()) on conflict do nothing;
  return query select c.id, c.name;
end $$;

------------------------------------------------------------------------------
-- scoring and submission
------------------------------------------------------------------------------
create or replace function public._items_max(p_items jsonb) returns numeric
language sql immutable set search_path = public as $$
  select coalesce(sum((i ->> 'points')::numeric), 0) from jsonb_array_elements(p_items) i;
$$;

-- Score a snapshot against an item list. pred/quiz: right = full points. ex: pass = full points; not passed but some
-- tests passing = partial (points * passed / total); an exercise passed after the solution was revealed earns 0.
-- Returns {"score","max","items":[{key,points,earned,state,hints,attempts,pastes}]} with state correct|partial|wrong|blank.
create or replace function public._score_items(p_items jsonb, p_snap jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare it jsonb; d jsonb; k text; pts numeric; earned numeric; st text; tot numeric := 0; mx numeric := 0; out jsonb := '[]'::jsonb;
        pa numeric; tt numeric;
begin
  for it in select value from jsonb_array_elements(p_items) loop
    k := it ->> 'key'; pts := (it ->> 'points')::numeric; d := p_snap -> k; earned := 0; st := 'blank';
    mx := mx + pts;
    if d is not null then
      if k like 'ex:%' then
        if (d ->> 'sol') = 'true' then earned := 0; st := 'wrong';
        elsif (d ->> 'pass') = 'true' then earned := pts; st := 'correct';
        else
          pa := case when jsonb_typeof(d #> '{last,passed}') = 'number' then (d #>> '{last,passed}')::numeric end;
          tt := case when jsonb_typeof(d #> '{last,total}') = 'number' then (d #>> '{last,total}')::numeric end;
          if tt is not null and tt > 0 and pa is not null and pa > 0 then
            earned := round(pts * least(pa, tt) / tt, 2); st := 'partial';
          else st := 'wrong'; end if;
        end if;
      else
        if (d ->> 'right') = 'true' then earned := pts; st := 'correct'; else st := 'wrong'; end if;
      end if;
    end if;
    tot := tot + earned;
    out := out || jsonb_build_array(jsonb_build_object('key', k, 'points', pts, 'earned', earned, 'state', st,
      'hints', coalesce(d -> 'hints', '0'::jsonb), 'attempts', coalesce(d -> 'attempts', d -> 'tries', '0'::jsonb),
      'pastes', coalesce(d -> 'pastes', '0'::jsonb)));
  end loop;
  return jsonb_build_object('score', tot, 'max', mx, 'items', out);
end $$;

-- The student's deadline for an assignment (their extension if they have one).
create or replace function public._effective_due(p_assignment uuid, p_student uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select e.due_at from public.extensions e where e.assignment_id = p_assignment and e.student_id = p_student),
                  (select a.due_at from public.assignments a where a.id = p_assignment));
$$;

create or replace function public._clean_signals(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare k text; out jsonb := '{}'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return out; end if;
  foreach k in array array['secs', 'pastes', 'paste_chars', 'blurs'] loop
    if jsonb_typeof(p -> k) = 'number' and (p ->> k)::numeric >= 0 then
      out := out || jsonb_build_object(k, least((p ->> k)::numeric, 10000000));
    end if;
  end loop;
  return out;
end $$;

create or replace function public.submit_assignment(p_assignment uuid, p_signals jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a public.assignments; c public.classes;
  v_due timestamptz; v_close timestamptz; v_n int; v_late int := 0; v_pen numeric := 0;
  v_snap jsonb; v_sc jsonb; v_raw numeric; v_score numeric; v_id uuid; lp jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.check_rate('submit', 40, 60) then raise exception 'rate limited' using errcode = 'P0001'; end if;
  select * into a from public.assignments where id = p_assignment;
  if not found or not public.in_class(a.class_id) or a.status <> 'published'
     or (a.release_at is not null and a.release_at > now()) then
    raise exception 'no such assignment' using errcode = 'P0002';
  end if;
  select * into c from public.classes where id = a.class_id;
  if c.archived_at is not null then raise exception 'this class is archived' using errcode = '42501'; end if;
  select coalesce(max(n), 0) + 1 into v_n from public.submissions where assignment_id = a.id and student_id = uid;
  if v_n > a.max_submissions then raise exception 'no submissions left' using errcode = '23514'; end if;

  v_due := public._effective_due(a.id, uid);
  v_close := case when a.close_at is null then null else greatest(a.close_at, coalesce(v_due, a.close_at)) end;
  lp := a.late_policy;
  if v_due is not null and now() > v_due then
    if lp ->> 'mode' = 'reject' then raise exception 'the due date has passed' using errcode = '23514'; end if;
    v_late := ceil(extract(epoch from now() - v_due))::int;
    if lp ->> 'mode' = 'penalty' then
      v_pen := least(coalesce((lp ->> 'max')::numeric, 100), coalesce((lp ->> 'per_day')::numeric, 0) * ceil(v_late / 86400.0));
    end if;
  end if;
  if v_close is not null and now() > v_close then raise exception 'submissions are closed' using errcode = '23514'; end if;

  select coalesce(jsonb_object_agg(p.key, p.data - 'hist'), '{}'::jsonb) into v_snap
  from public.progress p where p.user_id = uid and p.key in (select i ->> 'key' from jsonb_array_elements(a.items) i);
  v_sc := public._score_items(a.items, v_snap);
  v_raw := (v_sc ->> 'score')::numeric;
  v_score := round(v_raw * (1 - v_pen / 100), 2);
  insert into public.submissions (assignment_id, student_id, n, late_seconds, penalty_pct, raw_score, score, max_score, detail, snapshot, signals)
  values (a.id, uid, v_n, v_late, v_pen, v_raw, v_score, (v_sc ->> 'max')::numeric, v_sc -> 'items', v_snap, public._clean_signals(p_signals))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'n', v_n, 'late_seconds', v_late, 'penalty_pct', v_pen,
    'score', case when a.show_results = 'on_submit' then v_score end,
    'max', case when a.show_results = 'on_submit' then (v_sc ->> 'max')::numeric end);
end $$;

------------------------------------------------------------------------------
-- grading
------------------------------------------------------------------------------
create or replace function public._final_score(p_assignment uuid, p_student uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select g.override_score from public.grades g where g.assignment_id = p_assignment and g.student_id = p_student),
    (select s.score from public.submissions s where s.assignment_id = p_assignment and s.student_id = p_student order by s.n desc limit 1));
$$;

-- p_score null clears the override (back to the automatic score). A reason of at least 3 characters is required when
-- setting a score. Every change is written to grade_history and the audit log.
create or replace function public.set_grade(p_assignment uuid, p_student uuid, p_score numeric, p_comment text, p_reason text default '')
returns void
language plpgsql security definer set search_path = public as $$
declare v_class uuid := public.assignment_class(p_assignment); v_old numeric; v_max numeric; v_prev numeric;
begin
  if v_class is null or not public.teaches_class(v_class) then raise exception 'not your class' using errcode = '42501'; end if;
  if not exists (select 1 from public.enrollments where class_id = v_class and student_id = p_student) then
    raise exception 'not in this class' using errcode = 'P0002';
  end if;
  select public._items_max(items) into v_max from public.assignments where id = p_assignment;
  if p_score is not null then
    if p_score < 0 or p_score > v_max * 2 then raise exception 'score out of range' using errcode = '22003'; end if;
    if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'a reason is required' using errcode = '22023'; end if;
  end if;
  if char_length(coalesce(p_comment, '')) > 2000 then raise exception 'comment too long' using errcode = '22023'; end if;
  v_old := public._final_score(p_assignment, p_student);
  select g.override_score into v_prev from public.grades g where g.assignment_id = p_assignment and g.student_id = p_student;
  insert into public.grades (assignment_id, student_id, override_score, comment, updated_by, updated_at)
  values (p_assignment, p_student, p_score, coalesce(p_comment, ''), auth.uid(), now())
  on conflict (assignment_id, student_id) do update set override_score = excluded.override_score,
    comment = excluded.comment, updated_by = excluded.updated_by, updated_at = now();
  if p_score is distinct from v_prev then
    insert into public.grade_history (assignment_id, student_id, actor, old_score, new_score, reason)
    values (p_assignment, p_student, auth.uid(), v_old, public._final_score(p_assignment, p_student),
            case when p_score is null then 'override cleared' else btrim(p_reason) end);
  end if;
  perform public._audit('grade.override', p_assignment::text, jsonb_build_object('student', p_student, 'score', p_score));
end $$;

-- Make results visible to students (or hide them again). p_students null = everyone enrolled who has a submission or grade.
create or replace function public.return_grades(p_assignment uuid, p_students uuid[] default null, p_return boolean default true)
returns int
language plpgsql security definer set search_path = public as $$
declare v_class uuid := public.assignment_class(p_assignment); s uuid; n int := 0; v_title text;
begin
  if v_class is null or not public.teaches_class(v_class) then raise exception 'not your class' using errcode = '42501'; end if;
  select title into v_title from public.assignments where id = p_assignment;
  for s in select e.student_id from public.enrollments e where e.class_id = v_class
           and (p_students is null or e.student_id = any (p_students))
           and (exists (select 1 from public.submissions x where x.assignment_id = p_assignment and x.student_id = e.student_id)
                or exists (select 1 from public.grades g where g.assignment_id = p_assignment and g.student_id = e.student_id)) loop
    insert into public.grades (assignment_id, student_id, returned_at, updated_by)
    values (p_assignment, s, case when p_return then now() end, auth.uid())
    on conflict (assignment_id, student_id) do update set returned_at = case when p_return then coalesce(public.grades.returned_at, now()) end,
      updated_by = auth.uid(), updated_at = now();
    if p_return then perform public._notify(s, 'grade', v_title, '', '/classes/' || v_class::text); end if;
    n := n + 1;
  end loop;
  perform public._audit('grade.return', p_assignment::text, jsonb_build_object('count', n, 'returned', p_return));
  return n;
end $$;

create or replace function public.add_comment(p_assignment uuid, p_student uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_class uuid := public.assignment_class(p_assignment); v_id bigint; v_title text; t uuid; v_owner uuid;
begin
  if v_class is null then raise exception 'no such assignment' using errcode = 'P0002'; end if;
  if not public.check_rate('comment', 60, 60) then raise exception 'rate limited' using errcode = 'P0001'; end if;
  select title into v_title from public.assignments where id = p_assignment;
  if public.teaches_class(v_class) then
    if not exists (select 1 from public.enrollments where class_id = v_class and student_id = p_student) then
      raise exception 'not in this class' using errcode = 'P0002';
    end if;
    insert into public.comments (assignment_id, student_id, author_id, body) values (p_assignment, p_student, auth.uid(), p_body) returning id into v_id;
    perform public._notify(p_student, 'comment', v_title, left(p_body, 200), '/classes/' || v_class::text);
  elsif p_student = auth.uid() and public.in_class(v_class) then
    insert into public.comments (assignment_id, student_id, author_id, body) values (p_assignment, p_student, auth.uid(), p_body) returning id into v_id;
    select teacher_id into v_owner from public.classes where id = v_class;
    perform public._notify(v_owner, 'comment', v_title, left(p_body, 200), '/teach/' || v_class::text);
    for t in select user_id from public.class_teachers where class_id = v_class loop
      perform public._notify(t, 'comment', v_title, left(p_body, 200), '/teach/' || v_class::text);
    end loop;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return v_id;
end $$;

------------------------------------------------------------------------------
-- reading results
------------------------------------------------------------------------------
-- Teacher: every enrolled student x every published assignment of the class, with the latest submission and grade.
create or replace function public.class_gradebook(p_class uuid)
returns table (student_id uuid, assignment_id uuid, submitted_at timestamptz, submissions int, late_seconds int,
               penalty_pct numeric, auto_score numeric, max_score numeric, override_score numeric, final_score numeric,
               source text, returned boolean, comment text, due_at timestamptz, signals jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  return query
  select e.student_id, a.id, s.submitted_at, coalesce(cnt.n, 0)::int, coalesce(s.late_seconds, 0), coalesce(s.penalty_pct, 0),
         s.score, public._items_max(a.items), g.override_score,
         coalesce(g.override_score, s.score),
         case when g.override_score is not null then 'override' when s.id is not null then 'auto' else 'missing' end,
         g.returned_at is not null, coalesce(g.comment, ''), public._effective_due(a.id, e.student_id), coalesce(s.signals, '{}'::jsonb)
  from public.enrollments e
  join public.assignments a on a.class_id = e.class_id and a.status = 'published'
  left join lateral (select x.* from public.submissions x where x.assignment_id = a.id and x.student_id = e.student_id order by x.n desc limit 1) s on true
  left join lateral (select count(*) as n from public.submissions x where x.assignment_id = a.id and x.student_id = e.student_id) cnt on true
  left join public.grades g on g.assignment_id = a.id and g.student_id = e.student_id
  where e.class_id = p_class;
end $$;

-- Weighted overall percentage per student. An assignment counts once it is past its (effective) due date, or the student
-- has a submission or a manual score. A missing submission counts as 0 after the due date.
create or replace function public.class_overall(p_class uuid) returns table (student_id uuid, pct numeric, counted int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  return query
  select e.student_id,
         case when sum(a.weight) filter (where cnt.ok) > 0
              then round(100 * sum(a.weight * (case when public._items_max(a.items) > 0 then coalesce(public._final_score(a.id, e.student_id), 0) / public._items_max(a.items) else 0 end)) filter (where cnt.ok)
                         / sum(a.weight) filter (where cnt.ok), 1) end,
         (count(*) filter (where cnt.ok))::int
  from public.enrollments e
  join public.assignments a on a.class_id = e.class_id and a.status = 'published' and (a.release_at is null or a.release_at <= now())
  cross join lateral (select (public._final_score(a.id, e.student_id) is not null
                              or coalesce(public._effective_due(a.id, e.student_id), 'infinity'::timestamptz) < now()) as ok) cnt
  where e.class_id = p_class group by e.student_id;
end $$;

-- All submissions of one student for one assignment, with the frozen snapshot (teacher review screen).
create or replace function public.get_submissions(p_assignment uuid, p_student uuid)
returns table (n int, submitted_at timestamptz, late_seconds int, penalty_pct numeric, raw_score numeric, score numeric,
               max_score numeric, detail jsonb, snapshot jsonb, signals jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.teaches_class(public.assignment_class(p_assignment)) then raise exception 'not your class' using errcode = '42501'; end if;
  return query select x.n, x.submitted_at, x.late_seconds, x.penalty_pct, x.raw_score, x.score, x.max_score, x.detail, x.snapshot, x.signals
    from public.submissions x where x.assignment_id = p_assignment and x.student_id = p_student order by x.n;
end $$;

create or replace function public.get_grade_history(p_assignment uuid, p_student uuid)
returns table (at timestamptz, actor_name text, old_score numeric, new_score numeric, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.teaches_class(public.assignment_class(p_assignment)) then raise exception 'not your class' using errcode = '42501'; end if;
  return query select h.at, p.full_name, h.old_score, h.new_score, h.reason
    from public.grade_history h left join public.profiles p on p.id = h.actor
    where h.assignment_id = p_assignment and h.student_id = p_student order by h.id;
end $$;

-- Student: my assignments in every class I am in. Scores appear only after they are returned (or on submit, if the
-- teacher chose that); the per-item breakdown comes with them.
create or replace function public.my_results(p_class uuid default null)
returns table (assignment_id uuid, class_id uuid, title text, description text, page_id text, items jsonb, due_at timestamptz,
               release_at timestamptz, late_policy jsonb, max_submissions int, submissions int, submitted_at timestamptz,
               late_seconds int, penalty_pct numeric, visible boolean, score numeric, max_score numeric, detail jsonb,
               comment text, returned_at timestamptz, archived boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return query
  select a.id, a.class_id, a.title, a.description, a.page_id, a.items, public._effective_due(a.id, auth.uid()), a.release_at,
         a.late_policy, a.max_submissions, coalesce(cnt.n, 0)::int, s.submitted_at, s.late_seconds, s.penalty_pct,
         vis.v,
         case when vis.v then coalesce(g.override_score, s.score) end,
         public._items_max(a.items),
         case when vis.v then s.detail end,
         case when vis.v or g.returned_at is not null then coalesce(g.comment, '') else '' end,
         g.returned_at, c.archived_at is not null
  from public.assignments a
  join public.classes c on c.id = a.class_id
  join public.enrollments e on e.class_id = a.class_id and e.student_id = auth.uid()
  left join lateral (select x.* from public.submissions x where x.assignment_id = a.id and x.student_id = auth.uid() order by x.n desc limit 1) s on true
  left join lateral (select count(*) as n from public.submissions x where x.assignment_id = a.id and x.student_id = auth.uid()) cnt on true
  left join public.grades g on g.assignment_id = a.id and g.student_id = auth.uid()
  cross join lateral (select (g.returned_at is not null or (a.show_results = 'on_submit' and s.id is not null)) as v) vis
  where a.status = 'published' and (a.release_at is null or a.release_at <= now())
    and (p_class is null or a.class_id = p_class)
  order by a.due_at nulls last, a.created_at;
end $$;

------------------------------------------------------------------------------
-- analytics: item-level rows of a class (code removed), read by teachers
------------------------------------------------------------------------------
create or replace function public.class_item_rows(p_class uuid)
returns table (student_id uuid, key text, data jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  return query
  select p.user_id, p.key, p.data - 'code', p.updated_at
  from public.progress p join public.enrollments e on e.student_id = p.user_id and e.class_id = p_class
  where p.key ~ '^(pred|quiz|ex):[0-9]+:' or p.key ~ '^read:[0-9]+$';
end $$;

-- Teachers read the join code through this function, so students (who can read their classes) never see it.
create or replace function public.class_join_info(p_class uuid) returns table (join_code text, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.teaches_class(p_class) then raise exception 'not your class' using errcode = '42501'; end if;
  return query select c.join_code, c.join_code_expires_at from public.classes c where c.id = p_class;
end $$;

------------------------------------------------------------------------------
-- privacy: export covers the new tables (rows about or by the caller)
------------------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email) from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'progress', coalesce((select jsonb_agg(to_jsonb(x) order by x.key) from public.progress x where x.user_id = uid), '[]'::jsonb),
    'enrollments', coalesce((select jsonb_agg(to_jsonb(x)) from public.enrollments x where x.student_id = uid), '[]'::jsonb),
    -- Classes you teach and their assignments. Other people's rows (rosters) are not part of your export.
    'classes', coalesce((select jsonb_agg(to_jsonb(x)) from public.classes x where x.teacher_id = uid), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(to_jsonb(a)) from public.assignments a
                             join public.classes c on c.id = a.class_id where c.teacher_id = uid), '[]'::jsonb),
    'organizations', coalesce((select jsonb_agg(to_jsonb(o)) from public.organizations o where o.id in
                               (select m.org_id from public.org_members m where m.user_id = uid)), '[]'::jsonb),
    'org_members', coalesce((select jsonb_agg(to_jsonb(x)) from public.org_members x where x.user_id = uid), '[]'::jsonb),
    'class_teachers', coalesce((select jsonb_agg(to_jsonb(x)) from public.class_teachers x where x.user_id = uid), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(to_jsonb(x) order by x.submitted_at) from public.submissions x where x.student_id = uid), '[]'::jsonb),
    'grades', coalesce((select jsonb_agg(to_jsonb(x)) from public.grades x where x.student_id = uid), '[]'::jsonb),
    'grade_history', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.grade_history x where x.student_id = uid), '[]'::jsonb),
    'extensions', coalesce((select jsonb_agg(to_jsonb(x)) from public.extensions x where x.student_id = uid), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.comments x where x.student_id = uid or x.author_id = uid), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.announcements x where x.author_id = uid), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.notifications x where x.user_id = uid), '[]'::jsonb),
    'analytics_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.analytics_events x where x.user_id = uid), '[]'::jsonb),
    'audit_log', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.audit_log x where x.actor = uid), '[]'::jsonb),
    'rate_limits', coalesce((select jsonb_agg(to_jsonb(x)) from public.rate_limits x where x.user_id = uid), '[]'::jsonb)
  );
end $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

------------------------------------------------------------------------------
-- grants
------------------------------------------------------------------------------
revoke all on public.organizations, public.org_members, public.class_teachers, public.notifications, public.announcements,
  public.comments, public.extensions, public.submissions, public.grades, public.grade_history
  from public, anon, authenticated;

grant select (id, name, seat_limit, created_by, created_at) on public.organizations to authenticated;   -- not invite_code
grant select on public.org_members, public.class_teachers to authenticated;
-- classes: the join code is not readable by students; teachers get it from class_join_info().
revoke select on public.classes from authenticated;
grant select (id, teacher_id, name, term, org_id, archived_at, join_code_expires_at, created_at) on public.classes to authenticated;
grant update (name, seat_limit) on public.organizations to authenticated;
grant select, update (read_at), delete on public.notifications to authenticated;
grant select, insert (class_id, author_id, title, body, pinned), update (title, body, pinned), delete on public.announcements to authenticated;
grant select on public.comments to authenticated;
grant select, insert, update, delete on public.extensions to authenticated;
-- submissions, grades, grade_history: no grants (functions only)

-- classes: created and rotated through functions; teachers may rename.
revoke insert, update on public.classes from authenticated;
grant update (name, term) on public.classes to authenticated;
-- assignments: columns teachers may write (class_id and id are fixed once created).
revoke insert, update on public.assignments from authenticated;
grant insert (class_id, page_id, title, description, items, status, release_at, due_at, close_at, late_policy, weight, max_submissions, show_results)
  on public.assignments to authenticated;
grant update (page_id, title, description, items, status, release_at, due_at, close_at, late_policy, weight, max_submissions, show_results)
  on public.assignments to authenticated;

revoke execute on function
  public.is_org_admin(uuid), public.in_org(uuid), public.owns_class(uuid), public.views_class(uuid), public.assignment_class(uuid),
  public.create_org(text), public.org_join(text), public.rotate_org_invite(uuid), public.org_invite_code(uuid),
  public.org_members_list(uuid), public.org_set_member(uuid, uuid, text), public.org_leave(uuid), public.org_summary(uuid),
  public.org_report(uuid), public.create_class(text, text, uuid), public.rotate_join_code(uuid, int), public.close_joining(uuid),
  public.set_class_archived(uuid, boolean), public.duplicate_class(uuid, text, text, boolean),
  public.class_set_teacher(uuid, uuid, text), public.class_staff(uuid), public.submit_assignment(uuid, jsonb),
  public.set_grade(uuid, uuid, numeric, text, text), public.return_grades(uuid, uuid[], boolean),
  public.add_comment(uuid, uuid, text), public.class_gradebook(uuid), public.class_overall(uuid),
  public.get_submissions(uuid, uuid), public.get_grade_history(uuid, uuid), public.my_results(uuid), public.class_item_rows(uuid),
  public.class_join_info(uuid),
  public._new_code(int), public._notify(uuid, text, text, text, text), public._items_max(jsonb), public._score_items(jsonb, jsonb),
  public._effective_due(uuid, uuid), public._clean_signals(jsonb), public._final_score(uuid, uuid),
  public.assignments_check(), public.assignments_after(), public.announcements_after(), public.extensions_after(),
  public.grade_history_immutable()
  from public, anon, authenticated;

-- callable by signed-in users (also used inside policies)
grant execute on function
  public.is_org_admin(uuid), public.in_org(uuid), public.owns_class(uuid), public.views_class(uuid), public.assignment_class(uuid),
  public.create_org(text), public.org_join(text), public.rotate_org_invite(uuid), public.org_invite_code(uuid),
  public.org_members_list(uuid), public.org_set_member(uuid, uuid, text), public.org_leave(uuid), public.org_summary(uuid),
  public.org_report(uuid), public.create_class(text, text, uuid), public.rotate_join_code(uuid, int), public.close_joining(uuid),
  public.set_class_archived(uuid, boolean), public.duplicate_class(uuid, text, text, boolean),
  public.class_set_teacher(uuid, uuid, text), public.class_staff(uuid), public.submit_assignment(uuid, jsonb),
  public.set_grade(uuid, uuid, numeric, text, text), public.return_grades(uuid, uuid[], boolean),
  public.add_comment(uuid, uuid, text), public.class_gradebook(uuid), public.class_overall(uuid),
  public.get_submissions(uuid, uuid), public.get_grade_history(uuid, uuid), public.my_results(uuid), public.class_item_rows(uuid),
  public.class_join_info(uuid)
  to authenticated;
-- the triggers and internal helpers (_new_code, _notify, _score_items, ...) are run by the trigger / definer functions
-- (owner privileges); the API cannot call them. Re-assert the join_class grant after redefinition.
grant execute on function public.join_class(text) to authenticated;
revoke execute on function public.join_class(text) from public, anon;
