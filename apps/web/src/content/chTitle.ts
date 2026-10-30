/** A chapter title in the learner's language, with the attributes its text needs (titles are English unless translated). */
export function chTitle(c: { title: string; title_fa?: string }, locale: string): { text: string; lang: 'fa' | 'en'; dir: 'rtl' | 'ltr' } {
  return locale === 'fa' && c.title_fa ? { text: c.title_fa, lang: 'fa', dir: 'rtl' } : { text: c.title, lang: 'en', dir: 'ltr' };
}
