import { Fragment, type ReactNode } from 'react';

const TAGS = new Set(['code', 'em', 'strong', 'b', 'i', 'sub', 'sup']);

/**
 * Renders the small HTML subset allowed in lab texts (code, em, strong, b, i, sub, sup, br; no attributes; enforced at build time)
 * as React elements. Anything else, including anything that looks like other tags, is shown as plain text, so this can never inject markup.
 */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const stack: { tag: string; kids: ReactNode[] }[] = [{ tag: '', kids: out }];
  const re = /<(\/?)([a-z]+)\s*(\/?)>/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  const top = () => stack[stack.length - 1].kids;
  while ((m = re.exec(text))) {
    const [all, close, tag, selfClose] = m;
    if (!TAGS.has(tag) && tag !== 'br') continue;
    if (m.index > last) top().push(text.slice(last, m.index));
    last = m.index + all.length;
    if (tag === 'br') { top().push(<br key={k++} />); continue; }
    if (selfClose) continue;
    if (!close) stack.push({ tag, kids: [] });
    else if (stack.length > 1 && stack[stack.length - 1].tag === tag) {
      const done = stack.pop()!;
      const El = tag as 'code';
      top().push(<El key={k++} {...(tag === 'code' ? { dir: 'ltr' as const, className: 'code-inline' } : {})}>{done.kids.map((c, i) => <Fragment key={i}>{c}</Fragment>)}</El>);
    }
  }
  if (last < text.length) top().push(text.slice(last));
  while (stack.length > 1) { const d = stack.pop()!; top().push(...d.kids); }
  return <>{out.map((c, i) => <Fragment key={i}>{c}</Fragment>)}</>;
}
