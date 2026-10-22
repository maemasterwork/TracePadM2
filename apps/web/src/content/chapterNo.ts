/**
 * Progress keys (read:<n>, pred:<n>:<id>, note:<n>:<line>, the server's class_progress) carry only a chapter number, so
 * the content build makes chapter numbers unique across lessons: lesson 1 keeps 1..99, lesson N >= 2 uses N*100 + the
 * printed chapter number (lesson 2 chapter 3 is 203). See chapter_base() in tools/content/build.py.
 * Use this to show the number printed in the lesson.
 */
export const chapterNo = (n: number): number => (n >= 100 ? n % 100 : n);

/** Which lesson number a key's chapter number belongs to (1 for 1..99). */
export const lessonOfChapter = (n: number): number => (n >= 100 ? Math.floor(n / 100) : 1);
