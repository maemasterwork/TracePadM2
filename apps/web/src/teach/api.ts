import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Announcement, Assignment, AssignmentInput, ClassRow, CommentRow, Extension, GradeCell, HistoryRow, ItemRow, MyResult, NotificationRow,
  Org, OrgMember, OrgReportRow, OrgSummary, Overall, StaffRow, Student, SubmissionDetail,
} from './types';

/** An error from the database, with an i18n key for the learner or teacher. */
export class TeachError extends Error {
  constructor(public key: string, public raw?: unknown) { super(key); }
}

const MAP: [RegExp, string][] = [
  [/rate limited/i, 'err.rate'], [/no seats/i, 'err.noSeats'], [/due date has passed/i, 'err.pastDue'], [/submissions are closed/i, 'err.closed'],
  [/no submissions left/i, 'err.noSubs'], [/class is archived/i, 'err.archived'], [/no such assignment/i, 'err.noAsg'],
  [/a reason is required/i, 'err.reason'], [/score out of range/i, 'err.range'], [/at least one admin/i, 'err.lastAdmin'],
  [/not in this class's organization/i, 'err.notInOrg'], [/not a member of that organization/i, 'err.notInOrg'],
  [/at least one item/i, 'err.noItems'], [/close_at is before/i, 'err.closeBeforeDue'], [/teachers only/i, 'err.teachersOnly'],
  [/not your class|not an organization admin|only the class owner|permission denied|row-level security/i, 'err.denied'],
  [/failed to fetch|networkerror|load failed/i, 'err.offline'],
];
export function teachErr(e: unknown): TeachError {
  if (e instanceof TeachError) return e;
  const m = (e as { message?: string })?.message ?? String(e);
  for (const [re, key] of MAP) if (re.test(m)) return new TeachError(key, e);
  return new TeachError('err.generic', e);
}

const CLASS_COLS = 'id, teacher_id, name, term, org_id, archived_at, join_code_expires_at, created_at';
const ASG_COLS = 'id, class_id, page_id, title, description, items, status, release_at, due_at, close_at, late_policy, weight, max_submissions, show_results, created_at';

export function makeTeachApi(c: SupabaseClient) {
  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw teachErr(error);
    return data as T;
  }
  const ok = <T>(r: { data: T | null; error: unknown }): T => { if (r.error) throw teachErr(r.error); return (r.data ?? ([] as unknown)) as T; };

  return {
    // ---- classes
    classes: async (): Promise<ClassRow[]> => ok(await c.from('classes').select(CLASS_COLS).order('created_at')),
    createClass: (name: string, term: string, org: string | null) => rpc<string>('create_class', { p_name: name, p_term: term, ...(org ? { p_org: org } : {}) }),
    renameClass: async (id: string, name: string, term: string) => { const r = await c.from('classes').update({ name, term }).eq('id', id); if (r.error) throw teachErr(r.error); },
    joinClass: async (code: string): Promise<{ id: string; name: string } | null> => {
      const rows = await rpc<{ id: string; name: string }[]>('join_class', { p_code: code });
      return rows?.[0] ?? null;
    },
    leaveClass: async (classId: string, userId: string) => { const r = await c.from('enrollments').delete().eq('class_id', classId).eq('student_id', userId); if (r.error) throw teachErr(r.error); },
    removeStudent: async (classId: string, studentId: string) => { const r = await c.from('enrollments').delete().eq('class_id', classId).eq('student_id', studentId); if (r.error) throw teachErr(r.error); },
    joinInfo: async (classId: string) => (await rpc<{ join_code: string; expires_at: string | null }[]>('class_join_info', { p_class: classId }))[0],
    rotateCode: (classId: string, days: number | null) => rpc<string>('rotate_join_code', { p_class: classId, ...(days ? { p_expires_in_days: days } : {}) }),
    closeJoining: (classId: string) => rpc<void>('close_joining', { p_class: classId }),
    archive: (classId: string, archived: boolean) => rpc<void>('set_class_archived', { p_class: classId, p_archived: archived }),
    duplicate: (classId: string, name: string, term: string, copy: boolean) => rpc<string>('duplicate_class', { p_class: classId, p_name: name, p_term: term, p_copy_assignments: copy }),
    deleteClass: async (classId: string) => { const r = await c.from('classes').delete().eq('id', classId); if (r.error) throw teachErr(r.error); },
    staff: (classId: string) => rpc<StaffRow[]>('class_staff', { p_class: classId }),
    setStaff: (classId: string, userId: string, role: 'teacher' | 'ta' | null) => rpc<void>('class_set_teacher', { p_class: classId, p_user: userId, p_role: role }),
    roster: async (classId: string): Promise<Student[]> => {
      const en = ok<{ student_id: string }[]>(await c.from('enrollments').select('student_id').eq('class_id', classId));
      if (en.length === 0) return [];
      const ids = en.map((e) => e.student_id);
      return ok<Student[]>(await c.from('profiles').select('id, full_name, username').in('id', ids)).sort((a, b) => (a.full_name || a.username || '').localeCompare(b.full_name || b.username || ''));
    },

    // ---- assignments
    assignments: async (classId: string): Promise<Assignment[]> => ok(await c.from('assignments').select(ASG_COLS).eq('class_id', classId).order('created_at')),
    saveAssignment: async (id: string | null, a: AssignmentInput): Promise<void> => {
      if (id) { const { class_id: _c, ...patch } = a; void _c; const r = await c.from('assignments').update(patch).eq('id', id); if (r.error) throw teachErr(r.error); }
      else { const r = await c.from('assignments').insert(a); if (r.error) throw teachErr(r.error); }
    },
    deleteAssignment: async (id: string) => { const r = await c.from('assignments').delete().eq('id', id); if (r.error) throw teachErr(r.error); },
    extensions: async (assignmentId: string): Promise<Extension[]> => ok(await c.from('extensions').select('assignment_id, student_id, due_at, reason').eq('assignment_id', assignmentId)),
    grantExtension: async (assignmentId: string, studentId: string, dueAt: string, reason: string) => {
      const r = await c.from('extensions').upsert({ assignment_id: assignmentId, student_id: studentId, due_at: dueAt, reason }, { onConflict: 'assignment_id,student_id' });
      if (r.error) throw teachErr(r.error);
    },
    removeExtension: async (assignmentId: string, studentId: string) => { const r = await c.from('extensions').delete().eq('assignment_id', assignmentId).eq('student_id', studentId); if (r.error) throw teachErr(r.error); },

    // ---- grading
    gradebook: (classId: string) => rpc<GradeCell[]>('class_gradebook', { p_class: classId }),
    overall: (classId: string) => rpc<Overall[]>('class_overall', { p_class: classId }),
    itemRows: (classId: string) => rpc<ItemRow[]>('class_item_rows', { p_class: classId }),
    submissions: (assignmentId: string, studentId: string) => rpc<SubmissionDetail[]>('get_submissions', { p_assignment: assignmentId, p_student: studentId }),
    gradeHistory: (assignmentId: string, studentId: string) => rpc<HistoryRow[]>('get_grade_history', { p_assignment: assignmentId, p_student: studentId }),
    setGrade: (assignmentId: string, studentId: string, score: number | null, comment: string, reason: string) =>
      rpc<void>('set_grade', { p_assignment: assignmentId, p_student: studentId, p_score: score, p_comment: comment, p_reason: reason }),
    returnGrades: (assignmentId: string, students: string[] | null, ret: boolean) =>
      rpc<number>('return_grades', { p_assignment: assignmentId, ...(students ? { p_students: students } : {}), p_return: ret }),
    comments: async (assignmentId: string, studentId: string): Promise<CommentRow[]> =>
      ok(await c.from('comments').select('id, assignment_id, student_id, author_id, body, created_at').eq('assignment_id', assignmentId).eq('student_id', studentId).order('id')),
    addComment: (assignmentId: string, studentId: string, body: string) => rpc<number>('add_comment', { p_assignment: assignmentId, p_student: studentId, p_body: body }),

    // ---- students
    myResults: (classId?: string) => rpc<MyResult[]>('my_results', classId ? { p_class: classId } : {}),
    submit: (assignmentId: string, signals: Record<string, number>) => rpc<{ id: string; n: number; late_seconds: number; penalty_pct: number; score: number | null; max: number | null }>('submit_assignment', { p_assignment: assignmentId, p_signals: signals }),

    // ---- announcements and notifications
    announcements: async (classId: string): Promise<Announcement[]> => ok(await c.from('announcements').select('id, class_id, author_id, title, body, pinned, created_at').eq('class_id', classId).order('created_at', { ascending: false })),
    postAnnouncement: async (classId: string, authorId: string, title: string, body: string, pinned: boolean) => {
      const r = await c.from('announcements').insert({ class_id: classId, author_id: authorId, title, body, pinned }); if (r.error) throw teachErr(r.error);
    },
    deleteAnnouncement: async (id: string) => { const r = await c.from('announcements').delete().eq('id', id); if (r.error) throw teachErr(r.error); },
    notifications: async (): Promise<NotificationRow[]> => ok(await c.from('notifications').select('id, kind, title, body, link, created_at, read_at').order('id', { ascending: false }).limit(50)),
    markRead: async (ids: number[]) => { if (!ids.length) return; const r = await c.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids); if (r.error) throw teachErr(r.error); },

    // ---- organizations
    myOrgRoles: async (): Promise<{ org_id: string; role: 'admin' | 'teacher' }[]> => ok(await c.from('org_members').select('org_id, role')),
    orgs: async (): Promise<Org[]> => ok(await c.from('organizations').select('id, name, seat_limit, created_at').order('created_at')),
    createOrg: (name: string) => rpc<string>('create_org', { p_name: name }),
    joinOrg: async (code: string) => (await rpc<{ id: string; name: string }[]>('org_join', { p_code: code }))?.[0] ?? null,
    orgMembers: (org: string) => rpc<OrgMember[]>('org_members_list', { p_org: org }),
    setOrgMember: (org: string, user: string, role: 'admin' | 'teacher' | null) => rpc<void>('org_set_member', { p_org: org, p_user: user, p_role: role }),
    orgInvite: (org: string) => rpc<string>('org_invite_code', { p_org: org }),
    rotateOrgInvite: (org: string) => rpc<string>('rotate_org_invite', { p_org: org }),
    orgSummary: (org: string) => rpc<OrgSummary>('org_summary', { p_org: org }),
    orgReport: (org: string) => rpc<OrgReportRow[]>('org_report', { p_org: org }),
    setSeats: async (org: string, seats: number | null) => { const r = await c.from('organizations').update({ seat_limit: seats }).eq('id', org); if (r.error) throw teachErr(r.error); },
    renameOrg: async (org: string, name: string) => { const r = await c.from('organizations').update({ name }).eq('id', org); if (r.error) throw teachErr(r.error); },
    leaveOrg: (org: string) => rpc<void>('org_leave', { p_org: org }),
  };
}
export type TeachApi = ReturnType<typeof makeTeachApi>;
