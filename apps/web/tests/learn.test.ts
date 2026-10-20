import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COACH_IDS, coach, didYouMean, distance } from '../src/learn/coach';
import { MARK, afterMark, buildTestCode, collapse, firstDifference, hintLevel, hintState, judge, predictionMatches } from '../src/learn/grading';
import { P_INIT, SOLID, bktStep, levelOf, masteryByTag, masteryOf, pushAttempt } from '../src/learn/mastery';
import { DAY, afterAnswer, dayKey, dueItems, streak } from '../src/learn/srs';
import type { Labs } from '../src/learn/types';
import en from '../src/i18n/locales/en.json';
import fa from '../src/i18n/locales/fa.json';

const labs = JSON.parse(readFileSync(join(process.cwd(), 'public/content/01-objects-and-data-structures/labs.json'), 'utf8')) as Labs;

describe('prediction grading', () => {
  it('ignores whitespace differences unless exact', () => {
    expect(predictionMatches('3.5  3\n1 ', { answer: '3.5 3 1' })).toBe(true);
    expect(predictionMatches('a b', { answer: 'a\nb', exact: true })).toBe(false);
    expect(predictionMatches('a\nb  \n', { answer: 'a\nb', exact: true })).toBe(true);
    expect(predictionMatches('4', { answer: '3' })).toBe(false);
  });
  it('collapse', () => expect(collapse('  a \n b\t')).toBe('a b'));
});

describe('exercise tests', () => {
  const all = Object.entries(labs.chapters).flatMap(([ch, c]) => (c.exercises ?? []).map((e) => ({ ch, e })));
  it('every param pattern compiles in JavaScript and matches the model solution', () => {
    for (const { ch, e } of all) {
      if (!e.param) continue;
      const flags = (e.param.flags ?? '').replace(/[^im]/g, '');
      const re = new RegExp(e.param.pattern, flags);
      expect(re.test(e.solution), `ex ${ch}:${e.id} pattern must match its own solution`).toBe(true);
      expect(re.test(e.starter), `ex ${ch}:${e.id} pattern must match the starter, or learners lose the variant line`).toBe(true);
    }
  });
  it('builds test code with the set value and a marker for post checks', () => {
    const withSet = all.find(({ e }) => e.tests.some((t) => t.set != null))!;
    const tc = withSet.e.tests.find((t) => t.set != null)!;
    const { code, paramMatched } = buildTestCode(withSet.e, withSet.e.solution, tc);
    expect(paramMatched).toBe(true);
    expect(code).toContain(tc.set!);
    const post = all.find(({ e }) => e.tests.some((t) => t.post))!;
    const pt = post.e.tests.find((t) => t.post)!;
    const b = buildTestCode(post.e, post.e.solution, pt).code;
    expect(b).toContain('TRACEPAD-MARK');
    expect(afterMark(`noise\n${MARK}\nreal`, pt)).toBe('real');
  });
  it('judge: pass needs a clean run and equal output', () => {
    const tc = { out: 'x\n' };
    expect(judge({}, tc, 0, { ok: true, stdout: 'x\n  \n' }, true).pass).toBe(true);
    expect(judge({}, tc, 0, { ok: false, stdout: 'x\n', error: { type: 'NameError', message: 'm', line: 1 } }, true).pass).toBe(false);
    expect(judge({}, { out: 'a', set: '1' }, 0, { ok: true, stdout: 'a' }, false).paramMissing).toBe(true);
  });
  it('firstDifference', () => {
    expect(firstDifference('a\nb', 'a\nc')).toEqual({ line: 2, want: 'b', got: 'c' });
    expect(firstDifference('a', 'a')).toBeNull();
  });
  it('hints unlock the solution only after all of them', () => {
    const ex = { hints: [{ en: 'a' }, { en: 'b' }, { en: 'c' }] };
    expect(hintState(ex, 2).canShowSolution).toBe(false);
    expect(hintState(ex, 3).canShowSolution).toBe(true);
    expect([0, 1, 2].map((i) => hintLevel(3, i))).toEqual(['nudge', 'strategy', 'near']);
    expect([0, 1].map((i) => hintLevel(2, i))).toEqual(['nudge', 'strategy']);
  });
});

describe('mastery (BKT)', () => {
  const ev = (ok: boolean, t: number, guess = 0.25, hint = false) => ({ ok, t, guess, hint });
  it('rises with correct answers and falls with wrong ones', () => {
    const up = [1, 2, 3, 4].reduce((p) => bktStep(p, { ok: true, guess: 0.25 }), P_INIT);
    expect(up).toBeGreaterThan(SOLID);
    expect(bktStep(0.9, { ok: false, guess: 0.25 })).toBeLessThan(0.9);
    expect(bktStep(0.5, { ok: false, guess: 0.25 })).toBeLessThan(bktStep(0.5, { ok: true, guess: 0.25 }));
  });
  it('a hinted answer is only a learning step, never evidence', () => {
    expect(bktStep(0.5, { ok: false, hint: true, guess: 0.25 })).toBe(bktStep(0.5, { ok: true, hint: true, guess: 0.25 }));
    expect(bktStep(0.5, { ok: true, hint: true, guess: 0.25 })).toBeCloseTo(0.5 + 0.5 * 0.15, 10);
  });
  it('order of evidence matters but input order does not', () => {
    const a = [ev(true, 1), ev(false, 2), ev(true, 3)];
    expect(masteryOf([a[2], a[0], a[1]])).toBeCloseTo(masteryOf(a), 12);
  });
  it('guessing a 2-option quiz proves less than a typed prediction', () => {
    expect(bktStep(0.3, { ok: true, guess: 0.5 })).toBeLessThan(bktStep(0.3, { ok: true, guess: 0.1 }));
  });
  it('derives per-tag mastery from item histories, merging items of the same tag', () => {
    const rows = [
      { key: 'pred:1:p1', data: { hist: [{ t: 1, ok: false }, { t: 5, ok: true }] } },
      { key: 'quiz:1:q1', data: { hist: [{ t: 3, ok: true }] } },
      { key: 'pred:1:p2', data: { hist: [{ t: 2, ok: true }] } },
      { key: 'read:1', data: {} },
    ];
    const info = (k: string) => (k === 'pred:1:p2' ? { tag: 'b', guess: 0.1 } : k.startsWith('pred') || k.startsWith('quiz') ? { tag: 'a', guess: 0.25 } : undefined);
    const m = masteryByTag(rows, info);
    expect(m.map((x) => x.tag).sort()).toEqual(['a', 'b']);
    expect(m.find((x) => x.tag === 'a')!.n).toBe(3);
    expect(levelOf(0.9, 3)).toBe('solid'); expect(levelOf(0.6, 3)).toBe('growing'); expect(levelOf(0.9, 0)).toBe('new');
  });
  it('histories stay short', () => {
    let h: { t: number; ok: boolean }[] = [];
    for (let i = 0; i < 30; i++) h = pushAttempt(h, { t: i, ok: true });
    expect(h).toHaveLength(12); expect(h[0].t).toBe(18);
  });
});

describe('spaced review', () => {
  const T = 1_000_000_000_000;
  it('a first-time correct answer is not tracked; a wrong one is, due tomorrow', () => {
    expect(afterAnswer(undefined, true, false, T)).toBeUndefined();
    expect(afterAnswer(undefined, false, false, T)).toEqual({ box: 0, due: T + DAY, last: T, lapses: 1 });
  });
  it('right moves up the ladder, wrong drops to box 0, hint holds', () => {
    let s = afterAnswer(undefined, false, false, T)!;
    s = afterAnswer(s, true, false, T + DAY)!; expect(s.box).toBe(1); expect(s.due).toBe(T + DAY + 3 * DAY);
    const held = afterAnswer(s, true, true, T + 5 * DAY)!; expect(held.box).toBe(1); expect(held.due).toBe(s.due);
    s = afterAnswer(s, false, false, T + 5 * DAY)!; expect(s.box).toBe(0); expect(s.lapses).toBe(2);
  });
  it('graduates after the top box is answered right', () => {
    let s: import('../src/learn/srs').RevState | undefined = { box: 5, due: T, last: T, lapses: 1 };
    s = afterAnswer(s, true, false, T + DAY)!; expect(s.done).toBe(true);
    expect(dueItems([{ key: 'rev:pred:1:p1', data: s }], T + 99 * DAY)).toEqual([]);
  });
  it('due items are the overdue ones, oldest first, capped', () => {
    const rows = [
      { key: 'rev:pred:1:a', data: { due: T + 5, done: false } },
      { key: 'rev:pred:1:b', data: { due: T + 1, done: false } },
      { key: 'rev:pred:1:c', data: { due: T + 99, done: false } },
      { key: 'pred:1:a', data: {} },
    ];
    expect(dueItems(rows, T + 10)).toEqual(['pred:1:b', 'pred:1:a']);
    expect(dueItems(rows, T + 100, 2)).toEqual(['pred:1:b', 'pred:1:a']);
  });
  it('streak counts local days back from today or yesterday, never resets by the clock alone', () => {
    const now = new Date(2026, 9, 20, 15).getTime();
    const d = (n: number) => new Date(2026, 9, 20 - n, 10).getTime();
    expect(streak([d(0), d(1), d(2), d(4)], now)).toMatchObject({ current: 3, best: 3, todayDone: true });
    expect(streak([d(1), d(2)], now)).toMatchObject({ current: 2, todayDone: false });
    expect(streak([d(3)], now).current).toBe(0);
    expect(streak([], now)).toEqual({ current: 0, best: 0, todayDone: false });
    expect(dayKey(d(0))).toBe('2026-10-20');
  });
});

describe('error coach', () => {
  const c = (type: string, message: string, code = '') => coach({ type, message, line: 1 }, code);
  it('recognises the common beginner errors', () => {
    expect(c('NameError', "name 'prnt' is not defined", "prnt('x')")).toMatchObject({ id: 'nameNotDefined', params: { name: 'prnt', suggest: 'print' } });
    expect(c('NameError', "name 'Total' is not defined", 'total = 1\nprint(Total)')!.params.suggest).toBe('total');
    expect(c('SyntaxError', "expected ':'")!.id).toBe('expectedColon');
    expect(c('SyntaxError', "unterminated string literal (detected at line 1)")!.id).toBe('unterminatedString');
    expect(c('SyntaxError', "'(' was never closed")!.id).toBe('brackets');
    expect(c('IndentationError', 'expected an indented block after \'if\' statement on line 1')!.id).toBe('expectedIndent');
    expect(c('TypeError', 'can only concatenate str (not "int") to str')).toMatchObject({ id: 'concatStr', params: { other: 'int' } });
    expect(c('TypeError', "unsupported operand type(s) for +: 'int' and 'str'")).toMatchObject({ id: 'badOperands', params: { a: 'int', b: 'str' } });
    expect(c('TypeError', "'int' object is not subscriptable")!.id).toBe('notSubscriptable');
    expect(c('TypeError', "'str' object does not support item assignment")!.id).toBe('noItemAssign');
    expect(c('TypeError', 'f() takes 1 positional argument but 2 were given')).toMatchObject({ id: 'argCount', params: { fn: 'f', want: '1', got: '2' } });
    expect(c('ValueError', "invalid literal for int() with base 10: 'abc'")!.id).toBe('intLiteral');
    expect(c('IndexError', 'list index out of range')!.id).toBe('indexRange');
    expect(c('KeyError', "'x'")).toMatchObject({ id: 'keyMissing', params: { key: "'x'" } });
    expect(c('ZeroDivisionError', 'division by zero')!.id).toBe('zeroDiv');
    expect(c('AttributeError', "'list' object has no attribute 'add'")).toMatchObject({ id: 'noAttribute', params: { type: 'list', attr: 'add' } });
    expect(c('RecursionError', 'maximum recursion depth exceeded')!.id).toBe('recursion');
    expect(c('FileNotFoundError', "[Errno 44] No such file or directory: 'x.txt'")!.id).toBe('fileMissing');
  });
  it('unknown exception types get no coach (the raw message is still shown)', () => expect(c('WeirdError', 'x')).toBeNull());
  it('edit distance and suggestions', () => {
    expect(distance('kitten', 'sitting')).toBe(3);
    expect(didYouMean('lenght', 'x = [1]')).toBeNull(); // 'length' is not a name in the code or a builtin here
    expect(didYouMean('lne', 'print(1)\nlen')).toBe('len');
  });
  it('every coach id has English and Persian text for what and fix', () => {
    for (const id of COACH_IDS) for (const part of ['what', 'fix']) {
      expect((en as Record<string, string>)[`coach.${id}.${part}`], `en coach.${id}.${part}`).toBeTruthy();
      expect((fa as Record<string, string>)[`coach.${id}.${part}`], `fa coach.${id}.${part}`).toBeTruthy();
    }
  });
});
