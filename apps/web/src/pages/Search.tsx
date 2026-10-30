import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadCourse, loadLesson } from '../content/api';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { buildIndex, search, type Doc } from '../search';
import { chapterNo } from '../content/chapterNo';

function Marked({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const out: React.ReactNode[] = []; let at = 0;
  ranges.forEach(([a, b], i) => { out.push(<Fragment key={'t' + i}>{text.slice(at, a)}</Fragment>, <mark key={'m' + i}>{text.slice(a, b)}</mark>); at = b; });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

export function Search() {
  const { t, num, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadCourse().then((c) => Promise.all(c.lessons.filter((l) => l.status === 'published').map((l) => loadLesson(l.id, locale === 'fa')))).then((ls) => setDocs(buildIndex(ls))).catch(() => setFailed(true)); }, [locale]);
  useEffect(() => setInput(q), [q]);
  const hits = useMemo(() => (docs ? search(docs, q) : []), [docs, q]);
  return (
    <div style={{ maxWidth: 780, margin: '24px auto' }}>
      <h1>{t('search.label')}</h1>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); }} className="row">
        <label htmlFor="q" className="sr-only">{t('search.label')}</label>
        <input id="q" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('search.placeholder')} autoFocus style={{ flex: 1, minWidth: 180 }} autoComplete="off" />
        <button className="btn">{t('search.go')}</button>
      </form>
      <p className="muted-line">{t('search.hint')}</p>
      {failed && <Notice kind="bad" live>{t('lesson.loadFailed')}</Notice>}
      {!docs && !failed && <Spinner label={t('search.loading')} />}
      {docs && q && (
        <>
          <p role="status">{hits.length ? t('search.results', { n: num(hits.length), q }) : t('search.none', { q })}</p>
          <ol className="results">
            {hits.map((h, i) => (
              <li key={i} className="card">
                <Link to={`/lesson/${h.doc.lessonId}/${h.doc.chapterId}#b${h.doc.start}`} dir={h.doc.lang === 'fa' ? 'rtl' : 'ltr'} lang={h.doc.lang}><strong>{chapterNo(h.doc.chapterN)}. {h.doc.chapterTitle}</strong>{h.doc.heading !== h.doc.chapterTitle ? ` › ${h.doc.heading}` : ''}</Link>
                <p dir={h.doc.kind === 'code' || h.doc.lang !== 'fa' ? 'ltr' : 'rtl'} lang={h.doc.kind === 'code' ? 'en' : h.doc.lang} className={h.doc.kind === 'code' ? 'code-ltr' : ''} style={{ margin: '6px 0 0' }}><Marked text={h.snippet} ranges={h.ranges} /></p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
