/** Shapes of flow.json (written by tools/content/flowchart.py; the chart is laid out at build time). */
export type NodeKind = 'start' | 'end' | 'process' | 'io' | 'decision' | 'loop' | 'define' | 'merge' | 'return' | 'error' | 'class' | 'break' | 'continue' | 'group';

export interface FlowNode {
  id: string;
  kind: NodeKind;
  text: string[];
  x: number; y: number; w: number; h: number;
  /** The code the box stands for (shown small under the label for grouped lines). */
  code?: string;
  /** First and last source line (1-based, inside the example). Absent for start and end. */
  lines?: [number, number];
}
export interface FlowEdge {
  pts: [number, number][];
  from: string; to: string;
  label?: string; dashed?: boolean; back?: boolean;
}
export interface OutlineItem { text: string; children?: OutlineItem[] }
export interface FlowChart {
  title: string; w: number; h: number;
  nodes: FlowNode[]; edges: FlowEdge[];
  outline: OutlineItem[];
  lines?: [number, number];
}
export interface FlowEntry { charts: FlowChart[]; control: boolean }
export type FlowMap = Record<string, FlowEntry>;
