/** Shapes of labs.json (validated at build time by tools/content/labs.schema.json). */
export interface LText { en: string; fa?: string; fa_status?: 'machine' | 'reviewed' }
export interface Prediction { id: string; tag: string; code: string; answer: string; exact?: boolean; memory_after?: boolean; nondeterministic?: boolean; why: LText }
export interface Quiz { id: string; tag: string; question: LText; options: LText[]; correct: number; why: LText }
export interface ExTest { set?: string; post?: string; out: string; hidden?: boolean }
export interface Exercise {
  id: string; title?: string; prompt: LText; starter: string; solution: string;
  param?: { pattern: string; flags?: string };
  tests: ExTest[]; hints: LText[];
}
export interface ChapterLabs { memory_demo?: string; predictions?: Prediction[]; quizzes?: Quiz[]; exercises?: Exercise[] }
export interface Labs { lesson: string; schema: 1; chapters: Record<string, ChapterLabs> }

/** A concept tag is shared by predictions and quizzes; exercises inherit none (they are graded, not tagged). */
export interface Attempt { t: number; ok: boolean; hint?: boolean }
