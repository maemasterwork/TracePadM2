-- Removes everything demo_seed.sql created. Run as a superuser.
begin;
delete from public.organizations where name = 'Tracepad Demo School';
delete from public.classes where name = 'Python 101 (demo)' and teacher_id in (select id from auth.users where email = 'demo-teacher@demo.invalid');
delete from auth.users where email like 'demo-%@demo.invalid';
commit;
