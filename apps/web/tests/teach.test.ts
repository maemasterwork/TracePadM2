import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexLabs } from '../src/learn/record';
import type { Labs } from '../src/learn/types';
import {
  cellPct, cellStatus, chapterItems, csvCell, dailyBuckets, distribution, gradebookCsv, gradebookRows, heatMap, hintUsage, integrityNotes,
  itemsMax, latePenaltyNow, lmsCsv, mostMissed, myStatus, stuckStudents, studentTimeline, toCsv,
} from '../src/teach/logic';
import { teachErr } from '../src/teach/api';
import type { Assignment, GradeCell, ItemRow, Student } from '../src/teach/types';

const labs = JSON.parse(readFileSync(join(process.cwd(), 'public/content/01-objects-and-data-structures/labs.json'), 'utf8')) as Labs;
const catalog = indexLabs(labs);
const S: Student[] = [{ id: 's1', full_name: 'Ada', username: 'ada' }, { id: 's2', full_name: '=cmd|calc', username: null }, { id: 's3', full_name: 'Cy', username: 'cy' }];
const iso = (d: number) => new Date(d).toISOString();
const NOW = Date.UTC(2026, 9, 20, 12);
const row = (s: string, key: string, data: Record<string, unknown>, t = NOW): ItemRow => ({ student_id: s, key, data, updated_at: iso(t) });

describe('building assignments from the lesson', () => {
  it('lists every item of a chapter with points per kind', () => {
    const items = chapterItems(labs, 2, ['pred', 'quiz', 'ex']);
    const c = labs.chapters['2'];
    expect(items).toHaveLength((c.predictions?.length ?? 0) + (c.quizzes?.length ?? 0) + (c.exercises?.length ?? 0));
    expect(items.every((i) => /^(pred|quiz|ex):2:[a-z0-9_-]+$/.test(i.key))).toBe(true);
    expect(itemsMax(items)).toBe((c.predictions?.length ?? 0) + (c.quizzes?.length ?? 0) + 5 * (c.exercises?.length ?? 0));
    expect(chapterItems(labs, 2, ['ex']).every((i) => i.key.startsWith('ex:'))).toBe(true);
    expect(chapterItems(labs, 99, ['ex'])).toEqual([]);
  });
  it('every item key it produces exists in the catalog (so progress rows will match)', () => {
    for (const ch of Object.keys(labs.chapters)) for (const i of chapterItems(labs, Number(ch), ['pred', 'quiz', 'ex'])) expect(catalog.has(i.key)).toBe(true);
  });
});

describe('csv', () => {
  it('quotes and escapes per RFC 4180', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
  });
  it('defuses spreadsheet formulas in text but never changes numbers', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell(-3)).toBe('-3');
  });
  it('uses CRLF and ends with a newline', () => expect(toCsv([['a', 'b'], [1, 2]])).toBe('a,b\r\n1,2\r\n'));
});

const asg = (id: string, title: string, pts: number[]): Assignment => ({
  id, class_id: 'c', page_id: '1', title, description: '', items: pts.map((p, i) => ({ key: `quiz:1:q${i}`, points: p })), status: 'published', release_at: null,
  due_at: iso(NOW + 86400000), close_at: null, late_policy: { mode: 'accept' }, weight: 1, max_submissions: 1, show_results: 'on_return', created_at: iso(NOW),
});
const cell = (s: string, a: string, o: Partial<GradeCell>): GradeCell => ({
  student_id: s, assignment_id: a, submitted_at: iso(NOW), submissions: 1, late_seconds: 0, penalty_pct: 0, auto_score: 8, max_score: 10, override_score: null,
  final_score: 8, source: 'auto', returned: false, comment: '', due_at: iso(NOW + 86400000), signals: {}, ...o,
});

describe('gradebook', () => {
  const a1 = asg('a1', 'Week 1, "intro"', [5, 5]);
  const cells = [cell('s1', 'a1', {}), cell('s2', 'a1', { submitted_at: null, submissions: 0, final_score: null, auto_score: null, source: 'missing', due_at: iso(NOW - 1000) }), cell('s3', 'a1', { final_score: 10, override_score: 10, source: 'override' })];
  const rows = gradebookRows(S, cells, [{ student_id: 's1', pct: 80, counted: 1 }, { student_id: 's3', pct: 100, counted: 1 }]);
  it('pivots cells by student and assignment', () => {
    expect(rows).toHaveLength(3);
    expect(rows[0].cells.get('a1')?.final_score).toBe(8);
    expect(rows[1].overall).toBeNull();
    expect(rows[2].overall).toBe(100);
  });
  it('percentages and statuses', () => {
    expect(cellPct(cells[0])).toBe(80);
    expect(cellPct(cells[1])).toBeNull();
    expect(cellStatus(cells[0], NOW)).toBe('submitted');
    expect(cellStatus(cells[1], NOW)).toBe('missing');
    expect(cellStatus(cells[2], NOW)).toBe('graded');
    expect(cellStatus(cell('s1', 'a1', { late_seconds: 5 }), NOW)).toBe('late');
    expect(cellStatus(cell('s1', 'a1', { submitted_at: null, final_score: null, source: 'missing' }), NOW)).toBe('open');
    expect(cellStatus(undefined, NOW)).toBe('open');
  });
  it('exports a csv with a safe name column and statuses', () => {
    const csv = gradebookCsv(rows, [a1], NOW);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Name,Username,"Week 1, ""intro"" (/10)","Week 1, ""intro"" status",Overall %');
    expect(lines[1]).toBe('Ada,ada,8,submitted,80');
    expect(lines[2].startsWith("'=cmd|calc,")).toBe(true);
    expect(lines[2]).toContain(',,missing,');
    expect(lines[3]).toBe('Cy,cy,10,graded,100');
  });
  it('exports the LMS layout with a points-possible row', () => {
    const lines = lmsCsv(rows, [a1]).trim().split('\r\n');
    expect(lines[0]).toBe('Student,ID,SIS Login ID,"Week 1, ""intro"""');
    expect(lines[1]).toBe('    Points Possible,,,10');
    expect(lines[2]).toBe('Ada,s1,ada,8');
    expect(lines).toHaveLength(5);
  });
});

describe('class analytics', () => {
  const q = [...catalog.values()].filter((i) => i.kind === 'quiz' && i.ch === 2);
  const qa = q[0], qb = q[1];
  const preds = [...catalog.values()].filter((i) => i.kind === 'pred' && i.ch === 1);
  const pa = preds[0];
  const rows: ItemRow[] = [
    row('s1', qa.key, { right: true, tries: 1 }), row('s1', qb.key, { right: false, tries: 3, pick: 0 }),
    row('s2', qa.key, { right: false, tries: 1, pick: (qa.quiz!.correct + 1) % qa.quiz!.options.length }), row('s2', qb.key, { right: false, tries: 1, pick: 0 }),
    row('s3', pa.key, { right: false, tries: 1, guess: ' 42  ' }), row('s1', pa.key, { right: false, tries: 1, guess: '42' }),
  ];
  it('heat map by chapter counts items done and tried per student', () => {
    const h = heatMap(S, rows, catalog, (it) => String(it.ch), ['1', '2', '3']);
    expect(h.columns.map((c) => c.id)).toEqual(['1', '2', '3']);
    const ada = h.rows.find((r) => r.student.id === 's1')!;
    expect(ada.cells[1]).toMatchObject({ done: 1, tried: 2 });
    expect(ada.cells[1].total).toBe(h.columns[1].items);
    expect(h.classAvg[1]).toBeGreaterThan(0);
    expect(h.classAvg[2]).toBe(0);
  });
  it('heat map by concept skips items without a concept', () => {
    const h = heatMap(S, rows, catalog, (it) => it.tag ?? null);
    expect(h.columns.every((c) => c.id.length > 0)).toBe(true);
    expect(h.columns.length).toBeGreaterThan(3);
  });
  it('most missed items carry the common wrong answers (normalised)', () => {
    const m = mostMissed(rows, catalog, (it, pick) => `option ${pick}`, 2);
    const p = m.find((x) => x.key === pa.key)!;
    expect(p).toMatchObject({ attempted: 2, wrong: 2, rate: 1 });
    expect(p.common).toEqual([{ answer: '42', count: 2 }]);
    const qb2 = m.find((x) => x.key === qb.key)!;
    expect(qb2.common).toEqual([{ answer: 'option 0', count: 2 }]);
    expect(m[0].rate).toBe(1);
    expect(mostMissed(rows, catalog, () => '', 3)).toEqual([]);
  });
  it('flags who is stuck: idle for a week, repeated failures, not started', () => {
    const stuck = stuckStudents(S, [
      row('s1', qb.key, { right: false, tries: 3 }, NOW - 8 * 86400000),
      row('s3', pa.key, { right: true, tries: 1 }, NOW - 86400000),
    ], NOW);
    const by = new Map(stuck.map((s) => [s.student.id, s]));
    expect(by.get('s1')?.reasons).toEqual(['idle', 'repeated']);
    expect(by.get('s1')?.idleDays).toBe(8);
    expect(by.get('s2')?.reasons).toEqual(['notStarted']);
    expect(by.has('s3')).toBe(false);
    expect(stuck[0].student.id).toBe('s1');
  });
  it('counts hint usage per exercise', () => {
    const u = hintUsage([row('s1', 'ex:1:e1', { hints: 2 }), row('s2', 'ex:1:e1', { hints: 1 }), row('s3', 'ex:1:e1', { hints: 0 }), row('s1', 'quiz:1:q1', { hints: 5 })]);
    expect(u).toEqual([{ key: 'ex:1:e1', students: 2, hints: 3 }]);
  });
  it('score distribution puts 100 in the last bin and skips nulls', () => {
    expect(distribution([0, 9.9, 10, 55, 99.9, 100, null], 10)).toEqual([2, 1, 0, 0, 0, 1, 0, 0, 0, 2]);
    expect(distribution([], 4)).toEqual([0, 0, 0, 0]);
  });
  it('student timeline and daily buckets come from stored attempt history', () => {
    const t = studentTimeline([row('s1', 'ex:1:e1', { hist: [{ t: NOW, ok: false }, { t: NOW + 1000, ok: true, hint: true }] }), row('s1', 'read:1', {}), row('s1', 'quiz:1:q1', { hist: [{ t: NOW - 5000, ok: true }] })]);
    expect(t.map((e) => e.key)).toEqual(['quiz:1:q1', 'ex:1:e1', 'ex:1:e1']);
    expect(t[2]).toMatchObject({ ok: true, hint: true });
    const days = dailyBuckets(t);
    expect(days.reduce((s, d) => s + d.attempts, 0)).toBe(3);
    expect(days.reduce((s, d) => s + d.right, 0)).toBe(2);
  });
});

describe('integrity notes', () => {
  it('reports pastes, revealed solutions, very fast work and many tab switches, as observations', () => {
    const f = integrityNotes({ secs: 20, blurs: 12 }, [{ key: 'ex:1:e1', pastes: 2 }, { key: 'ex:1:e2', pastes: 0 }], { 'ex:1:e2': { sol: true } }, 2);
    expect(f.map((x) => x.kind).sort()).toEqual(['blur', 'fast', 'paste', 'solution']);
    expect(integrityNotes({ secs: 600 }, [{ key: 'ex:1:e1', pastes: 0 }], {}, 1)).toEqual([]);
    expect(integrityNotes({}, [], {}, 0)).toEqual([]);
  });
});

describe('student side', () => {
  it('status', () => {
    const base = { submitted_at: null, due_at: iso(NOW + 1000), late_seconds: null, visible: false };
    expect(myStatus(base, NOW)).toBe('open');
    expect(myStatus({ ...base, due_at: iso(NOW - 1) }, NOW)).toBe('missed');
    expect(myStatus({ ...base, submitted_at: iso(NOW), late_seconds: 0 }, NOW)).toBe('submitted');
    expect(myStatus({ ...base, submitted_at: iso(NOW), late_seconds: 90 }, NOW)).toBe('late');
    expect(myStatus({ ...base, submitted_at: iso(NOW), late_seconds: 0, visible: true }, NOW)).toBe('returned');
    expect(myStatus({ ...base, due_at: null }, NOW)).toBe('open');
  });
  it('late penalty follows the server rule (per started day, capped)', () => {
    const lp = { mode: 'penalty', per_day: 10, max: 25 };
    expect(latePenaltyNow(iso(NOW + 1), lp, NOW)).toBe(0);
    expect(latePenaltyNow(iso(NOW - 1), lp, NOW)).toBe(10);
    expect(latePenaltyNow(iso(NOW - 86400000 - 1), lp, NOW)).toBe(20);
    expect(latePenaltyNow(iso(NOW - 5 * 86400000), lp, NOW)).toBe(25);
    expect(latePenaltyNow(iso(NOW - 5 * 86400000), { mode: 'accept' }, NOW)).toBe(0);
    expect(latePenaltyNow(null, lp, NOW)).toBe(0);
  });
});

describe('database error mapping', () => {
  it('maps known messages to translation keys', () => {
    expect(teachErr({ message: 'no seats left' }).key).toBe('err.noSeats');
    expect(teachErr({ message: 'the due date has passed' }).key).toBe('err.pastDue');
    expect(teachErr({ message: 'new row violates row-level security policy' }).key).toBe('err.denied');
    expect(teachErr({ message: 'TypeError: Failed to fetch' }).key).toBe('err.offline');
    expect(teachErr({ message: 'something odd' }).key).toBe('err.generic');
  });
});
