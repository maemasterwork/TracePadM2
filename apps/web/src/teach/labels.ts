import type { IndexedItem } from '../learn/record';
import type { LText } from '../learn/types';

const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const cut = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** A short human label for a practice item, in the learner's language. */
export function itemLabel(it: IndexedItem | undefined, key: string, pick: (t: LText) => string, kindName: (k: 'pred' | 'quiz' | 'ex') => string): string {
  if (!it) return key;
  if (it.ex) return it.ex.title ? it.ex.title : cut(plain(pick(it.ex.prompt)));
  if (it.quiz) return cut(plain(pick(it.quiz.question)));
  if (it.pred) return cut(it.pred.code.split('\n').find((l) => l.trim()) ?? kindName('pred'));
  return key;
}
export const chapterOfKey = (key: string) => Number(key.split(':')[1]);
export const kindOfKey = (key: string) => key.split(':')[0] as 'pred' | 'quiz' | 'ex';
