/**
 * Mastery model: Bayesian Knowledge Tracing (Corbett and Anderson, 1994), one hidden "knows this concept" probability per concept tag.
 *
 *   P(L0)  = 0.25   the learner may already know it
 *   P(T)   = 0.15   chance of learning it from one more opportunity
 *   P(S)   = 0.10   slip: knows it but answers wrong
 *   P(G)   = per item kind: guessing a quiz is 1/options, a typed prediction is hard to guess (0.10)
 *
 * After each answer: update P(L) by Bayes' rule given right/wrong, then apply the learning step P(L) += (1-P(L)) * P(T).
 * An answer given after the learner opened a hint counts only as a learning opportunity (no evidence either way),
 * so using hints is never punished and never inflates mastery.
 *
 * Mastery is *derived*: it is recomputed from the answer histories stored in the learner's progress rows, ordered by time.
 * There is no stored mastery number to get out of sync between devices.
 *
 * Levels shown to learners: >= 0.85 "solid", 0.5 to 0.85 "growing", below 0.5 "new" (or "needs review" when the latest answer was wrong).
 */
import type { Attempt } from './types';

export const P_INIT = 0.25;
export const P_LEARN = 0.15;
export const P_SLIP = 0.1;
export const SOLID = 0.85;
export const GROWING = 0.5;

export interface Evidence { t: number; ok: boolean; hint?: boolean; guess: number }

export function bktStep(p: number, ev: { ok: boolean; hint?: boolean; guess: number }): number {
  let posterior = p;
  if (!ev.hint) {
    const g = ev.guess, s = P_SLIP;
    posterior = ev.ok
      ? (p * (1 - s)) / (p * (1 - s) + (1 - p) * g)
      : (p * s) / (p * s + (1 - p) * (1 - g));
  }
  return posterior + (1 - posterior) * P_LEARN;
}

export function masteryOf(evidence: Evidence[]): number {
  return [...evidence].sort((a, b) => a.t - b.t).reduce((p, e) => bktStep(p, e), P_INIT);
}

export type Level = 'new' | 'growing' | 'solid';
export const levelOf = (p: number, n: number): Level => (n === 0 || p < GROWING ? 'new' : p >= SOLID ? 'solid' : 'growing');

export interface ItemRow { key: string; data: { hist?: Attempt[]; right?: boolean } }
/** Tag lookup for a progress key like `pred:3:p1`. Returns the concept tag and the chance of guessing right. */
export type TagInfo = (key: string) => { tag: string; guess: number } | undefined;

export interface TagMastery { tag: string; p: number; n: number; level: Level; lastOk: boolean | null; lastAt: number }

export function masteryByTag(rows: ItemRow[], info: TagInfo): TagMastery[] {
  const by = new Map<string, Evidence[]>();
  for (const r of rows) {
    const i = info(r.key);
    if (!i) continue;
    const list = by.get(i.tag) ?? [];
    for (const a of r.data.hist ?? []) list.push({ t: a.t, ok: a.ok, hint: a.hint, guess: i.guess });
    by.set(i.tag, list);
  }
  return [...by].map(([tag, ev]) => {
    const sorted = [...ev].sort((a, b) => a.t - b.t);
    const p = masteryOf(sorted);
    const last = sorted[sorted.length - 1];
    return { tag, p, n: sorted.length, level: levelOf(p, sorted.length), lastOk: last ? last.ok : null, lastAt: last?.t ?? 0 };
  }).sort((a, b) => a.p - b.p || a.tag.localeCompare(b.tag));
}

/** Keep histories short: the last 12 attempts per item are plenty for the model and keep rows small. */
export const HIST_MAX = 12;
export const pushAttempt = (hist: Attempt[] | undefined, a: Attempt): Attempt[] => [...(hist ?? []), a].slice(-HIST_MAX);
