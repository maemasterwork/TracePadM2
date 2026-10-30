import type { ConceptInfo, Course, Lesson } from './types';

const memo = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  let p = memo.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(import.meta.env.BASE_URL + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => memo.delete(path)); // a failed load can be retried
    memo.set(path, p);
  }
  return p;
}

export const loadCourse = () => getJson<Course>('content/course.json');
/** The lesson text in the learner's language: the Persian version when it exists and Persian is chosen, else English. */
export async function loadLesson(id: string, fa = false): Promise<Lesson> {
  if (fa) {
    const course = await loadCourse().catch(() => null);
    if (course?.lessons.find((l) => l.id === id)?.fa) return getJson<Lesson>(`content/${id}/lesson.fa.json`);
  }
  return getJson<Lesson>(`content/${id}/lesson.json`);
}
export const loadLabs = (id: string) => getJson<import("../learn/types").Labs>(`content/${id}/labs.json`);
export const loadFlow = (id: string) => getJson<import('../flow/types').FlowMap>(`content/${id}/flow.json`);
export const loadConcepts = () => getJson<ConceptInfo[]>('content/concepts.json');
