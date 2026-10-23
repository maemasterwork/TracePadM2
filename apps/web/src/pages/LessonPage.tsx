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
import { chapterNo } from '../content/chapterNo';

export function LessonPage() {
  const { lessonId = '', chapterId } = useParams();
  const nav = useNavigate();
  const { t, num, locale } = useI18n();
  const { progress } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [chapterQuery, setChapterQuery] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const chaptersRead = lesson.chapters.filter((chapter) => read[`read:${chapter.n}`]).length;
  const progressPercent = lesson.chapters.length ? Math.round((chaptersRead / lesson.chapters.length) * 100) : 0;
  const nextUnread = lesson.chapters.find((chapter) => !read[`read:${chapter.n}`]);
  const visibleChapters = lesson.chapters.filter((chapter) => chapter.title.toLowerCase().includes(chapterQuery.trim().toLowerCase()));

  navTargets.current = { prev: prev?.id, next: next?.id };

  const mark = async () => { await progress.save(key, { done: true }); setRead((r) => ({ ...r, [key]: true })); };

  return (
    <NotesProvider>
    <FlowProvider lessonId={lessonId}>
    <div className="lesson-page">
      <div className="lesson-toolbar">
        <Link className="lesson-back-link" to="/">{t('lesson.backToLearning')}<span aria-hidden="true">↗</span></Link>
        <div className="lesson-toolbar-actions">
          <button type="button" className="btn small quiet" aria-pressed={toolsOn} onClick={flipTools} title={t('notes.mode')}>{t('notes.modeShort')}</button>
          <Link className="btn small quiet" to="/notes">{t('notes.mine')}</Link>
        </div>
      </div>
      {locale === 'fa' && <Notice kind="info">{t('lesson.notTranslated')}</Notice>}
      <button type="button" className="lesson-mobile-toc-toggle" aria-expanded={tocOpen} aria-controls="lesson-chapter-sidebar" onClick={() => setTocOpen((open) => !open)}>
        <span aria-hidden="true">☷</span>{tocOpen ? t('lesson.hideContents') : t('lesson.showContents')}
        <span className="lesson-mobile-progress">{num(chaptersRead)}/{num(lesson.chapters.length)}</span>
      </button>
      <div className={'lesson-workspace' + (sidebarCollapsed ? ' is-sidebar-collapsed' : '')}>
        <aside id="lesson-chapter-sidebar" className={'lesson-sidebar' + (tocOpen ? ' is-open' : '') + (sidebarCollapsed ? ' is-collapsed' : '')}>
          <div className="lesson-sidebar-heading">
            <div className="lesson-sidebar-title">
              <p className="lesson-kicker">{t('lesson.learningPath')}</p>
              <h2>{t('lesson.contents')}</h2>
            </div>
            <span className="lesson-completion-count">{num(chaptersRead)}/{num(lesson.chapters.length)}</span>
            <button
              type="button"
              className="lesson-sidebar-toggle"
              aria-label={sidebarCollapsed ? t('lesson.expandSidebar') : t('lesson.collapseSidebar')}
              aria-expanded={!sidebarCollapsed}
              aria-controls="lesson-chapter-sidebar"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              title={sidebarCollapsed ? t('lesson.expandSidebar') : t('lesson.collapseSidebar')}
            >
              <span aria-hidden="true">{sidebarCollapsed ? '»' : '«'}</span>
            </button>
          </div>
          <div className="lesson-progress-track" role="progressbar" aria-label={t('lesson.progress')} aria-valuemin={0} aria-valuemax={lesson.chapters.length} aria-valuenow={chaptersRead}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="lesson-progress-caption">{t('lesson.chaptersComplete', { done: num(chaptersRead), total: num(lesson.chapters.length) })}</p>
          <label className="lesson-chapter-search">
            <span className="sr-only">{t('lesson.searchChapters')}</span>
            <span aria-hidden="true">⌕</span>
            <input type="search" value={chapterQuery} onChange={(event) => setChapterQuery(event.target.value)} placeholder={t('lesson.searchChapters')} />
          </label>
          <nav aria-label={t('lesson.contents')}>
            <ol className="lesson-toc">
              <li>
                <Link className="lesson-toc-overview" to={`/lesson/${lessonId}`} aria-label={t('lesson.overview')} title={t('lesson.overview')} aria-current={idx < 0 ? 'page' : undefined} onClick={() => setTocOpen(false)}>
                  <span className="lesson-toc-symbol" aria-hidden="true">✳</span>
                  <span className="lesson-toc-label">{t('lesson.overview')}</span>
                  <span className="lesson-toc-arrow" aria-hidden="true">↗</span>
                </Link>
              </li>
              {visibleChapters.map((chapter) => {
                const chapterRead = read[`read:${chapter.n}`] === true;
                return (
                  <li key={chapter.id}>
                    <Link className="lesson-toc-chapter" to={`/lesson/${lessonId}/${chapter.id}`} aria-current={chapter.id === chapterId ? 'page' : undefined} onClick={() => setTocOpen(false)} lang="en" dir="ltr" title={chapter.title} aria-label={`${chapterNo(chapter.n)}. ${chapter.title}${chapterRead ? `, ${t('lesson.isRead')}` : ''}`}>
                      <span className={'lesson-toc-number' + (chapterRead ? ' is-read' : '')}>{chapterRead ? '✓' : num(chapterNo(chapter.n))}</span>
                      <span className="lesson-toc-title">{chapter.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {visibleChapters.length === 0 && <p className="lesson-no-results">{t('lesson.noChaptersFound')}</p>}
          </nav>
          {nextUnread && <Link className="lesson-continue" to={`/lesson/${lessonId}/${nextUnread.id}`} onClick={() => setTocOpen(false)}>
            <span className="lesson-continue-icon" aria-hidden="true">→</span>
            <span><small>{t('lesson.continueLearning')}</small><strong>{nextUnread.title}</strong></span>
          </Link>}
        </aside>
        <main className="lesson-main">
          <div className="lesson-reading-card">
            <div className="lesson-reading-meta">
              <span>{idx < 0 ? t('lesson.overview') : t('lesson.chapter', { n: chapterNo(lesson.chapters[idx].n) })}</span>
              {idx >= 0 && <span>{t('lesson.chapterPosition', { current: num(idx + 1), total: num(lesson.chapters.length) })}</span>}
            </div>
            <div className={toolsOn ? 'tools-on' : ''}>
              {idx < 0 ? <OverviewBody lesson={lesson} onAnchor={onAnchor} /> : <ChapterBody lesson={lesson} chapterIndex={idx} onAnchor={onAnchor} />}
              {idx >= 0 && labs?.chapters[String(lesson.chapters[idx].n)] && <LabsPanel ch={lesson.chapters[idx].n} labs={labs.chapters[String(lesson.chapters[idx].n)]} concepts={concepts} />}
              <div className="lesson-footer-nav">
                {prev ? <Link className="lesson-nav-link lesson-nav-prev" to={`/lesson/${lessonId}/${prev.id}`}><span aria-hidden="true">←</span><span><small>{t('lesson.prev')}</small><strong>{prev.title}</strong></span></Link> : idx === 0 ? <Link className="lesson-nav-link lesson-nav-prev" to={`/lesson/${lessonId}`}><span aria-hidden="true">←</span><span><small>{t('lesson.prev')}</small><strong>{t('lesson.overview')}</strong></span></Link> : <span />}
                {key && <button type="button" className="btn alt lesson-mark-read" onClick={mark} disabled={isRead}>{isRead ? '✓ ' + t('lesson.isRead') : t('lesson.markRead')}</button>}
                {next ? <Link className="lesson-nav-link lesson-nav-next" to={`/lesson/${lessonId}/${next.id}`}><span><small>{t('lesson.next')}</small><strong>{next.title}</strong></span><span aria-hidden="true">→</span></Link> : <span />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
    </FlowProvider>
    </NotesProvider>
  );
}
