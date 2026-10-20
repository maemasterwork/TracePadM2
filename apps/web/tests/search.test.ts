import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Lesson } from '../src/content/types';
import { buildIndex, makeSnippet, normalize, plain, search, tokenize } from '../src/search';

const lesson = JSON.parse(readFileSync(join(process.cwd(), 'public/content/01-objects-and-data-structures/lesson.json'), 'utf8')) as Lesson;
const docs = buildIndex([lesson]);

describe('search', () => {
  it('normalises digits, letters and case', () => {
    expect(normalize('۱۲۳ ٤٥٦ Hello')).toBe('123 456 hello');
    expect(normalize('كتاب ي')).toBe('کتاب ی');
    expect(tokenize('Floor-division, //!')).toEqual(['floor', 'division']);
    expect(plain('## Title\n**bold** [link](http://x) `code`')).toBe('Title bold link code');
  });
  it('indexes every chapter, with headings, text and code', () => {
    expect(new Set(docs.map((d) => d.chapterN)).size).toBe(lesson.chapters.length);
    expect(docs.some((d) => d.kind === 'code')).toBe(true);
    expect(docs.some((d) => d.kind === 'heading')).toBe(true);
  });
  it('finds words, requires all of them, and treats the last as a prefix', () => {
    const r = search(docs, 'dictionar');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].doc.chapterTitle.toLowerCase()).toContain('dictionar');
    expect(search(docs, 'zzzzqqq')).toEqual([]);
    const both = search(docs, 'list append');
    for (const h of both) expect(normalize(h.doc.text + ' ' + h.doc.heading)).toMatch(/append/);
  });
  it('ranks a heading hit above body hits', () => {
    const r = search(docs, 'strings');
    expect(r[0].doc.kind === 'heading' || r[0].doc.chapterTitle === 'Strings').toBe(true);
  });
  it('snippets stay short and ranges point at the matches', () => {
    const { snippet, ranges } = makeSnippet('A long text about tuples and lists and sets and more words '.repeat(6), ['tuples']);
    expect(snippet.length).toBeLessThanOrEqual(144);
    for (const [a, b] of ranges) expect(snippet.slice(a, b).toLowerCase()).toBe('tuples');
  });
  it('an empty query finds nothing', () => expect(search(docs, '  ')).toEqual([]));
});
