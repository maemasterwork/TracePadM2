import { useCallback, useEffect, useRef, useState } from 'react';
import { FlowProvider } from '../flow/FlowContext';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { loadLesson } from '../content/api';
import { ChapterBody, OverviewBody } from '../content/LessonView';
import type { Lesson } from '../content/types';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useLabs } from '../learn/hooks';
import { NotesProvider } from '../notes/NotesContext';
import { LabsPanel } from '../learn/LabsPanel';

export function LessonPage() {
  const { lessonId = '', chapterId } = useParams();
  const nav = useNavigate();
  const { t, num, locale } = useI18n();
  const { progress } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const [read, setRead] = useState<Record<string, boolean>>({});
  const { labs, concepts } = useLabs(lessonId);
  const [toolsOn, setToolsOn] = useState(() => { try { return localStorage.getItem('tracepad.notetools') === '1'; } catch { return false; } });
  const flipTools = () => setToolsOn((v) => { try { localStorage.setItem('tracepad.notetools', v ? '0' : '1'); } catch { /* storage blocked */ } return !v; });

  useEffect(() => {
    setLesson(null); setError(false);
    loadLesson(lessonId).then(setLesson).catch(() => setError(true));
  }, [lessonId]);

  useEffect(() => {
    let alive = true;
    const load = () => void progress.list('read:').then((rows) => { if (alive) setRead(Object.fromEntries(rows.map((r) => [r.key, r.data.done === true]))); });
    load();
    const off = progress.subscribeRows(load);
    return () => { alive = false; off(); };
  }, [progress, lessonId, chapterId]);

  // A link such as #b120 (from search, notes or bookmarks) scrolls to that paragraph and flashes it.
  const hash = useLocation().hash;
  useEffect(() => {
    if (!lesson || !/^#b\d+$/.test(hash)) return;
    const h = setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1800);
    }, 60);
    return () => clearTimeout(h);
  }, [lesson, hash, chapterId]);

  // [ and ] go to the previous and next chapter (not while typing).
  const navTargets = useRef<{ prev?: string; next?: string }>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (e.key === ']' && navTargets.current.next) nav(`/lesson/${lessonId}/${navTargets.current.next}`);
      if (e.key === '[' && navTargets.current.prev) nav(`/lesson/${lessonId}/${navTargets.current.prev}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lessonId, nav]);

  // In-lesson links like "#3-strings" go to that chapter.
  const onAnchor = useCallback((hash: string) => {
    if (!lesson) return;
    const ch = lesson.chapters.find((c) => c.id === hash);
    if (ch) nav(`/lesson/${lessonId}/${ch.id}`);
    else document.getElementById(hash)?.scrollIntoView();
  }, [lesson, lessonId, nav]);

  if (error) return <Notice kind="bad" live>{t('lesson.loadFailed')}</Notice>;
  if (!lesson) return <Spinner label={t('app.loading')} />;
  const idx = chapterId ? lesson.chapters.findIndex((c) => c.id === chapterId) : -1;
  if (chapterId && idx < 0) return <Notice kind="warn" live>{t('lesson.notFound')}</Notice>;
  const prev = idx > 0 ? lesson.chapters[idx - 1] : idx === 0 ? null : null;
  const next = idx >= 0 ? lesson.chapters[idx + 1] : lesson.chapters[0];
  const key = idx >= 0 ? `read:${lesson.chapters[idx].n}` : '';
  const isRead = key ? read[key] === true : false;

  navTargets.current = { prev: prev?.id, next: next?.id };

  const mark = async () => { await progress.save(key, { done: true }); setRead((r) => ({ ...r, [key]: true })); };

  return (
    <NotesProvider>
    <FlowProvider lessonId={lessonId}>
    <div className="layout">
      <nav className="rail" aria-label={t('lesson.contents')}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>{t('lesson.contents')}</h2>
        <ol>
          <li><Link to={`/lesson/${lessonId}`} aria-current={idx < 0 ? 'true' : undefined}>{t('lesson.overview')}</Link></li>
          {lesson.chapters.map((c) => (
            <li key={c.id}>
              <Link to={`/lesson/${lessonId}/${c.id}`} aria-current={c.id === chapterId ? 'true' : undefined} lang="en" dir="ltr">
                {num(c.n)}. {c.title}{read[`read:${c.n}`] ? ' ✓' : ''}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <div className={toolsOn ? 'tools-on' : ''}>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn small quiet" aria-pressed={toolsOn} onClick={flipTools} title={t('notes.mode')}>{t('notes.modeShort')}</button>
          <Link className="btn small quiet" to="/notes">{t('notes.mine')}</Link>
        </div>
        {locale === 'fa' && <Notice kind="info">{t('lesson.notTranslated')}</Notice>}
        {idx < 0 ? <OverviewBody lesson={lesson} onAnchor={onAnchor} /> : <ChapterBody lesson={lesson} chapterIndex={idx} onAnchor={onAnchor} />}
        {idx >= 0 && labs?.chapters[String(lesson.chapters[idx].n)] && <LabsPanel ch={lesson.chapters[idx].n} labs={labs.chapters[String(lesson.chapters[idx].n)]} concepts={concepts} />}
        <div className="row" style={{ marginTop: 28, justifyContent: 'space-between' }}>
          {prev ? <Link className="btn quiet" to={`/lesson/${lessonId}/${prev.id}`}>← {t('lesson.prev')}</Link> : idx === 0 ? <Link className="btn quiet" to={`/lesson/${lessonId}`}>← {t('lesson.overview')}</Link> : <span />}
          {key && <button type="button" className="btn alt" onClick={mark} disabled={isRead}>{isRead ? '✓ ' + t('lesson.isRead') : t('lesson.markRead')}</button>}
          {next ? <Link className="btn" to={`/lesson/${lessonId}/${next.id}`}>{t('lesson.next')} →</Link> : <span />}
        </div>
      </div>
    </div>
    </FlowProvider>
    </NotesProvider>
  );
}
