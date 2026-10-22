import type { FlowChart, FlowNode } from './types';

/** The box that stands for a source line: the one with the narrowest line range that contains it. */
export function nodeForLine(chart: FlowChart, line: number | null | undefined): FlowNode | null {
  if (!line) return null;
  let best: FlowNode | null = null;
  let bestSpan = Infinity;
  for (const n of chart.nodes) {
    if (!n.lines) continue;
    const [a, b] = n.lines;
    if (line >= a && line <= b && b - a < bestSpan) { best = n; bestSpan = b - a; }
  }
  return best;
}

/** Which boxes ran so far, and how many times, given the source line of every executed step. */
export function visitCounts(chart: FlowChart, lines: number[]): Map<string, number> {
  const m = new Map<string, number>();
  let last: string | null = null;
  for (const l of lines) {
    const n = nodeForLine(chart, l);
    if (!n) { last = null; continue; }
    // a statement spread over several lines is one visit, not one per line
    if (n.id === last && n.lines && n.lines[1] > n.lines[0]) continue;
    m.set(n.id, (m.get(n.id) ?? 0) + 1);
    last = n.id;
  }
  return m;
}

export const mirrorX = (x: number, width: number) => width - x;

/** Where an edge's label goes: beside the first segment (right of a vertical one, above a horizontal one). */
export function labelPos(pts: [number, number][]): { x: number; y: number; anchor: 'start' | 'middle' } {
  const [a, b] = [pts[0], pts[1] ?? pts[0]];
  if (Math.abs(a[0] - b[0]) < 0.5) return { x: a[0] + 6, y: a[1] + Math.min(18, Math.abs(b[1] - a[1]) / 2 + 4), anchor: 'start' };
  return { x: (a[0] + b[0]) / 2, y: a[1] - 6, anchor: 'middle' };
}

export function outlineText(items: { text: string; children?: unknown[] }[], depth = 0): string[] {
  const out: string[] = [];
  for (const it of items) {
    out.push('  '.repeat(depth) + it.text);
    if (it.children) out.push(...outlineText(it.children as { text: string; children?: unknown[] }[], depth + 1));
  }
  return out;
}
