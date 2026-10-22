import { useMemo, useRef } from 'react';
import { tokenize } from './highlight';

/** A code editor that is a plain <textarea> (so every device keyboard, IME and screen reader works) with a highlighted copy behind it. */
export function Editor({ value, onChange, label, onRun, readOnly, onPaste }: { value: string; onChange?: (v: string) => void; label: string; onRun?: () => void; readOnly?: boolean; onPaste?: (chars: number) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const toks = useMemo(() => tokenize(value), [value]);
  const sync = () => { if (preRef.current && taRef.current) { preRef.current.scrollLeft = taRef.current.scrollLeft; preRef.current.scrollTop = taRef.current.scrollTop; } };
  const lines = Math.max(value.split('\n').length, 2);
  return (
    <div className="editor">
      <pre ref={preRef} aria-hidden="true" style={{ overflow: 'hidden' }}><code>{toks.map((k, i) => (k.cls ? <span key={i} className={k.cls}>{k.text}</span> : k.text))}{'\n'}</code></pre>
      <textarea
        ref={taRef} value={value} rows={lines} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" wrap="off" readOnly={readOnly}
        aria-label={label} onScroll={sync} onPaste={(e) => onPaste?.(e.clipboardData?.getData('text')?.length ?? 0)} onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => { if (onRun && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); } }}
        style={{ overflowX: 'auto', overflowY: 'hidden' }}
      />
    </div>
  );
}
