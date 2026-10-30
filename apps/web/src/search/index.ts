import type { Block, Lesson } from '../content/types';

export interface Doc { lang: 'fa' | 'en'; lessonId: string; chapterN: number; chapterId: string; chapterTitle: string; heading: string; start: number; kind: 'text' | 'code' | 'heading'; text: string }
export interface Hit { doc: Doc; score: number; snippet: string; ranges: [number, number][] }

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Lower-case, Persian and Arabic digits to ASCII, Arabic yeh/kaf to Persian, strip diacritics: so a query matches however it was typed. */
export function normalize(s: string): string {
  return s
    .replace(/[۰-۹]/g, (c) => String(PERSIAN_DIGITS.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)))
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g, '')
    .toLowerCase();
}

export const tokenize = (s: string): string[] => normalize(s).split(/[^\p{L}\p{N}_]+/u).filter(Boolean);

/** Markdown to plain text, good enough for indexing and for snippets. */
export function plain(md: string): string {
  return md
    .replace(/```[\w-]*\n?/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '').replace(/[*_`~|]/g, '').replace(/\s+/g, ' ').trim();
}

function blockDocs(blocks: Block[], base: Omit<Doc, 'start' | 'kind' | 'text'>): Doc[] {
  const out: Doc[] = [];
  for (const b of blocks) {
    if (b.type === 'hr') continue;
    if (b.type === 'code') { out.push({ ...base, start: b.start, kind: 'code', text: b.code }); continue; }
    if (b.type === 'list') {
      const parts = b.items.flatMap((it) => it.parts);
      const text = parts.map((p) => (p.type === 'text' ? plain(p.md) : p.code)).join(' ');
      out.push({ ...base, start: b.start, kind: 'text', text });
      continue;
    }
    if (b.type === 'table') { out.push({ ...base, start: b.start, kind: 'text', text: [b.header.join(' '), ...b.rows.map((r) => r.join(' '))].join(' ') }); continue; }
    if (b.type === 'checklist') { out.push({ ...base, start: b.start, kind: 'text', text: b.items.map((i) => i.text).join(' ') }); continue; }
    out.push({ ...base, start: b.start, kind: 'text', text: plain(b.raw) });
  }
  return out;
}

export function buildIndex(lessons: Lesson[]): Doc[] {
  const docs: Doc[] = [];
  for (const l of lessons) {
    for (const c of l.chapters) {
      const base = { lang: (l.lang ?? 'en') as 'fa' | 'en', lessonId: l.id, chapterN: c.n, chapterId: c.id, chapterTitle: c.title };
      docs.push({ ...base, heading: c.heading, start: c.line, kind: 'heading', text: c.heading });
      docs.push(...blockDocs(c.blocks, { ...base, heading: c.heading }));
      for (const s of c.sections) {
        docs.push({ ...base, heading: s.heading, start: s.line, kind: 'heading', text: s.heading });
        docs.push(...blockDocs(s.blocks, { ...base, heading: s.heading }));
      }
    }
  }
  return docs;
}

/** Every query word must appear (the last one may be a prefix). Score: word frequency, boosted for headings, exact words and phrase order. */
export function search(docs: Doc[], query: string, limit = 30): Hit[] {
  const q = tokenize(query);
  if (!q.length) return [];
  const hits: Hit[] = [];
  const nq = normalize(query).trim();
  for (const d of docs) {
    const toks = tokenize(d.text + ' ' + d.heading);
    let score = 0, ok = true;
    for (let i = 0; i < q.length; i++) {
      const last = i === q.length - 1;
      let exact = 0, pre = 0;
      for (const t of toks) { if (t === q[i]) exact++; else if (last && t.startsWith(q[i])) pre++; }
      if (!exact && !pre) { ok = false; break; }
      score += exact * 3 + pre;
    }
    if (!ok) continue;
    if (d.kind === 'heading') score *= 3;
    if (q.length > 1 && normalize(d.text).includes(nq)) score += 8;
    if (d.kind === 'code') score *= 0.8;
    const { snippet, ranges } = makeSnippet(d.text, q);
    hits.push({ doc: d, score, snippet, ranges });
  }
  return hits.sort((a, b) => b.score - a.score || a.doc.chapterN - b.doc.chapterN || a.doc.start - b.doc.start).slice(0, limit);
}

/** ~140 characters around the first matching word, with the matched ranges for highlighting. */
export function makeSnippet(text: string, q: string[], width = 140): { snippet: string; ranges: [number, number][] } {
  const flat = text.replace(/\s+/g, ' ');
  const low = normalize(flat);
  const lenSame = low.length === flat.length; // normalisation can change length for exotic text; then skip highlighting
  let at = -1;
  if (lenSame) for (const w of q) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  const from = Math.max(0, (at < 0 ? 0 : at) - 40);
  const snippet = (from > 0 ? '…' : '') + flat.slice(from, from + width) + (from + width < flat.length ? '…' : '');
  const off = from > 0 ? 1 : 0;
  const ranges: [number, number][] = [];
  if (lenSame) for (const w of q) {
    let i = low.indexOf(w, from);
    while (i >= 0 && i + w.length <= from + width) { const s = i - from + off; ranges.push([s, s + w.length]); i = low.indexOf(w, i + w.length); }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r); }
  return { snippet, ranges: merged };
}
