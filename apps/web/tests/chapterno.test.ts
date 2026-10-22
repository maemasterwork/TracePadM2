import { describe, expect, it } from 'vitest';
import { chapterNo, lessonOfChapter } from '../src/content/chapterNo';

describe('chapter numbers are unique across lessons but print as in the lesson', () => {
  it('lesson 1 keeps its numbers (existing learner data stays valid)', () => {
    expect(chapterNo(1)).toBe(1);
    expect(chapterNo(11)).toBe(11);
    expect(lessonOfChapter(11)).toBe(1);
  });
  it('lesson 2 and later are offset by 100 per lesson', () => {
    expect(chapterNo(203)).toBe(3);
    expect(chapterNo(309)).toBe(9);
    expect(lessonOfChapter(203)).toBe(2);
    expect(lessonOfChapter(309)).toBe(3);
  });
});
