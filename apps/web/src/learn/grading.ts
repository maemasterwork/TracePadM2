import type { ExTest, Exercise, Prediction } from './types';

/** Same marker the build-time checker (tools/content/check_labs.py) uses, so the browser grades exactly what CPython was checked against. */
export const MARK = '\u0001TRACEPAD-MARK\u0001';

export const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
export const lineTrim = (s: string) => s.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\s+$/, '');

/** Does the learner's guess equal the stored (CPython-verified) output? Whitespace-insensitive unless the item says `exact`. */
export function predictionMatches(guess: string, p: Pick<Prediction, 'answer' | 'exact'>): boolean {
  return p.exact ? lineTrim(guess) === lineTrim(p.answer) : collapse(guess) === collapse(p.answer);
}

export function buildTestCode(ex: Pick<Exercise, 'param'>, userCode: string, tc: ExTest): { code: string; paramMatched: boolean } {
  let code = userCode;
  let paramMatched = true;
  if (tc.set != null && ex.param) {
    const flags = (ex.param.flags ?? '').replace(/[^im]/g, '');
    // Python's re and JS RegExp agree on the patterns the content uses; the build check runs the same text through Python.
    const re = new RegExp(ex.param.pattern, flags);
    const set = tc.set;
    paramMatched = re.test(code);
    code = code.replace(re, () => set);
  }
  if (tc.post) code += `\nprint(${JSON.stringify(MARK)})\n` + tc.post + '\n';
  return { code, paramMatched };
}

export function afterMark(out: string, tc: ExTest): string {
  if (!tc.post) return out;
  const i = out.lastIndexOf(MARK + '\n');
  return i >= 0 ? out.slice(i + MARK.length + 1) : out;
}

export interface TestOutcome { index: number; hidden: boolean; pass: boolean; got: string; want: string; error?: string; paramMissing?: boolean; timedOut?: boolean }

export function judge(ex: Pick<Exercise, 'param'>, tc: ExTest, index: number, run: { ok: boolean; stdout: string; error?: { type: string; message: string; line: number | null } | null; timedOut?: boolean }, paramMatched: boolean): TestOutcome {
  const got = lineTrim(afterMark(run.stdout, tc));
  const want = lineTrim(tc.out);
  const pass = run.ok && got === want;
  return {
    index, hidden: !!tc.hidden, pass, got, want,
    error: run.error ? `${run.error.type}: ${run.error.message}` : undefined,
    paramMissing: !paramMatched && tc.set != null,
    timedOut: run.timedOut,
  };
}

/** The first line of a diff between expected and actual output, for a short plain message. */
export function firstDifference(want: string, got: string): { line: number; want: string; got: string } | null {
  const w = want.split('\n'), g = got.split('\n');
  for (let i = 0; i < Math.max(w.length, g.length); i++) if ((w[i] ?? '') !== (g[i] ?? '')) return { line: i + 1, want: w[i] ?? '', got: g[i] ?? '' };
  return null;
}

/** Hints reveal in order. The model solution is offered only once every hint has been shown. */
export function hintState(ex: Pick<Exercise, 'hints'>, shown: number) {
  const total = ex.hints.length;
  return { total, shown: Math.min(shown, total), canShowHint: shown < total, canShowSolution: shown >= total };
}
/** Level names for the 2 to 4 hints of an exercise: first is always a nudge, last (when there are 3+) the near-solution. */
export function hintLevel(total: number, i: number): 'nudge' | 'strategy' | 'near' {
  if (i === 0) return 'nudge';
  if (i === total - 1 && total >= 3) return 'near';
  return 'strategy';
}
