/** Shapes returned by the Milestone 3 database functions (nullability made explicit; see supabase/migrations/…0700_*.sql). */
export type LateMode = 'reject' | 'accept' | 'penalty';
export interface LatePolicy { mode: LateMode; per_day?: number; max?: number }
export interface AsgItem { key: string; points: number }

export interface ClassRow {
  id: string; teacher_id: string; name: string; term: string; org_id: string | null;
  archived_at: string | null; join_code_expires_at: string | null; created_at: string;
}
export interface Assignment {
  id: string; class_id: string; page_id: string; title: string; description: string; items: AsgItem[];
  status: 'draft' | 'published'; release_at: string | null; due_at: string | null; close_at: string | null;
  late_policy: LatePolicy; weight: number; max_submissions: number; show_results: 'on_submit' | 'on_return'; created_at: string;
}
export interface AssignmentInput {
  class_id: string; page_id: string; title: string; description: string; items: AsgItem[]; status: 'draft' | 'published';
  release_at: string | null; due_at: string | null; close_at: string | null; late_policy: LatePolicy; weight: number;
  max_submissions: number; show_results: 'on_submit' | 'on_return';
}
export interface GradeCell {
  student_id: string; assignment_id: string; submitted_at: string | null; submissions: number; late_seconds: number;
  penalty_pct: number; auto_score: number | null; max_score: number; override_score: number | null; final_score: number | null;
  source: 'auto' | 'override' | 'missing'; returned: boolean; comment: string; due_at: string | null;
  signals: { secs?: number; pastes?: number; paste_chars?: number; blurs?: number };
}
export interface Overall { student_id: string; pct: number | null; counted: number }
export interface ItemRow { student_id: string; key: string; data: Record<string, unknown>; updated_at: string }
export interface Student { id: string; full_name: string; username: string | null }
export interface MyResult {
  assignment_id: string; class_id: string; title: string; description: string; page_id: string; items: AsgItem[];
  due_at: string | null; release_at: string | null; late_policy: LatePolicy; max_submissions: number; submissions: number;
  submitted_at: string | null; late_seconds: number | null; penalty_pct: number | null; visible: boolean; score: number | null;
  max_score: number; detail: ScoredItem[] | null; comment: string; returned_at: string | null; archived: boolean;
}
export interface ScoredItem { key: string; points: number; earned: number; state: 'correct' | 'partial' | 'wrong' | 'blank'; hints: number; attempts: number; pastes: number }
export interface SubmissionDetail {
  n: number; submitted_at: string; late_seconds: number; penalty_pct: number; raw_score: number; score: number; max_score: number;
  detail: ScoredItem[]; snapshot: Record<string, Record<string, unknown>>; signals: GradeCell['signals'];
}
export interface HistoryRow { at: string; actor_name: string | null; old_score: number | null; new_score: number | null; reason: string }
export interface Announcement { id: string; class_id: string; author_id: string | null; title: string; body: string; pinned: boolean; created_at: string }
export interface CommentRow { id: number; assignment_id: string; student_id: string; author_id: string | null; body: string; created_at: string }
export interface NotificationRow { id: number; kind: 'assignment' | 'grade' | 'announcement' | 'comment' | 'class'; title: string; body: string; link: string; created_at: string; read_at: string | null }
export interface Org { id: string; name: string; seat_limit: number | null; created_at: string }
export interface OrgMember { user_id: string; full_name: string; username: string | null; role: 'admin' | 'teacher'; classes: number }
export interface OrgReportRow {
  class_id: string; name: string; term: string; archived: boolean; teacher_name: string; students: number; assignments: number;
  submissions: number; avg_pct: number | null; last_submission: string | null;
}
export interface OrgSummary { seat_limit: number | null; seats_used: number; teachers: number; classes: number; archived_classes: number }
export interface StaffRow { user_id: string; full_name: string; role: 'owner' | 'teacher' | 'ta' }
export interface Extension { assignment_id: string; student_id: string; due_at: string; reason: string }
