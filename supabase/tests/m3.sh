# Milestone 3 checks. Sourced by checks.sh (uses its helpers: q, as, anon, expect, contains, denied, rlsdeny).
echo "=== (M3) organizations, classes, assignments, grading ==="
MT1=cccccccc-cccc-cccc-cccc-ccccccccccc1; MT2=cccccccc-cccc-cccc-cccc-ccccccccccc2; MT3=cccccccc-cccc-cccc-cccc-ccccccccccc3
MS1=eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1; MS2=eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2; MS3=eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3
for u in $MT1 $MT2 $MT3 $MS1 $MS2 $MS3; do q "insert into auth.users(id,email,raw_user_meta_data) values ('$u','$u@x','{\"full_name\":\"M3 $u\"}')" >/dev/null; done
for u in $MT1 $MT2 $MT3; do q "update profiles set role='teacher' where id='$u'" >/dev/null; done

# --- organizations
contains "student cannot create an org" "teachers only" "$(as $MS1 "select create_org('X')")"
ORG=$(as $MT1 "select create_org('Test School')" | head -1)
expect "teacher creates an org" "36" "${#ORG}"
expect "creator is admin" "admin" "$(as $MT1 "select role from org_members where org_id='$ORG'")"
ICODE=$(as $MT1 "select org_invite_code('$ORG')" | head -1)
expect "invite code has 10 characters" "10" "${#ICODE}"
contains "non-member cannot read the invite code" "not an organization admin" "$(as $MT2 "select org_invite_code('$ORG')")"
expect "wrong invite code returns nothing" "0" "$(as $MT2 "select count(*) from org_join('NOPE')")"
contains "student cannot join an org" "teachers only" "$(as $MS1 "select * from org_join('$ICODE')")"
expect "teacher joins with the code" "Test School" "$(as $MT2 "select name from org_join(lower('$ICODE'))" | head -1)"
denied "members cannot read the invite code column" "$(as $MT2 "select invite_code from organizations")"
expect "member sees the org" "1" "$(as $MT2 "select count(*) from organizations")"
expect "outsider sees no org" "0" "$(as $MT3 "select count(*) from organizations")"
expect "member lists colleagues" "2" "$(as $MT2 "select count(*) from org_members_list('$ORG')")"
contains "outsider cannot list members" "not a member" "$(as $MT3 "select * from org_members_list('$ORG')")"
expect "member sees only own membership row" "1" "$(as $MT2 "select count(*) from org_members")"
contains "non-admin cannot change members" "not an organization admin" "$(as $MT2 "select org_set_member('$ORG','$MT2','admin')")"
contains "last admin cannot be demoted" "at least one admin" "$(as $MT1 "select org_set_member('$ORG','$MT1','teacher')")"
contains "last admin cannot leave" "at least one admin" "$(as $MT1 "select org_leave('$ORG')")"
expect "non-admin cannot rename org" "UPDATE 0" "$(as $MT2 "update organizations set name='Hacked' where id='$ORG'")"
denied "nobody can change invite_code directly" "$(as $MT1 "update organizations set invite_code='AAAAAAAAAA' where id='$ORG'")"
NEWCODE=$(as $MT1 "select rotate_org_invite('$ORG')" | head -1)
expect "rotating the invite code changes it" "1" "$([ "$NEWCODE" != "$ICODE" ] && echo 1 || echo 0)"
expect "old invite code no longer works" "0" "$(as $MT3 "select count(*) from org_join('$ICODE')")"

# --- classes
contains "cannot create a class in an org you are not in" "not a member of that organization" "$(as $MT3 "select create_class('Z','',  '$ORG')")"
CL3=$(as $MT1 "select create_class('Algorithms','2026 fall','$ORG')" | head -1)
expect "class created in the org" "$ORG|2026 fall" "$(q "select org_id || '|' || term from classes where id='$CL3'")"
expect "join code has 8 characters" "8" "$(q "select length(join_code) from classes where id='$CL3'")"
expect "outsider teacher cannot see the class" "0" "$(as $MT3 "select count(*) from classes where id='$CL3'")"
expect "org member (not on the class) cannot see it" "0" "$(as $MT2 "select count(*) from classes where id='$CL3'")"
contains "outsider cannot add staff" "only the class owner" "$(as $MT3 "select class_set_teacher('$CL3','$MT3','ta')")"
contains "staff must be in the org" "not in this class's organization" "$(as $MT1 "select class_set_teacher('$CL3','$MT3','ta')")"
as $MT1 "select class_set_teacher('$CL3','$MT2','ta')" >/dev/null
expect "TA sees the class" "1" "$(as $MT2 "select count(*) from classes where id='$CL3'")"
expect "TA cannot delete the class" "DELETE 0" "$(as $MT2 "delete from classes where id='$CL3'")"
expect "TA can rename the class" "UPDATE 1" "$(as $MT2 "update classes set name='Algorithms A' where id='$CL3'")"
denied "nobody can change a class owner" "$(as $MT2 "update classes set teacher_id='$MT2' where id='$CL3'")"
denied "nobody can set a join code directly" "$(as $MT2 "update classes set join_code='HACKED' where id='$CL3'")"
contains "TA cannot add staff" "only the class owner" "$(as $MT2 "select class_set_teacher('$CL3','$MT2','teacher')")"
expect "class staff lists owner and TA" "2" "$(as $MT2 "select count(*) from class_staff('$CL3')")"
denied "students cannot read join codes" "$(as $MS1 "select join_code from classes")"
CODE3=$(q "select join_code from classes where id='$CL3'")
expect "teacher reads the code through class_join_info" "$CODE3" "$(as $MT1 "select join_code from class_join_info('$CL3')")"
contains "student cannot call class_join_info" "not your class" "$(as $MS1 "select * from class_join_info('$CL3')")"
expect "student joins" "Algorithms A" "$(as $MS1 "select name from join_class('$CODE3')" | head -1)"
expect "TA sees the student's profile" "1" "$(as $MT2 "select count(*) from profiles where id='$MS1'")"
expect "unrelated teacher does not" "0" "$(as $MT3 "select count(*) from profiles where id='$MS1'")"
NC=$(as $MT1 "select rotate_join_code('$CL3')" | head -1)
expect "rotated code differs" "1" "$([ "$NC" != "$CODE3" ] && echo 1 || echo 0)"
expect "old code is dead" "0" "$(as $MS2 "select count(*) from join_class('$CODE3')")"
contains "student cannot rotate" "not your class" "$(as $MS1 "select rotate_join_code('$CL3')")"
contains "expiry range checked" "expiry must be 1 to 365 days" "$(as $MT1 "select rotate_join_code('$CL3', 0)")"
NC=$(as $MT1 "select rotate_join_code('$CL3', 7)" | head -1)
expect "code with expiry works" "1" "$(as $MS2 "select count(*) from join_class('$NC')")"
as $MS2 "delete from enrollments where student_id='$MS2'" >/dev/null
q "update classes set join_code_expires_at = now() - interval '1 minute' where id='$CL3'" >/dev/null
expect "expired code is dead" "0" "$(as $MS2 "select count(*) from join_class('$NC')")"
as $MT1 "select close_joining('$CL3')" >/dev/null
NC=$(as $MT1 "select rotate_join_code('$CL3')" | head -1)
expect "rotating without expiry reopens joining" "1" "$(q "select join_code_expires_at is null from classes where id='$CL3'" | sed 's/t/1/;s/f/0/')"

# seats: limit 2, MS1 is in; MS2 takes the second seat; MS3 is refused
as $MT1 "update organizations set seat_limit=2 where id='$ORG'" >/dev/null
expect "second student fits" "1" "$(as $MS2 "select count(*) from join_class('$NC')")"
contains "third student has no seat" "no seats left" "$(as $MS3 "select count(*) from join_class('$NC')")"
expect "seats used" "2" "$(as $MT1 "select org_summary('$ORG')->>'seats_used'")"
as $MT1 "update organizations set seat_limit=null where id='$ORG'" >/dev/null

# --- assignments
ITEMS='[{"key":"ex:1:e1","points":10},{"key":"quiz:1:q1","points":5},{"key":"pred:1:p1","points":5}]'
FUT="now() + interval '3 days'"; PAST="now() - interval '3 days'"
mkasg() { as $MT1 "insert into assignments(class_id,page_id,title,items,status,due_at,late_policy,max_submissions,show_results) values ('$CL3','1-numbers','$1','$ITEMS','$2',$3,'$4',$5,'on_return') returning id" | head -1; }
contains "published assignment needs items" "at least one item" "$(as $MT1 "insert into assignments(class_id,page_id,title,status) values ('$CL3','1-numbers','E','published')")"
contains "bad item key rejected" "bad item" "$(as $MT1 "insert into assignments(class_id,page_id,title,items) values ('$CL3','1','E','[{\"key\":\"drop table\",\"points\":1}]')")"
contains "bad points rejected" "bad item" "$(as $MT1 "insert into assignments(class_id,page_id,title,items) values ('$CL3','1','E','[{\"key\":\"ex:1:a\",\"points\":1000}]')")"
contains "bad late policy rejected" "bad late_policy" "$(as $MT1 "insert into assignments(class_id,page_id,title,late_policy) values ('$CL3','1','E','{\"mode\":\"whatever\"}')")"
contains "close before due rejected" "close_at is before due_at" "$(as $MT1 "insert into assignments(class_id,page_id,title,due_at,close_at) values ('$CL3','1','E',now(),now() - interval '1 day')")"
A1=$(mkasg 'Week 1' published "$FUT" '{"mode":"accept"}' 1)
AD=$(mkasg 'Draft one' draft "$FUT" '{"mode":"accept"}' 1)
expect "student sees the published one only" "Week 1" "$(as $MS1 "select title from assignments where class_id='$CL3'")"
expect "TA sees both" "2" "$(as $MT2 "select count(*) from assignments where class_id='$CL3'")"
q "update assignments set release_at = now() + interval '1 day' where id='$A1'" >/dev/null
expect "an assignment before its release time is hidden from students" "0" "$(as $MS1 "select count(*) from assignments where class_id='$CL3'")"
q "update assignments set release_at = null where id='$A1'" >/dev/null
expect "student cannot edit assignments" "UPDATE 0" "$(as $MS1 "update assignments set title='x' where id='$A1'")"
expect "publishing notified the enrolled students (MS1)" "1" "$(as $MS1 "select count(*) from notifications where kind='assignment' and title='Week 1'")"
expect "audit: assignment.create and publish recorded" "t" "$(q "select count(*) >= 2 from audit_log where action in ('assignment.create','assignment.publish') and target='$A1'")"

# --- submission and scoring (items: ex 10, quiz 5, pred 5)
as $MS1 "insert into progress(user_id,key,data) values ('$MS1','ex:1:e1','{\"pass\":true,\"hints\":1,\"attempts\":2,\"code\":\"print(1)\"}'),('$MS1','quiz:1:q1','{\"right\":true}'),('$MS1','pred:1:p1','{\"right\":false}')" >/dev/null
expect "student cannot read submissions table" "1" "$(as $MS1 "select count(*) from submissions" | grep -c 'permission denied')"
expect "student cannot read grades table" "1" "$(as $MS1 "select count(*) from grades" | grep -c 'permission denied')"
contains "non-student cannot submit" "no such assignment" "$(as $MT3 "select submit_assignment('$A1')")"
contains "cannot submit a draft" "no such assignment" "$(as $MS1 "select submit_assignment('$AD')")"
contains "outsider cannot submit" "no such assignment" "$(as $MS3 "select submit_assignment('$A1')")"
R=$(as $MS1 "select submit_assignment('$A1', '{\"pastes\":3,\"secs\":120,\"evil\":\"x\",\"blurs\":-5}')" | head -1)
contains "submission accepted" '"n": 1' "$R"
expect "score hidden until returned (on_return)" "null" "$(echo "$R" | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["score"]))')"
expect "result not visible before return" "false|" "$(as $MS1 "select visible || '|' || coalesce(score::text,'') from my_results('$CL3') where assignment_id='$A1'")"
expect "teacher sees the automatic score 15 of 20" "15|20|auto" "$(as $MT1 "select trim_scale(final_score) || '|' || max_score || '|' || source from class_gradebook('$CL3') where student_id='$MS1' and assignment_id='$A1'")"
expect "signals are whitelisted and clamped" '{"secs": 120, "pastes": 3}' "$(as $MT1 "select signals from class_gradebook('$CL3') where student_id='$MS1' and assignment_id='$A1'")"
expect "unsubmitted student is missing" "missing|" "$(as $MT1 "select source || '|' || coalesce(final_score::text,'') from class_gradebook('$CL3') where student_id='$MS2' and assignment_id='$A1'")"
contains "second submission refused (max 1)" "no submissions left" "$(as $MS1 "select submit_assignment('$A1')")"
as $MS1 "update progress set data='{\"pass\":false}' where key='ex:1:e1'" >/dev/null
expect "the stored snapshot does not change when progress changes later" "true" "$(as $MT1 "select (snapshot->'ex:1:e1'->>'pass') from get_submissions('$A1','$MS1')")"
expect "score stays 15 after the learner's row changed" "15" "$(as $MT1 "select trim_scale(final_score) from class_gradebook('$CL3') where student_id='$MS1' and assignment_id='$A1'")"
as $MS1 "update progress set data='{\"pass\":true,\"hints\":1,\"attempts\":2}' where key='ex:1:e1'" >/dev/null
contains "student cannot read a submission" "not your class" "$(as $MS1 "select * from get_submissions('$A1','$MS1')")"
contains "student cannot read the gradebook" "not your class" "$(as $MS1 "select * from class_gradebook('$CL3')")"
contains "unrelated teacher cannot read the gradebook" "not your class" "$(as $MT3 "select * from class_gradebook('$CL3')")"
contains "student cannot grade" "not your class" "$(as $MS1 "select set_grade('$A1','$MS1',20,'','because')")"
contains "reason required for a score" "a reason is required" "$(as $MT1 "select set_grade('$A1','$MS1',18,'nice','')")"
contains "score range checked" "score out of range" "$(as $MT1 "select set_grade('$A1','$MS1',999,'','because')")"
contains "cannot grade a non-member" "not in this class" "$(as $MT1 "select set_grade('$A1','$MS3',5,'','because')")"
as $MT2 "select set_grade('$A1','$MS1',18,'Good effort','Fixed prediction credit after review')" >/dev/null
expect "override wins" "18|override" "$(as $MT1 "select final_score || '|' || source from class_gradebook('$CL3') where student_id='$MS1' and assignment_id='$A1'")"
expect "history records old and new" "15|18|Fixed prediction credit after review" "$(as $MT1 "select trim_scale(old_score) || '|' || new_score || '|' || reason from get_grade_history('$A1','$MS1')")"
expect "the audit log has the override" "t" "$(q "select count(*) >= 1 from audit_log where action='grade.override' and target='$A1'")"
expect "student still sees no score" "f" "$(as $MS1 "select visible from my_results('$CL3') where assignment_id='$A1'")"
expect "a comment-only change does not add history" "1" "$(as $MT2 "select set_grade('$A1','$MS1',18,'Good effort, well done','rewording')" >/dev/null; as $MT1 "select count(*) from get_grade_history('$A1','$MS1')")"
contains "history is immutable" "grade_history cannot be changed" "$(qx "update grade_history set reason='x'")"
expect "returning notifies and counts" "1" "$(as $MT1 "select return_grades('$A1')")"
expect "student now sees score, max and comment" "true|18|20|Good effort, well done" "$(as $MS1 "select visible || '|' || score || '|' || max_score || '|' || comment from my_results('$CL3') where assignment_id='$A1'")"
expect "student gets a grade notification" "1" "$(as $MS1 "select count(*) from notifications where kind='grade'")"
expect "breakdown reaches the student after return" "3" "$(as $MS1 "select jsonb_array_length(detail) from my_results('$CL3') where assignment_id='$A1'")"
expect "other student sees no score for MS1's work" "0" "$(as $MS2 "select count(*) from my_results('$CL3') where assignment_id='$A1' and submitted_at is not null")"
expect "clearing the override goes back to auto" "15|auto" "$(as $MT1 "select set_grade('$A1','$MS1',null,'','undo')" >/dev/null; as $MT1 "select trim_scale(final_score) || '|' || source from class_gradebook('$CL3') where student_id='$MS1' and assignment_id='$A1'")"
expect "teachers can hide results again" "f" "$(as $MT1 "select return_grades('$A1', null, false)" >/dev/null; as $MS1 "select visible from my_results('$CL3') where assignment_id='$A1'")"

# --- partial credit, revealed solution, late rules, extensions
as $MS2 "insert into progress(user_id,key,data) values ('$MS2','ex:1:e1','{\"pass\":false,\"last\":{\"passed\":2,\"total\":4}}'),('$MS2','quiz:1:q1','{\"right\":true,\"sol\":true}')" >/dev/null
A2=$(mkasg 'Partial' published "$FUT" '{"mode":"accept"}' 2)
as $MS2 "select submit_assignment('$A2')" >/dev/null
expect "partial credit: 2 of 4 tests of 10 points + quiz 5 = 10" "10" "$(as $MT1 "select trim_scale(final_score) from class_gradebook('$CL3') where student_id='$MS2' and assignment_id='$A2'")"
as $MS2 "update progress set data='{\"pass\":true,\"sol\":true,\"last\":{\"passed\":4,\"total\":4}}' where key='ex:1:e1'" >/dev/null
as $MS2 "select submit_assignment('$A2')" >/dev/null
expect "passing after revealing the solution earns 0 for that item; the latest submission counts" "5" "$(as $MT1 "select trim_scale(final_score) from class_gradebook('$CL3') where student_id='$MS2' and assignment_id='$A2'")"
expect "two submissions allowed and counted" "2" "$(as $MT1 "select submissions from class_gradebook('$CL3') where student_id='$MS2' and assignment_id='$A2'")"
contains "a third is refused" "no submissions left" "$(as $MS2 "select submit_assignment('$A2')")"

AP=$(mkasg 'Late penalty' published "$PAST" '{"mode":"penalty","per_day":10,"max":25}' 1)
AR=$(mkasg 'Late reject' published "$PAST" '{"mode":"reject"}' 1)
as $MS1 "update progress set data='{\"pass\":true}' where key='ex:1:e1'" >/dev/null
contains "reject mode refuses a late submission" "the due date has passed" "$(as $MS1 "select submit_assignment('$AR')")"
R=$(as $MS1 "select submit_assignment('$AP')" | head -1)
contains "late submission: 3 days late = 25% (capped)" '"penalty_pct": 25' "$R"
expect "raw 15 less 25% = 11.25" "11.25" "$(as $MT1 "select final_score from class_gradebook('$CL3') where student_id='$MS1' and assignment_id='$AP'")"
as $MT1 "insert into extensions(assignment_id,student_id,due_at,reason) values ('$AR','$MS1',now() + interval '1 day','illness')" >/dev/null
R=$(as $MS1 "select submit_assignment('$AR')" | head -1)
contains "an extension lets the student in on time" '"late_seconds": 0' "$R"
expect "extension shows the student's own deadline" "t" "$(as $MS1 "select due_at > now() from my_results('$CL3') where assignment_id='$AR'")"
expect "other students keep the original deadline" "t" "$(as $MS2 "select due_at < now() from my_results('$CL3') where assignment_id='$AR'")"
expect "student can read own extension" "1" "$(as $MS1 "select count(*) from extensions")"
expect "other student cannot read it" "0" "$(as $MS2 "select count(*) from extensions")"
rlsdeny "student cannot grant an extension" "$(as $MS1 "insert into extensions(assignment_id,student_id,due_at) values ('$AR','$MS1',now() + interval '9 days')")"
rlsdeny "cannot grant an extension to a non-member" "$(as $MT1 "insert into extensions(assignment_id,student_id,due_at) values ('$AR','$MS3',now() + interval '9 days')")"
AC=$(as $MT1 "insert into assignments(class_id,page_id,title,items,status,due_at,close_at,late_policy) values ('$CL3','1','Closed','$ITEMS','published',now() - interval '2 days',now() - interval '1 day','{\"mode\":\"accept\"}') returning id" | head -1)
contains "closed assignments refuse submissions" "submissions are closed" "$(as $MS1 "select submit_assignment('$AC')")"

# --- overall
expect "overall counts due or submitted assignments, weighted" "t" "$(as $MT1 "select count(*) = 2 from class_overall('$CL3')")"
expect "overall for MS1 is a number" "t" "$(as $MT1 "select pct between 0 and 100 from class_overall('$CL3') where student_id='$MS1'")"
contains "student cannot read overall" "not your class" "$(as $MS1 "select * from class_overall('$CL3')")"

# --- comments
as $MS1 "select add_comment('$A1','$MS1','Why was the prediction wrong?')" >/dev/null
expect "teacher is notified of the student's comment" "1" "$(as $MT1 "select count(*) from notifications where kind='comment'")"
expect "TA is notified too" "1" "$(as $MT2 "select count(*) from notifications where kind='comment'")"
as $MT2 "select add_comment('$A1','$MS1','Look at line 3.')" >/dev/null
expect "student sees both comments" "2" "$(as $MS1 "select count(*) from comments where assignment_id='$A1'")"
expect "other student sees none" "0" "$(as $MS2 "select count(*) from comments")"
contains "student cannot comment on someone else's work" "not allowed" "$(as $MS2 "select add_comment('$A1','$MS1','hi')")"
contains "unrelated teacher cannot comment" "not allowed" "$(as $MT3 "select add_comment('$A1','$MS1','hi')")"
contains "empty comment refused" "violates check constraint" "$(as $MS1 "select add_comment('$A1','$MS1','   ')")"
denied "comments cannot be inserted directly" "$(as $MS1 "insert into comments(assignment_id,student_id,author_id,body) values ('$A1','$MS1','$MS1','x') returning 1")"
expect "notification preferences are respected" "0" "$(as $MS1 "update profiles set display_prefs = '{\"notify\":{\"comment\":false}}'::jsonb where id='$MS1'" >/dev/null; as $MT1 "select add_comment('$A1','$MS1','Silent one')" >/dev/null; as $MS1 "select count(*) from notifications where kind='comment' and body='Silent one'")"

# --- announcements and notifications
as $MT1 "insert into announcements(class_id,author_id,title,body) values ('$CL3','$MT1','Quiz on Friday','Bring a pencil')" >/dev/null
expect "announcement reaches enrolled students" "1" "$(as $MS2 "select count(*) from notifications where kind='announcement'")"
expect "enrolled student reads announcements" "1" "$(as $MS2 "select count(*) from announcements")"
expect "outsider student reads none" "0" "$(as $MS3 "select count(*) from announcements")"
rlsdeny "student cannot post announcements" "$(as $MS2 "insert into announcements(class_id,author_id,title) values ('$CL3','$MS2','x')")"
rlsdeny "author must be the caller" "$(as $MT1 "insert into announcements(class_id,author_id,title) values ('$CL3','$MT2','x')")"
denied "nobody can insert notifications" "$(as $MS1 "insert into notifications(user_id,kind,title) values ('$MS1','grade','x')")"
denied "only read_at can be changed" "$(as $MS2 "update notifications set title='x'")"
expect "student marks a notification read" "t" "$(as $MS2 "update notifications set read_at=now() where kind='announcement'" >/dev/null; as $MS2 "select read_at is not null from notifications where kind='announcement'")"
expect "student cannot read another user's notifications" "0" "$(as $MS3 "select count(*) from notifications")"

# --- archive and duplicate
CD=$(as $MT1 "select duplicate_class('$CL3','Algorithms next term','2027 spring')" | head -1)
expect "duplicate copies assignments as drafts without dates" "t" "$(q "select count(*) = (select count(*) from assignments where class_id='$CL3') and bool_and(status='draft') and bool_and(due_at is null) from assignments where class_id='$CD'")"
expect "duplicate keeps the org and has a new code" "$ORG|true" "$(q "select org_id || '|' || (join_code <> (select join_code from classes where id='$CL3')) from classes where id='$CD'")"
expect "duplicate has no students" "0" "$(q "select count(*) from enrollments where class_id='$CD'")"
as $MT1 "select set_class_archived('$CL3', true)" >/dev/null
expect "archived class refuses joins" "0" "$(as $MS3 "select count(*) from join_class('$(q "select join_code from classes where id='$CL3'")')")"
q "update assignments set status='published', max_submissions=3 where id='$AD'" >/dev/null
contains "archived class refuses submissions" "this class is archived" "$(as $MS1 "select submit_assignment('$AD')")"
as $MT1 "select set_class_archived('$CL3', false)" >/dev/null

# --- analytics and organization reports
expect "class_item_rows removes the code" "0" "$(as $MT1 "select count(*) from class_item_rows('$CL3') where data ? 'code'")"
expect "class_item_rows has the learner rows" "t" "$(as $MT1 "select count(*) >= 5 from class_item_rows('$CL3')")"
contains "students cannot read class_item_rows" "not your class" "$(as $MS1 "select * from class_item_rows('$CL3')")"
contains "unrelated teacher cannot read class_item_rows" "not your class" "$(as $MT3 "select * from class_item_rows('$CL3')")"
contains "non-admin cannot read the org report" "not an organization admin" "$(as $MT2 "select * from org_report('$ORG')")"
expect "org admin reads the report (2 classes)" "2" "$(as $MT1 "select count(*) from org_report('$ORG')")"
expect "org report has no student names" "0" "$(as $MT1 "select count(*) from information_schema.columns where table_name='org_report'")"
as $MT1 "select org_set_member('$ORG','$MT2','admin')" >/dev/null
expect "org admin may see the class (not teach it)" "1" "$(as $MT2 "select count(*) from classes where id='$CD'")"
expect "org admin can delete a class in the org" "DELETE 1" "$(as $MT2 "delete from classes where id='$CD'")"
contains "org admin cannot read raw results" "not your class" "$(as $(q "select id from profiles where id='$MT2'") "select * from class_gradebook('$CD')")"
as $MT1 "select org_set_member('$ORG','$MT2',null)" >/dev/null
expect "removing a member removes their class staff role" "0" "$(q "select count(*) from class_teachers where user_id='$MT2'")"

# --- privacy: export and delete
expect "export includes submissions and grades" "t" "$(as $MS1 "select jsonb_array_length(export_my_data()->'submissions') >= 2 and jsonb_array_length(export_my_data()->'notifications') >= 1")"
as $MS1 "select delete_my_account()" >/dev/null
expect "delete removes submissions, grades, history, comments of that student" "0|0|0|0" "$(q "select (select count(*) from submissions where student_id='$MS1') || '|' || (select count(*) from grades where student_id='$MS1') || '|' || (select count(*) from grade_history where student_id='$MS1') || '|' || (select count(*) from comments where student_id='$MS1')")"

# --- anon denied on every new RPC
for call in "create_org('x')" "org_join('x')" "rotate_org_invite('$ORG')" "org_invite_code('$ORG')" "org_members_list('$ORG')" \
  "org_set_member('$ORG','$MT1','admin')" "org_leave('$ORG')" "org_summary('$ORG')" "org_report('$ORG')" "create_class('x')" \
  "rotate_join_code('$CL3')" "close_joining('$CL3')" "set_class_archived('$CL3',true)" "duplicate_class('$CL3','x')" \
  "class_set_teacher('$CL3','$MT1','ta')" "class_staff('$CL3')" "submit_assignment('$A1')" "set_grade('$A1','$MS2',1,'','abc')" \
  "return_grades('$A1')" "add_comment('$A1','$MS2','x')" "class_gradebook('$CL3')" "class_overall('$CL3')" \
  "get_submissions('$A1','$MS2')" "get_grade_history('$A1','$MS2')" "my_results()" "class_item_rows('$CL3')" "class_join_info('$CL3')" \
  "_notify('$MS2','grade','x','','')" "_score_items('[]','{}')" "_new_code(8)" "_final_score('$A1','$MS2')" "_effective_due('$A1','$MS2')"; do
  contains "anon denied: $call" "permission denied for function" "$(anon "select public.$call")"
done
for call in "_notify('$MS2','grade','x','','')" "_score_items('[]','{}')" "_new_code(8)" "_final_score('$A1','$MS2')" "_effective_due('$A1','$MS2')" "_clean_signals('{}')" "_items_max('[]')"; do
  contains "authenticated cannot call internal: $call" "permission denied for function" "$(as $MT1 "select public.$call")"
done
for t in organizations org_members class_teachers announcements comments extensions notifications submissions grades grade_history; do
  expect "anon has no access to $t" "f" "$(q "select has_table_privilege('anon','public.$t','select')")"
done

# ---- exercise rows merge: counters only go up, pass/sol are sticky, from two devices
as $S1 "select 1 from (select save_progress('[{\"key\":\"ex:9:m1\",\"data\":{\"pass\":false,\"attempts\":3,\"hints\":2,\"pastes\":1,\"secs\":100},\"client_ts\":1760000001000}]'::jsonb)) x" >/dev/null
as $S1 "select 1 from (select save_progress('[{\"key\":\"ex:9:m1\",\"data\":{\"pass\":true,\"attempts\":1,\"hints\":0,\"sol\":true,\"secs\":400},\"client_ts\":1760000000500}]'::jsonb)) x" >/dev/null
expect "ex merge keeps the larger counters and ORs pass/sol" "true|true|3|2|1|400" "$(q "select data->>'pass', data->>'sol', data->>'attempts', data->>'hints', data->>'pastes', data->>'secs' from progress where user_id='$S1' and key='ex:9:m1'")"
