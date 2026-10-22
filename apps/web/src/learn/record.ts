import type { ProgressStore } from '../sync/queue';
import { pushAttempt } from './mastery';
import { afterAnswer, revKey, type RevState } from './srs';
import type { Attempt, Exercise, Labs, Prediction, Quiz } from './types';

export type ItemKind = 'pred' | 'quiz' | 'ex';
export const itemKey = (kind: ItemKind, ch: number | string, id: string) => `${kind}:${ch}:${id}`;

export interface IndexedItem { key: string; kind: ItemKind; ch: number; id: string; tag?: string; guess: number; pred?: Prediction; quiz?: Quiz; ex?: Exercise }

/** Every practice item of a lesson by its progress key. */
export function indexLabs(labs: Labs): Map<string, IndexedItem> {
  const m = new Map<string, IndexedItem>();
  for (const [chs, c] of Object.entries(labs.chapters)) {
    const ch = Number(chs);
    for (const p of c.predictions ?? []) m.set(itemKey('pred', ch, p.id), { key: itemKey('pred', ch, p.id), kind: 'pred', ch, id: p.id, tag: p.tag, guess: 0.1, pred: p });
    for (const q of c.quizzes ?? []) m.set(itemKey('quiz', ch, q.id), { key: itemKey('quiz', ch, q.id), kind: 'quiz', ch, id: q.id, tag: q.tag, guess: 1 / q.options.length, quiz: q });
    for (const e of c.exercises ?? []) m.set(itemKey('ex', ch, e.id), { key: itemKey('ex', ch, e.id), kind: 'ex', ch, id: e.id, guess: 0.05, ex: e });
  }
  return m;
}

type Data = Record<string, unknown>;
const asHist = (d: Data | undefined) => (Array.isArray(d?.hist) ? (d!.hist as Attempt[]) : []);

/**
 * Save the outcome of answering a prediction or quiz question: the item row (latest result and a short history, which
 * feeds the mastery model) and, when the answer was wrong (or it is already on the watch-list), the review schedule.
 */
export async function recordAnswer(store: ProgressStore, kind: 'pred' | 'quiz', ch: number, id: string, ok: boolean, extra: Data, now = Date.now(), hint = false): Promise<void> {
  const key = itemKey(kind, ch, id);
  const prev = (await store.get(key))?.data;
  const tries = (typeof prev?.tries === 'number' ? prev.tries : 0) + 1;
  await store.save(key, { ...extra, right: ok, tries, hist: pushAttempt(asHist(prev), { t: now, ok, ...(hint ? { hint: true } : {}) }) });
  const prevRev = (await store.get(revKey(key)))?.data as unknown as RevState | undefined;
  const next = afterAnswer(prevRev, ok, hint, now);
  if (next) await store.save(revKey(key), next as unknown as Data);
}

/** Save one Check of an exercise. attempts and hints only ever go up (the server takes the larger value). */
export async function recordExercise(store: ProgressStore, ch: number, id: string, o: { pass: boolean; passed: number; total: number; code: string; hints: number; secs: number; usedSolution?: boolean; pastes?: number }, now = Date.now()): Promise<void> {
  const key = itemKey('ex', ch, id);
  const prev = (await store.get(key))?.data;
  const attempts = (typeof prev?.attempts === 'number' ? prev.attempts : 0) + 1;
  const wasPass = prev?.pass === true;
  await store.save(key, {
    pass: wasPass || o.pass, attempts, hints: Math.max(o.hints, typeof prev?.hints === 'number' ? prev.hints : 0),
    code: o.code.slice(0, 8000), secs: Math.max(o.secs, typeof prev?.secs === 'number' ? prev.secs : 0),
    ...(o.usedSolution || prev?.sol ? { sol: true } : {}),
    // pastes into the editor, counted across visits (an observation for teachers, never a penalty)
    ...((o.pastes ?? 0) > 0 || typeof prev?.pastes === 'number' ? { pastes: (typeof prev?.pastes === 'number' ? prev.pastes : 0) + (o.pastes ?? 0) } : {}),
    last: { passed: o.passed, total: o.total },
    hist: pushAttempt(asHist(prev), { t: now, ok: o.pass, ...(o.hints > 0 ? { hint: true } : {}) }),
  });
}

/** Timestamps of everything the learner did, for the streak. */
export function activityTimes(rows: { key: string; data: Data }[]): number[] {
  const out: number[] = [];
  for (const r of rows) {
    if (!/^(pred|quiz|ex):/.test(r.key)) continue;
    for (const a of asHist(r.data)) out.push(a.t);
  }
  for (const r of rows) if (r.key.startsWith('rev:') && typeof r.data.last === 'number') out.push(r.data.last);
  return out;
}
