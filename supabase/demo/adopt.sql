-- Look around the demo as a teacher: makes YOUR account (sign up first) an administrator of the demo school and a
-- co-teacher of the demo class.   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email=you@example.com -f supabase/demo/adopt.sql
begin;
update public.profiles set role = 'teacher' where id = (select id from auth.users where email = :'email');
insert into public.org_members (org_id, user_id, role)
  select o.id, u.id, 'admin' from public.organizations o, auth.users u where o.name = 'Tracepad Demo School' and u.email = :'email'
  on conflict (org_id, user_id) do update set role = 'admin';
insert into public.class_teachers (class_id, user_id, role)
  select c.id, u.id, 'teacher' from public.classes c, auth.users u where c.name = 'Python 101 (demo)' and u.email = :'email'
  on conflict (class_id, user_id) do nothing;
commit;
