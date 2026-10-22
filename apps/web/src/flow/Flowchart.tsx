import { useEffect, useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { nodeForLine, labelPos, visitCounts } from './lib';
import type { FlowChart, FlowEdge, FlowEntry, FlowNode, OutlineItem } from './types';

interface Props {
  entry: FlowEntry;
  /** Source line of the step the tracer is showing (null = no trace). */
  currentLine?: number | null;
  /** Source lines of every step up to and including the current one. */
  history?: number[];
}

function Outline({ items }: { items: OutlineItem[] }) {
  return (
    <ol>
      {items.map((it, i) => (
        <li key={i}>{it.text}{it.children && <Outline items={it.children} />}</li>
      ))}
    </ol>
  );
}

function shape(n: FlowNode) {
  const { x, y, w, h } = n;
  const l = x - w / 2, r = x + w / 2, t = y, b = y + h, cy = y + h / 2;
  switch (n.kind) {
    case 'start': case 'end': case 'return': case 'break': case 'continue':
      return <rect x={l} y={t} width={w} height={h} rx={h / 2} />;
    case 'io': {
      const s = 14;
      return <polygon points={`${l + s},${t} ${r},${t} ${r - s},${b} ${l},${b}`} />;
    }
    case 'decision': return <polygon points={`${x},${t} ${r},${cy} ${x},${b} ${l},${cy}`} />;
    case 'loop': {
      const s = 22;
      return <polygon points={`${l + s},${t} ${r - s},${t} ${r},${cy} ${r - s},${b} ${l + s},${b} ${l},${cy}`} />;
    }
    case 'merge': return <circle cx={x} cy={cy} r={5} />;
    case 'define': return <><rect x={l} y={t} width={w} height={h} rx={4} /><line x1={l + 10} y1={t} x2={l + 10} y2={b} /><line x1={r - 10} y1={t} x2={r - 10} y2={b} /></>;
    default: return <rect x={l} y={t} width={w} height={h} rx={6} />;
  }
}

function path(e: FlowEdge, mx: (x: number) => number) {
  return e.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${mx(x)} ${y}`).join(' ');
}

export function ChartView({ chart, currentLine, history, arrowId }: { chart: FlowChart; currentLine?: number | null; history?: number[]; arrowId: string }) {
  const { dir, t } = useI18n();
  const rtl = dir === 'rtl';
  const mx = (x: number) => (rtl ? chart.w - x : x);
  const cur = useMemo(() => nodeForLine(chart, currentLine), [chart, currentLine]);
  const counts = useMemo(() => (history?.length ? visitCounts(chart, history) : null), [chart, history]);
  const outId = useId();
  return (
    <figure className="flow-fig">
      <figcaption>{chart.title}</figcaption>
      <div className="flow-scroll" tabIndex={0} role="region" aria-label={t('flow.regionLabel', { title: chart.title })}>
        <svg className="flow" width="100%" style={{ maxWidth: chart.w, minWidth: Math.round(chart.w * 0.78), aspectRatio: `${chart.w} / ${chart.h}` }} viewBox={`0 0 ${chart.w} ${chart.h}`} role="img" aria-label={t('flow.svgLabel', { title: chart.title })} aria-describedby={outId} focusable="false">
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="flow-arrow" /></marker>
          </defs>
          <g className="flow-edges">
            {chart.edges.map((e, i) => {
              const lp = e.label ? labelPos(e.pts) : null;
              return (
                <g key={i}>
                  <path d={path(e, mx)} className={'flow-edge' + (e.dashed ? ' dashed' : '') + (e.back ? ' back' : '')} markerEnd={`url(#${arrowId})`} />
                  {lp && e.label && <text x={mx(lp.x)} y={lp.y} className="flow-elabel" textAnchor={rtl ? (lp.anchor === 'start' ? 'end' : 'middle') : lp.anchor}>{e.label}</text>}
                </g>
              );
            })}
          </g>
          <g className="flow-nodes">
            {chart.nodes.map((n) => {
              const nn = { ...n, x: mx(n.x) };
              const on = cur?.id === n.id;
              const seen = !on && !!counts?.has(n.id);
              const count = counts?.get(n.id) ?? 0;
              const lh = 17;
              const codeLines = n.kind === 'group' && n.code ? n.code.split('\n') : [];
              const textLines = n.kind === 'merge' ? [] : n.text;
              const total = textLines.length + codeLines.length;
              const y0 = n.y + n.h / 2 - ((total - 1) * lh) / 2;
              return (
                <g key={n.id} className={`flow-node k-${n.kind}${on ? ' on' : ''}${seen ? ' seen' : ''}`} data-node={n.id} data-on={on || undefined} aria-hidden="true">
                  {shape(nn)}
                  {textLines.map((s, i) => <text key={i} x={nn.x} y={y0 + i * lh} textAnchor="middle" dominantBaseline="central" className="flow-text">{s}</text>)}
                  {codeLines.map((s, i) => <text key={'c' + i} x={nn.x - n.w / 2 + 12} y={y0 + (textLines.length + i) * lh} dominantBaseline="central" className="flow-code" direction="ltr">{s}</text>)}
                  {count > 1 && <text x={nn.x + n.w / 2 - 6} y={n.y + 12} textAnchor="end" className="flow-count">×{count}</text>}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{cur ? t('flow.now', { step: cur.text.join(' ') }) : ''}</div>
      <details className="flow-outline" id={outId}>
        <summary>{t('flow.textVersion')}</summary>
        <Outline items={chart.outline} />
      </details>
    </figure>
  );
}

export function Flowchart({ entry, currentLine, history }: Props) {
  const { t } = useI18n();
  const base = useId().replace(/:/g, '');
  const [help, setHelp] = useState(false);
  useEffect(() => { if (currentLine) setHelp(false); }, [currentLine]);
  return (
    <div className="flow-wrap">
      {entry.charts.map((c, i) => <ChartView key={i} chart={c} currentLine={currentLine} history={history} arrowId={`${base}-a${i}`} />)}
      <p className="flow-help">
        <button type="button" className="btn small quiet" aria-expanded={help} onClick={() => setHelp((v) => !v)}>{t('flow.howToRead')}</button>
      </p>
      {help && (
        <ul className="flow-legend">
          <li>{t('flow.legendStart')}</li>
          <li>{t('flow.legendBox')}</li>
          <li>{t('flow.legendIo')}</li>
          <li>{t('flow.legendDecision')}</li>
          <li>{t('flow.legendLoop')}</li>
          <li>{t('flow.legendBack')}</li>
          <li>{t('flow.legendTrace')}</li>
        </ul>
      )}
    </div>
  );
}
