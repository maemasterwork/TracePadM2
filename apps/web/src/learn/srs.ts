/**
 * Spaced review: a Leitner ladder for the learner's watch-list.
 *
 * An item (a prediction or a quiz question) joins the watch-list the first time it is answered wrong.
 * Each review that is answered right moves it up one box; wrong moves it back to box 0.
 *   box:      0     1     2     3      4      5
 *   due after 1 day 3 d   7 d   16 d   35 d   (graduated after box 5 is answered right)
 * Items answered right with a hint do not move (the hint did the work). The state lives in a row `rev:<item key>`
 * ({box, due, last, lapses, done}); `due` and `last` are milliseconds. Nothing here shames: there are no penalties
 * for skipping days, items simply wait until the learner returns.
 */
export const DAY = 86_400_000;
export const INTERVALS_DAYS = [1, 3, 7, 16, 35];
export const TOP_BOX = INTERVALS_DAYS.length; // 5: answering right here graduates the item

export interface RevState { box: number; due: number; last: number; lapses: number; done?: boolean }

export const revKey = (itemKey: string) => 'rev:' + itemKey;
export const itemKeyOfRev = (key: string) => key.slice(4);

export function afterAnswer(prev: RevState | undefined, ok: boolean, hint: boolean, now: number): RevState | undefined {
  if (!prev) {
    // First time seen: only a wrong answer starts tracking it.
    return ok ? undefined : { box: 0, due: now + INTERVALS_DAYS[0] * DAY, last: now, lapses: 1 };
  }
  if (!ok) return { box: 0, due: now + INTERVALS_DAYS[0] * DAY, last: now, lapses: prev.lapses + 1, done: false };
  if (hint) return { ...prev, last: now };
  if (prev.box >= TOP_BOX) return { ...prev, last: now, done: true };
  const box = prev.box + 1;
  return { box, due: now + (INTERVALS_DAYS[Math.min(box, INTERVALS_DAYS.length - 1)]) * DAY, last: now, lapses: prev.lapses, done: false };
}

export interface ReviewRow { key: string; data: Partial<RevState> }

export function dueItems(rows: ReviewRow[], now: number, limit = 10): string[] {
  return rows
    .filter((r) => r.key.startsWith('rev:') && !r.data.done && typeof r.data.due === 'number' && r.data.due <= now)
    .sort((a, b) => (a.data.due as number) - (b.data.due as number))
    .slice(0, limit)
    .map((r) => itemKeyOfRev(r.key));
}

export function watchCount(rows: ReviewRow[]): { waiting: number; due: number } {
  const open = rows.filter((r) => r.key.startsWith('rev:') && !r.data.done);
  return { waiting: open.length, due: open.filter((r) => (r.data.due as number) <= Date.now()).length };
}

/** Local calendar day as YYYY-MM-DD (the learner's own midnight, not UTC). */
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Streak = consecutive local days with any learning activity, counted back from today (or from yesterday if today has none yet,
 * so the number never drops to zero just because the day is not over). Derived from answer histories: nothing to reset.
 */
export function streak(activity: number[], now: number): { current: number; best: number; todayDone: boolean } {
  const days = new Set(activity.map(dayKey));
  const todayDone = days.has(dayKey(now));
  const step = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() - n); return dayKey(d.getTime()); };
  let current = 0;
  for (let n = todayDone ? 0 : 1; days.has(step(now, n)); n++) current++;
  const sorted = [...days].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    if (prev) { const a = new Date(prev + 'T12:00:00'); a.setDate(a.getDate() + 1); run = dayKey(a.getTime()) === d ? run + 1 : 1; } else run = 1;
    best = Math.max(best, run); prev = d;
  }
  return { current, best, todayDone };
}
