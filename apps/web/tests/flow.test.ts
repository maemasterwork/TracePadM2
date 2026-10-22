import { describe, expect, it } from 'vitest';
import { labelPos, mirrorX, nodeForLine, outlineText, visitCounts } from '../src/flow/lib';
import type { FlowChart } from '../src/flow/types';

const n = (id: string, kind: FlowChart['nodes'][number]['kind'], lines?: [number, number]) => ({ id, kind, text: [id], x: 0, y: 0, w: 10, h: 10, ...(lines ? { lines } : {}) });
const chart: FlowChart = {
  title: 't', w: 100, h: 100, edges: [], outline: [],
  nodes: [n('s', 'start'), n('loop', 'loop', [1, 1]), n('body', 'process', [2, 2]), n('multi', 'process', [4, 6]), n('e', 'end')],
};

describe('flowchart lookup', () => {
  it('maps a source line to the box that stands for it', () => {
    expect(nodeForLine(chart, 1)?.id).toBe('loop');
    expect(nodeForLine(chart, 5)?.id).toBe('multi');
    expect(nodeForLine(chart, 3)).toBeNull();
    expect(nodeForLine(chart, null)).toBeNull();
  });
  it('prefers the narrowest range when ranges nest', () => {
    const c: FlowChart = { ...chart, nodes: [n('def', 'define', [1, 9]), n('inner', 'process', [3, 3])] };
    expect(nodeForLine(c, 3)?.id).toBe('inner');
    expect(nodeForLine(c, 7)?.id).toBe('def');
  });
  it('counts loop rounds, and counts a multi-line statement once', () => {
    const m = visitCounts(chart, [1, 2, 1, 2, 1, 4, 5, 6]);
    expect(m.get('loop')).toBe(3);
    expect(m.get('body')).toBe(2);
    expect(m.get('multi')).toBe(1);
  });
  it('mirrors x for right-to-left', () => expect(mirrorX(30, 100)).toBe(70));
  it('puts a label beside a vertical edge and above a horizontal one', () => {
    expect(labelPos([[10, 0], [10, 50]]).anchor).toBe('start');
    const h = labelPos([[0, 20], [40, 20]]);
    expect(h).toEqual({ x: 20, y: 14, anchor: 'middle' });
  });
  it('flattens an outline with indentation', () => {
    expect(outlineText([{ text: 'a', children: [{ text: 'b' }] }, { text: 'c' }])).toEqual(['a', '  b', 'c']);
  });
});
