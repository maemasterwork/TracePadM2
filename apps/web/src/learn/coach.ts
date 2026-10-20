/**
 * Error coach: turns a Python error into a plain explanation and a suggested fix.
 * Matching is on the exception type and message that CPython produced, so it stays right when CPython words things slightly
 * differently. The texts live in the locale files under `coach.<id>.what` and `coach.<id>.fix` (English and Persian).
 */
export interface CoachInput { type: string; message: string; line: number | null }
export interface CoachHit { id: string; params: Record<string, string> }

const R = (type: string, re: RegExp, id: string, pick?: (m: RegExpExecArray) => Record<string, string>) => ({ type, re, id, pick });

const RULES = [
  R('SyntaxError', /unterminated string literal/, 'unterminatedString'),
  R('SyntaxError', /unterminated triple-quoted string/, 'unterminatedTriple'),
  R('SyntaxError', /expected ':'/, 'expectedColon'),
  R('SyntaxError', /was never closed|unmatched '[)\]}]'|closing parenthesis/, 'brackets'),
  R('SyntaxError', /invalid syntax\. Maybe you meant '==' or ':=' instead of '='/, 'assignInCondition'),
  R('SyntaxError', /cannot assign to (.+?)( here|$)/, 'cannotAssign', (m) => ({ what: m[1] })),
  R('SyntaxError', /Missing parentheses in call to 'print'/, 'printParens'),
  R('SyntaxError', /invalid decimal literal|invalid syntax/, 'syntaxGeneric'),
  R('SyntaxError', /.*/, 'syntaxGeneric'),
  R('IndentationError', /expected an indented block/, 'expectedIndent'),
  R('IndentationError', /unexpected indent/, 'unexpectedIndent'),
  R('IndentationError', /unindent does not match/, 'unindentMismatch'),
  R('IndentationError', /.*/, 'indentGeneric'),
  R('TabError', /.*/, 'indentGeneric'),
  R('NameError', /name '(.+)' is not defined/, 'nameNotDefined', (m) => ({ name: m[1] })),
  R('UnboundLocalError', /cannot access local variable '(.+?)'/, 'unboundLocal', (m) => ({ name: m[1] })),
  R('TypeError', /can only concatenate str \(not "(\w+)"\) to str/, 'concatStr', (m) => ({ other: m[1] })),
  R('TypeError', /unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/, 'badOperands', (m) => ({ op: m[1], a: m[2], b: m[3] })),
  R('TypeError', /'(\w+)' object is not subscriptable/, 'notSubscriptable', (m) => ({ type: m[1] })),
  R('TypeError', /'(\w+)' object is not callable/, 'notCallable', (m) => ({ type: m[1] })),
  R('TypeError', /'(\w+)' object is not iterable/, 'notIterable', (m) => ({ type: m[1] })),
  R('TypeError', /'(\w+)' object does not support item assignment/, 'noItemAssign', (m) => ({ type: m[1] })),
  R('TypeError', /(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/, 'argCount', (m) => ({ fn: m[1], want: m[2], got: m[3] })),
  R('TypeError', /(\w+)\(\) missing (\d+) required positional arguments?/, 'argMissing', (m) => ({ fn: m[1], n: m[2] })),
  R('TypeError', /must be str, not (\w+)|argument must be a string|can't multiply sequence by non-int of type '(\w+)'/, 'strNeeded'),
  R('TypeError', /list indices must be integers or slices, not (\w+)|string indices must be integers, not '(\w+)'|tuple indices must be integers or slices, not (\w+)/, 'indexType'),
  R('TypeError', /.*/, 'typeGeneric'),
  R('ValueError', /invalid literal for int\(\) with base 10: (.+)/, 'intLiteral', (m) => ({ text: m[1] })),
  R('ValueError', /could not convert string to float: (.+)/, 'floatLiteral', (m) => ({ text: m[1] })),
  R('ValueError', /not enough values to unpack|too many values to unpack/, 'unpackCount'),
  R('ValueError', /list\.remove\(x\): x not in list|is not in list/, 'notInList'),
  R('ValueError', /.*/, 'valueGeneric'),
  R('IndexError', /.*out of range/, 'indexRange'),
  R('KeyError', /.*/, 'keyMissing', (m) => ({ key: m[0] })),
  R('ZeroDivisionError', /.*/, 'zeroDiv'),
  R('AttributeError', /'(\w+)' object has no attribute '(\w+)'/, 'noAttribute', (m) => ({ type: m[1], attr: m[2] })),
  R('AttributeError', /module '(\w+)' has no attribute '(\w+)'/, 'noAttribute', (m) => ({ type: 'module ' + m[1], attr: m[2] })),
  R('ModuleNotFoundError', /No module named '(.+)'/, 'noModule', (m) => ({ name: m[1] })),
  R('ImportError', /.*/, 'importGeneric'),
  R('FileNotFoundError', /.*/, 'fileMissing'),
  R('RecursionError', /.*/, 'recursion'),
  R('EOFError', /.*/, 'eof'),
  R('OverflowError', /.*/, 'overflow'),
  R('MemoryError', /.*/, 'memory'),
  R('AssertionError', /.*/, 'assertion'),
  R('StopIteration', /.*/, 'stopIteration'),
  R('PermissionError', /.*/, 'permission'),
];

/** Edit distance (with swapped neighbours as one edit) for "did you mean" on NameError (names are short, so the simple version is fine). */
export function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
  {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // swapped neighbours count as one slip
  }
  return d[a.length][b.length];
}

const BUILTINS = ['print', 'input', 'len', 'range', 'int', 'float', 'str', 'list', 'dict', 'set', 'tuple', 'sum', 'min', 'max', 'sorted', 'round', 'abs', 'type', 'open', 'enumerate', 'zip', 'bool'];

/** Names the learner wrote in their own code (assignments, defs, params, for-targets) plus common built-ins. */
export function knownNames(code: string): string[] {
  const names = new Set<string>(BUILTINS);
  for (const m of code.matchAll(/^\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?:=|\+=|-=|\*=|\/=)(?!=)/gm)) m[1].split(',').forEach((n) => names.add(n.trim()));
  for (const m of code.matchAll(/\bdef\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) { names.add(m[1]); m[2].split(',').forEach((p) => { const n = p.split(/[=:]/)[0].trim().replace(/^\*+/, ''); if (n) names.add(n); }); }
  for (const m of code.matchAll(/\bfor\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s+in\b/g)) m[1].split(',').forEach((n) => names.add(n.trim()));
  for (const m of code.matchAll(/\bclass\s+([A-Za-z_]\w*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bimport\s+([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?/g)) names.add(m[2] ?? m[1]);
  return [...names];
}

export function didYouMean(name: string, code: string): string | null {
  let best: string | null = null, bd = 99;
  for (const n of knownNames(code)) {
    if (n === name) continue;
    const dist = n.toLowerCase() === name.toLowerCase() ? 0.5 : distance(n, name);
    const limit = name.length <= 3 ? 1 : 2;
    if (dist <= limit && dist < bd) { best = n; bd = dist; }
  }
  return best;
}

export function coach(err: CoachInput, code = ''): CoachHit | null {
  for (const r of RULES) {
    if (r.type !== err.type) continue;
    const m = r.re.exec(err.message);
    if (!m) continue;
    const params = r.pick ? r.pick(m) : {};
    if (r.id === 'nameNotDefined') { const s = didYouMean(params.name, code); if (s) params.suggest = s; }
    return { id: r.id, params };
  }
  return null;
}

/** Every coach id, so tests and the locale check can verify that both languages have a text for each. */
export const COACH_IDS = [...new Set(RULES.map((r) => r.id))];
