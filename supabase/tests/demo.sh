#!/bin/bash
# Loads supabase/demo/demo_seed.sql into the scratch database and checks what the teacher dashboards would be fed. Do not run directly.
export PGHOST PGPORT PGUSER PGDATABASE
HERE=$(cd "$(dirname "$0")" && pwd); SUPA=$(dirname "$HERE")
pass=0; failn=0
q() { psql -X -At -v ON_ERROR_STOP=1 -c "$1" 2>&1; }
expect() { if [ "$3" == "$2" ]; then pass=$((pass+1)); echo "ok   $1"; else failn=$((failn+1)); echo "FAIL $1: want [$2] got [$3]"; fi; }
echo "=== demo seed ==="
psql -X -q -v ON_ERROR_STOP=1 -f "$SUPA/demo/demo_seed.sql" >/dev/null 2>&1; expect "demo seed loads" 0 $?
expect "30 simulated students enrolled in one class" "30|1" "$(q "select count(*), count(distinct class_id) from enrollments")"
expect "one teacher, one organization" "1|1" "$(q "select (select count(*) from profiles where role='teacher'), (select count(*) from organizations)")"
expect "demo users get no password (seed never sets one, so nobody can sign in as them)" "0" "$(grep -c -i "encrypted_password" "$SUPA/demo/demo_seed.sql")"
expect "three published assignments" "3" "$(q "select count(*) from assignments where status='published'")"
expect "most students submitted something, not all" "t" "$(q "select count(distinct student_id) between 20 and 29 from submissions")"
expect "scores are between 0 and the maximum and came from the real scorer (snapshots exist)" "0" "$(q "select count(*) from submissions where score < 0 or score > max_score or snapshot = '{}'::jsonb")"
expect "some late work, some hand-set grades with a history" "t|t" "$(q "select (select count(*) from submissions where late_seconds > 0) > 0, (select count(*) from grade_history) > 0")"
expect "the open assignment is not returned" "0" "$(q "select count(*) from grades g join assignments a on a.id=g.assignment_id where a.title like 'Lists%'")"
expect "hand-set scores are recorded in the history" "$(q "select count(*) from grades where override_score is not null")" "$(q "select count(*) from grade_history")"
expect "progress rows exist for every kind of item" "3" "$(q "select count(distinct split_part(key, ':', 1)) from progress where key ~ '^(pred|quiz|ex):'")"
expect "histories end in the past (nothing from the future)" "0" "$(q "select count(*) from progress where client_ts > (extract(epoch from now())*1000)::bigint")"
psql -X -q -v ON_ERROR_STOP=1 -f "$SUPA/demo/remove.sql" >/dev/null 2>&1
expect "remove.sql leaves nothing behind" "0|0|0|0" "$(q "select (select count(*) from auth.users), (select count(*) from progress), (select count(*) from classes), (select count(*) from organizations)")"
echo; echo "demo: $pass passed, $failn failed"; [ $failn -eq 0 ]
