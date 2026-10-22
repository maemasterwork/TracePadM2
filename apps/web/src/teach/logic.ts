import type { IndexedItem } from '../learn/record';
import type { Labs } from '../learn/types';
import type { Assignment, AsgItem, GradeCell, ItemRow, Overall, Student } from './types';

/* ------------------------------------------------------------------ building assignments */
export interface PointRule { pred: number; quiz: number; ex: number }
export const DEFAULT_POINTS: PointRule = { pred: 1, quiz: 1, ex: 5 };

/** Every practice item of one chapter as assignment items. `kinds` picks which kinds to include. */
export function chapterItems(labs: Labs, ch: number, kinds: ('pred' | 'quiz' | 'ex')[], pts: PointRule = DEFAULT_POINTS): AsgItem[] {
  const c = labs.chapters[String(ch)];
  if (!c) return [];
  const out: AsgItem[] = [];
  if (kinds.includes('pred')) for (const p of c.predictions ?? []) out.push({ key: `pred:${ch}:${p.id}`, points: pts.pred });
  if (kinds.includes('quiz')) for (const q of c.quizzes ?? []) out.push({ key: `quiz:${ch}:${q.id}`, points: pts.quiz });
  if (kinds.includes('ex')) for (const e of c.exercises ?? []) out.push({ key: `ex:${ch}:${e.id}`, points: pts.ex });
  return out;
}
export const itemsMax = (items: AsgItem[]) => items.reduce((s, i) => s + i.points, 0);

/* ------------------------------------------------------------------ gradebook */
export interface GradebookRow { student: Student; cells: Map<string, GradeCell>; overall: number | null }

export function gradebookRows(students: Student[], cells: GradeCell[], overall: Overall[]): GradebookRow[] {
  const byStudent = new Map<string, Map<string, GradeCell>>();
  for (const c of cells) {
    let m = byStudent.get(c.student_id);
    if (!m) byStudent.set(c.student_id, (m = new Map()));
    m.set(c.assignment_id, c);
  }
  const ov = new Map(overall.map((o) => [o.student_id, o.pct]));
  return students.map((s) => ({ student: s, cells: byStudent.get(s.id) ?? new Map(), overall: ov.get(s.id) ?? null }));
}

export const cellPct = (c: GradeCell | undefined): number | null =>
  c && c.final_score !== null && c.max_score > 0 ? Math.round((1000 * c.final_score) / c.max_score) / 10 : null;

/** 'late' is a submission after the student's own deadline; 'missing' is nothing handed in after the deadline; 'open' is not due yet. */
export type CellStatus = 'graded' | 'submitted' | 'late' | 'missing' | 'open';
export function cellStatus(c: GradeCell | undefined, now: number): CellStatus {
  if (!c) return 'open';
  if (c.source === 'override') return 'graded';
  if (c.submitted_at) return c.late_seconds > 0 ? 'late' : 'submitted';
  return c.due_at && new Date(c.due_at).getTime() < now ? 'missing' : 'open';
}

/* ------------------------------------------------------------------ CSV */
/** CSV text per RFC 4180. A cell that starts with = + - @ (or a tab or CR) gets a leading apostrophe so a spreadsheet
 *  never runs it as a formula (names and comments come from users). Numbers are never altered. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v) : v;
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCsv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

const fmt = (n: number | null) => (n === null ? '' : Number(n.toFixed(2)));

/** Plain gradebook: one row per student, score and percent per assignment, weighted overall. */
export function gradebookCsv(rows: GradebookRow[], asg: Assignment[], now: number): string {
  const head: (string | number)[] = ['Name', 'Username'];
  for (const a of asg) head.push(`${a.title} (/${fmt(itemsMax(a.items))})`, `${a.title} status`);
  head.push('Overall %');
  const out: (string | number | null)[][] = [head];
  for (const r of rows) {
    const line: (string | number | null)[] = [r.student.full_name, r.student.username ?? ''];
    for (const a of asg) { const c = r.cells.get(a.id); line.push(fmt(c?.final_score ?? null), cellStatus(c, now)); }
    line.push(fmt(r.overall));
    out.push(line);
  }
  return toCsv(out);
}

/** "LMS-friendly": the layout most LMS gradebook imports accept (a header row, then a "Points Possible" row, then one row per student,
 *  one column per assignment). Column names differ between systems, so check the target's import page. */
export function lmsCsv(rows: GradebookRow[], asg: Assignment[]): string {
  const head = ['Student', 'ID', 'SIS Login ID', ...asg.map((a) => a.title)];
  const pts = ['    Points Possible', '', '', ...asg.map((a) => fmt(itemsMax(a.items)))];
  const out: (string | number | null)[][] = [head, pts];
  for (const r of rows) out.push([r.student.full_name, r.student.id, r.student.username ?? '', ...asg.map((a) => fmt(r.cells.get(a.id)?.final_score ?? null))]);
  return toCsv(out);
}

/* ------------------------------------------------------------------ analytics */
export type Catalog = Map<string, IndexedItem>;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** One item row is "done" when the learner got it: right for questions, pass for exercises. */
export const itemDone = (key: string, d: Record<string, unknown>) => (key.startsWith('ex:') ? d.pass === true : d.right === true);
const kindOf = (key: string) => key.split(':')[0];

export interface HeatCell { done: number; total: number; tried: number }
export interface Heat { columns: { id: string; items: number }[]; rows: { student: Student; cells: HeatCell[] }[]; classAvg: (number | null)[] }

/** Share of a group's items each student got right. group(item) = column id (a chapter number or a concept tag) or null to skip. */
export function heatMap(students: Student[], rows: ItemRow[], catalog: Catalog, group: (it: IndexedItem) => string | null, order?: string[]): Heat {
  const totals = new Map<string, number>();
  const keyCol = new Map<string, string>();
  for (const it of catalog.values()) {
    const g = group(it);
    if (g === null) continue;
    keyCol.set(it.key, g);
    totals.set(g, (totals.get(g) ?? 0) + 1);
  }
  const ids = order ? order.filter((o) => totals.has(o)) : [...totals.keys()];
  const idx = new Map(ids.map((id, i) => [id, i]));
  const by = new Map<string, HeatCell[]>(students.map((s) => [s.id, ids.map((id) => ({ done: 0, total: totals.get(id) ?? 0, tried: 0 }))]));
  for (const r of rows) {
    const col = keyCol.get(r.key);
    const cells = by.get(r.student_id);
    if (col === undefined || !cells) continue;
    const cell = cells[idx.get(col)!];
    cell.tried += 1;
    if (itemDone(r.key, r.data)) cell.done += 1;
  }
  const classAvg = ids.map((_, i) => {
    let d = 0, t = 0;
    for (const s of students) { const c = by.get(s.id)![i]; d += c.done; t += c.total; }
    return t === 0 ? null : Math.round((1000 * d) / t) / 10;
  });
  return { columns: ids.map((id) => ({ id, items: totals.get(id) ?? 0 })), rows: students.map((s) => ({ student: s, cells: by.get(s.id)! })), classAvg };
}

export interface Missed { key: string; kind: 'pred' | 'quiz' | 'ex'; attempted: number; wrong: number; rate: number; common: { answer: string; count: number }[] }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Items many students got wrong, with the answers they actually gave (latest answer per student). Needs at least `minAttempts` students. */
export function mostMissed(rows: ItemRow[], catalog: Catalog, label: (it: IndexedItem, pick: number) => string, minAttempts = 2, limit = 10): Missed[] {
  const acc = new Map<string, { attempted: number; wrong: number; answers: Map<string, number> }>();
  for (const r of rows) {
    const it = catalog.get(r.key);
    if (!it) continue;
    const a = acc.get(r.key) ?? { attempted: 0, wrong: 0, answers: new Map() };
    acc.set(r.key, a);
    a.attempted += 1;
    if (itemDone(r.key, r.data)) continue;
    a.wrong += 1;
    let ans = '';
    if (it.kind === 'pred' && typeof r.data.guess === 'string') ans = norm(r.data.guess).slice(0, 80);
    else if (it.kind === 'quiz' && typeof r.data.pick === 'number') ans = label(it, r.data.pick);
    if (ans) a.answers.set(ans, (a.answers.get(ans) ?? 0) + 1);
  }
  return [...acc.entries()]
    .filter(([, a]) => a.attempted >= minAttempts && a.wrong > 0)
    .map(([key, a]) => ({
      key, kind: kindOf(key) as Missed['kind'], attempted: a.attempted, wrong: a.wrong, rate: a.wrong / a.attempted,
      common: [...a.answers.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3).map(([answer, count]) => ({ answer, count })),
    }))
    .sort((x, y) => y.rate - x.rate || y.wrong - x.wrong || x.key.localeCompare(y.key))
    .slice(0, limit);
}

export interface Stuck { student: Student; idleDays: number | null; repeated: string[]; reasons: ('idle' | 'repeated' | 'notStarted')[] }
export const STUCK_IDLE_DAYS = 7;
export const STUCK_TRIES = 3;
/** Who needs a look: nothing done for a week after starting, or the same item tried three or more times without success. */
export function stuckStudents(students: Student[], rows: ItemRow[], now: number): Stuck[] {
  const last = new Map<string, number>();
  const repeated = new Map<string, string[]>();
  for (const r of rows) {
    if (!/^(pred|quiz|ex):/.test(r.key)) continue;
    const t = new Date(r.updated_at).getTime();
    last.set(r.student_id, Math.max(last.get(r.student_id) ?? 0, t));
    const tries = r.key.startsWith('ex:') ? num(r.data.attempts) : num(r.data.tries);
    if (!itemDone(r.key, r.data) && tries >= STUCK_TRIES) repeated.set(r.student_id, [...(repeated.get(r.student_id) ?? []), r.key]);
  }
  const out: Stuck[] = [];
  for (const s of students) {
    const l = last.get(s.id);
    const reasons: Stuck['reasons'] = [];
    const idleDays = l === undefined ? null : Math.floor((now - l) / 86_400_000);
    if (l === undefined) reasons.push('notStarted');
    else if (idleDays! >= STUCK_IDLE_DAYS) reasons.push('idle');
    const rep = repeated.get(s.id) ?? [];
    if (rep.length > 0) reasons.push('repeated');
    if (reasons.length) out.push({ student: s, idleDays, repeated: rep.sort(), reasons });
  }
  return out.sort((a, b) => b.reasons.length - a.reasons.length || (b.idleDays ?? 9999) - (a.idleDays ?? 9999));
}

export interface HintUse { key: string; students: number; hints: number }
/** Exercises where hints were used: how many students and how many hints in total. */
export function hintUsage(rows: ItemRow[]): HintUse[] {
  const m = new Map<string, HintUse>();
  for (const r of rows) {
    if (!r.key.startsWith('ex:')) continue;
    const h = num(r.data.hints);
    if (h <= 0) continue;
    const u = m.get(r.key) ?? { key: r.key, students: 0, hints: 0 };
    u.students += 1; u.hints += h;
    m.set(r.key, u);
  }
  return [...m.values()].sort((a, b) => b.hints - a.hints || a.key.localeCompare(b.key));
}

/** Counts of percentages in `bins` equal bins from 0 to 100 (100 goes in the last bin). Null values are skipped. */
export function distribution(pcts: (number | null)[], bins = 10): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const p of pcts) if (p !== null && Number.isFinite(p)) out[Math.min(bins - 1, Math.max(0, Math.floor((p / 100) * bins)))] += 1;
  return out;
}

export interface TimelineEvent { t: number; key: string; ok: boolean; hint: boolean }
/** One student's recorded attempts (the app keeps the last twelve per item), oldest first. */
export function studentTimeline(rows: ItemRow[]): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  for (const r of rows) {
    if (!/^(pred|quiz|ex):/.test(r.key) || !Array.isArray(r.data.hist)) continue;
    for (const a of r.data.hist as { t?: number; ok?: boolean; hint?: boolean }[]) if (typeof a.t === 'number') ev.push({ t: a.t, key: r.key, ok: a.ok === true, hint: a.hint === true });
  }
  return ev.sort((a, b) => a.t - b.t || a.key.localeCompare(b.key));
}
export interface DayBucket { day: string; attempts: number; right: number }
export function dailyBuckets(ev: TimelineEvent[]): DayBucket[] {
  const m = new Map<string, DayBucket>();
  for (const e of ev) {
    const d = new Date(e.t);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const b = m.get(day) ?? { day, attempts: 0, right: 0 };
    b.attempts += 1; if (e.ok) b.right += 1;
    m.set(day, b);
  }
  return [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/* ------------------------------------------------------------------ integrity */
export interface Flag { kind: 'paste' | 'fast' | 'solution' | 'blur'; item?: string; n?: number }
/** Signals worth a teacher's glance. These are observations from the learner's browser (never proof, never automatic penalties). */
export function integrityNotes(signals: GradeCell['signals'], detail: { key: string; pastes: number }[], snapshot: Record<string, Record<string, unknown>>, nExercises: number): Flag[] {
  const out: Flag[] = [];
  for (const d of detail) if (d.pastes > 0) out.push({ kind: 'paste', item: d.key, n: d.pastes });
  for (const [k, d] of Object.entries(snapshot)) if (k.startsWith('ex:') && d.sol === true) out.push({ kind: 'solution', item: k });
  const secs = signals.secs ?? 0;
  if (nExercises > 0 && secs > 0 && secs < 15 * nExercises) out.push({ kind: 'fast', n: secs });
  if ((signals.blurs ?? 0) >= 10) out.push({ kind: 'blur', n: signals.blurs });
  return out;
}

/* ------------------------------------------------------------------ student side */
export type MyStatus = 'open' | 'submitted' | 'late' | 'missed' | 'returned';
export function myStatus(r: { submitted_at: string | null; due_at: string | null; late_seconds: number | null; visible: boolean }, now: number): MyStatus {
  if (r.visible && r.submitted_at) return 'returned';
  if (r.submitted_at) return (r.late_seconds ?? 0) > 0 ? 'late' : 'submitted';
  return r.due_at && new Date(r.due_at).getTime() < now ? 'missed' : 'open';
}
/** The penalty a late submission would get right now under the server's rule (per late day, rounded up, capped). */
export function latePenaltyNow(dueAt: string | null, lp: { mode: string; per_day?: number; max?: number }, now: number): number {
  if (!dueAt || lp.mode !== 'penalty') return 0;
  const late = now - new Date(dueAt).getTime();
  if (late <= 0) return 0;
  return Math.min(lp.max ?? 100, (lp.per_day ?? 0) * Math.ceil(late / 86_400_000));
}
