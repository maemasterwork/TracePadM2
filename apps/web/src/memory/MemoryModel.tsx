import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { tokenize } from '../runner/highlight';
import type { HeapObj, TraceStep, Val } from '../runner/types';

/**
 * The memory model: names (in frames) on the left, objects (the heap) on the right, arrows from names to the objects they point to.
 * Built from the step snapshots that runner.py records with sys.settrace. The diagram is always left-to-right (it shows code);
 * everything around it is translated. Arrows are decoration: every reference is also written as text (#id and type), and a live
 * sentence describes the current step for screen readers.
 */
interface Props { code: string; steps: TraceStep[]; truncated?: boolean; failed?: boolean; maxSteps?: number; onStep?: (i: number) => void }

const isRef = (v: Val): v is { r: number } => 'r' in v;
const isMore = (v: Val): v is { more: true } => 'more' in v;

function ValCell({ v, anchor }: { v: Val; anchor: string }) {
  const { t } = useI18n();
  if (isMore(v)) return <span className="mem-more">{t('mem.more')}</span>;
  if (isRef(v)) return <span className="mem-ref" data-points-to={v.r} data-anchor={anchor} title={`#${v.r}`}>#{v.r}</span>;
  return <code className="mem-prim" title={v.t}>{v.p}</code>;
}

function heapTitle(o: HeapObj, id: number) {
  const name = o.kind === 'function' || o.kind === 'class' ? ` ${o.name ?? ''}` : '';
  return `#${id} ${o.type}${name}`;
}

function ObjBox({ id, o, cls, note }: { id: number; o: HeapObj; cls: string; note?: string }) {
  const { t } = useI18n();
  return (
    <div className={`mem-obj ${cls}`} data-obj={id} data-kind={o.kind}>
      <div className="mem-obj-h">{heapTitle(o, id)}</div>
      {(o.kind === 'list' || o.kind === 'tuple' || o.kind === 'set' || o.kind === 'frozenset') && (
        o.items && o.items.length ? (
          <ol className={'mem-items' + (o.kind === 'set' || o.kind === 'frozenset' ? ' unordered' : '')}>
            {o.items.map((it, i) => <li key={i} {...(o.kind === 'list' || o.kind === 'tuple' ? { 'data-i': i } : {})}><ValCell v={it} anchor={`o${id}.${i}`} /></li>)}
          </ol>
        ) : <span className="mem-empty">{t('mem.empty')}</span>
      )}
      {o.kind === 'dict' && (
        o.pairs && o.pairs.length ? (
          <table className="mem-pairs"><tbody>
            {o.pairs.map((p, i) => 'more' in p
              ? <tr key={i}><td colSpan={2} className="mem-more">{t('mem.more')}</td></tr>
              : <tr key={i}><td><ValCell v={p.k} anchor={`o${id}.k${i}`} /></td><td aria-hidden="true">:</td><td><ValCell v={p.v} anchor={`o${id}.v${i}`} /></td></tr>)}
          </tbody></table>
        ) : <span className="mem-empty">{t('mem.empty')}</span>
      )}
      {o.kind === 'instance' && o.attrs && (
        <table className="mem-pairs"><tbody>
          {o.attrs.map((a, i) => 'more' in a
            ? <tr key={i}><td colSpan={2} className="mem-more">{t('mem.more')}</td></tr>
            : <tr key={i}><th scope="row">{a.name}</th><td><ValCell v={a.v} anchor={`o${id}.a${i}`} /></td></tr>)}
        </tbody></table>
      )}
      {o.kind === 'other' && <code className="mem-prim">{o.repr}</code>}
      {note && <p className="mem-note">{note}</p>}
    </div>
  );
}

export function MemoryModel({ code, steps, truncated, failed, maxSteps, onStep }: Props) {
  const { t, num } = useI18n();
  const uid = useId();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<{ d: string; key: string }[]>([]);
  const n = steps.length;
  const step = steps[Math.min(i, n - 1)];
  const prev = i > 0 ? steps[i - 1] : undefined;

  useEffect(() => { setI(0); setPlaying(false); }, [steps]);
  useEffect(() => { onStep?.(Math.min(i, n - 1)); }, [i, n, onStep]);
  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) { setPlaying(false); return; }
    const h = setTimeout(() => setI((x) => Math.min(x + 1, n - 1)), 1000);
    return () => clearTimeout(h);
  }, [playing, i, n]);

  const lines = useMemo(() => code.split('\n'), [code]);
  const toks = useMemo(() => lines.map((l) => tokenize(l)), [lines]);

  const heapIds = useMemo(() => Object.keys(step?.heap ?? {}).map(Number).sort((a, b) => a - b), [step]);
  const ghosts = useMemo(() => (prev ? step.gone.filter((g) => prev.heap[String(g)] && !step.heap[String(g)]) : []), [prev, step]);

  const status = useMemo(() => {
    if (!step) return '';
    const head = step.event === 'return' ? t('mem.lineReturn', { n: num(step.line) }) : step.event === 'exception' ? t('mem.lineError', { n: num(step.line) }) : t('mem.line', { n: num(step.line) });
    const frame = step.frames[step.frames.length - 1];
    const desc = (v: Val): string => (isMore(v) ? '' : isRef(v) ? (step.heap[String(v.r)] ? t('mem.srRefShort', { type: step.heap[String(v.r)].type, id: num(v.r) }) : `#${v.r}`) : v.p);
    const vars = frame ? frame.vars.map((x) => t('mem.srVar', { name: x.name, v: desc(x.v) })).join('; ') : '';
    return `${t('mem.step', { i: num(i + 1), n: num(n) })}. ${head}. ${frame ? t('mem.srFrame', { name: frame.name === 'Global' ? t('mem.global') : frame.name, vars: vars || t('mem.noNames') }) : ''}${step.returned ? '. ' + t('mem.returned', { v: step.returned }) : ''}`;
  }, [step, i, n, t, num]);

  const draw = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const out: { d: string; key: string }[] = [];
    el.querySelectorAll<HTMLElement>('[data-points-to]').forEach((src) => {
      const target = el.querySelector<HTMLElement>(`.mem-heap [data-obj="${src.dataset.pointsTo}"]`);
      if (!target || src.closest('.mem-ghost')) return;
      const a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
      const stacked = b.left < a.right - 4; // target is not to the right: leave from the bottom, enter at the top or the side
      let x1: number, y1: number, x2: number, y2: number, d: string;
      if (!stacked) {
        x1 = a.right - box.left; y1 = a.top + a.height / 2 - box.top; x2 = b.left - box.left; y2 = Math.min(Math.max(y1, b.top - box.top + 14), b.bottom - box.top - 8);
        const mx = (x1 + x2) / 2; d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      } else {
        x1 = a.right - box.left; y1 = a.top + a.height / 2 - box.top; x2 = b.left + Math.min(28, b.width / 2) - box.left; y2 = b.top - box.top;
        d = `M${x1},${y1} C${x1 + 70},${y1} ${x2 + 10},${y2 - 50} ${x2},${y2}`; // leave to the right, then drop onto the object
      }
      out.push({ d, key: `${src.dataset.anchor}->${src.dataset.pointsTo}` });
    });
    setArrows(out);
  }, []);

  useLayoutEffect(() => { draw(); }, [draw, step, i]);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  if (!step) return <p className="mem-empty">{t('mem.noObjects')}</p>;
  const changed = (id: number) => (prev ? JSON.stringify(prev.heap[String(id)]) !== JSON.stringify(step.heap[String(id)]) : false);
  const isNew = (id: number) => !!prev && !prev.heap[String(id)];

  return (
    <section className="mem" aria-label={t('mem.title')} dir="ltr">
      <p className="mem-help" dir="auto">{t('mem.help')}</p>
      <div className="mem-controls" role="group" aria-label={t('mem.title')} dir="auto">
        <button type="button" className="btn small quiet" onClick={() => { setPlaying(false); setI(0); }} disabled={i === 0} aria-label={t('mem.first')}>⏮</button>
        <button type="button" className="btn small quiet" onClick={() => { setPlaying(false); setI((x) => Math.max(0, x - 1)); }} disabled={i === 0}><span aria-hidden="true">◀ </span>{t('mem.prev')}</button>
        <button type="button" className="btn small" onClick={() => { if (i >= n - 1) setI(0); setPlaying((p) => !p); }} aria-pressed={playing}>{playing ? t('mem.pause') : t('mem.play')}</button>
        <button type="button" className="btn small quiet" onClick={() => { setPlaying(false); setI((x) => Math.min(n - 1, x + 1)); }} disabled={i >= n - 1}>{t('mem.next')}<span aria-hidden="true"> ▶</span></button>
        <button type="button" className="btn small quiet" onClick={() => { setPlaying(false); setI(n - 1); }} disabled={i >= n - 1} aria-label={t('mem.last')}>⏭</button>
        <label htmlFor={uid + '-s'} className="sr-only">{t('mem.slider')}</label>
        <input id={uid + '-s'} type="range" min={0} max={Math.max(n - 1, 0)} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }} aria-valuetext={t('mem.step', { i: num(i + 1), n: num(n) })} style={{ flex: 1, minWidth: 120 }} />
        <span className="chip" aria-hidden="true">{t('mem.step', { i: num(i + 1), n: num(n) })}</span>
      </div>
      <div className="sr-only" role="status" aria-live="polite" dir="auto">{status}</div>
      <div className="mem-grid" ref={wrap}>
        <ol className="mem-code" aria-hidden="true">
          {toks.map((tk, k) => (
            <li key={k} className={k + 1 === step.line ? 'cur' : ''} value={k + 1}>
              <code>{tk.map((x, j) => (x.cls ? <span key={j} className={x.cls}>{x.text}</span> : <Fragment key={j}>{x.text}</Fragment>))}{'\n'}</code>
            </li>
          ))}
        </ol>
        <div className="mem-frames">
          <h4 dir="auto">{t('mem.frames')}</h4>
          {step.frames.length === 0 && <p className="mem-empty" dir="auto">{t('mem.noNames')}</p>}
          {step.frames.map((f, fi) => (
            <div className={'mem-frame' + (fi === step.frames.length - 1 ? ' top' : '')} key={fi}>
              <div className="mem-frame-h">{f.name === 'Global' ? t('mem.global') : f.name + '()'}</div>
              {f.vars.length === 0 ? <span className="mem-empty" dir="auto">{t('mem.noNames')}</span> : (
                <table className="mem-pairs"><tbody>
                  {f.vars.map((v) => <tr key={v.name}><th scope="row">{v.name}</th><td><ValCell v={v.v} anchor={`f${fi}.${v.name}`} /></td></tr>)}
                </tbody></table>)}
            </div>
          ))}
          {step.returned && <p className="mem-returned" dir="auto">{t('mem.returned', { v: step.returned })}</p>}
        </div>
        <div className="mem-heap">
          <h4 dir="auto">{t('mem.objects')}</h4>
          {heapIds.length === 0 && ghosts.length === 0 && <p className="mem-empty" dir="auto">{t('mem.noObjects')}</p>}
          {heapIds.map((id) => <ObjBox key={id} id={id} o={step.heap[String(id)]} cls={(isNew(id) ? 'new ' : '') + (changed(id) && !isNew(id) ? 'changed' : '')} />)}
          {ghosts.map((id) => <div className="mem-ghost" key={'g' + id}><ObjBox id={id} o={prev!.heap[String(id)]} cls="gone" note={t('mem.gone')} /></div>)}
        </div>
        <svg className="mem-arrows" aria-hidden="true" focusable="false">
          <defs><marker id={uid + '-h'} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--wire)" /></marker></defs>
          {arrows.map((a) => <path key={a.key} d={a.d} fill="none" stroke="var(--wire)" strokeWidth="1.6" markerEnd={`url(#${uid}-h)`} />)}
        </svg>
      </div>
      {step.exception && <p className="mem-exc" dir="ltr">{step.exception}</p>}
      {(truncated || failed) && <p className="mem-note" dir="auto">{truncated ? t('mem.truncated', { n: num(maxSteps ?? n) }) : t('mem.failed')}</p>}
    </section>
  );
}
