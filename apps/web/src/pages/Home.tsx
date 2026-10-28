import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { loadCourse } from '../content/api';
import type { Course } from '../content/types';
import { Logo, Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useRows } from '../learn/hooks';

type DemoStep = 'predict' | 'run' | 'understand';

export function Home() {
  const { t, pick, num, locale, setLocale } = useI18n();
  const { status, configured } = useAuth();
  const readRows = useRows(['read:']);
  const [course, setCourse] = useState<Course | null>(null);
  const [failed, setFailed] = useState(false);
  const [demoStep, setDemoStep] = useState<DemoStep>('predict');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lessonFilter, setLessonFilter] = useState<'all' | 'available' | 'planned'>('all');
  const [lessonQuery, setLessonQuery] = useState('');
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  useEffect(() => {
    if (status !== 'signedIn') {
      setCourse(null);
      setFailed(false);
      return;
    }
    let alive = true;
    loadCourse().then((result) => { if (alive) setCourse(result); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [status]);
  if (status === 'loading') return <Spinner label={t('app.loading')} />;
  if (status !== 'signedIn') {
    return (
      <div className="landing-page">
        <header className="landing-header">
          <div className="landing-header-inner">
            <Link className="landing-brand" to="/" aria-label={t('app.name')}>
              <Logo />
              <span>{t('app.name')}<small>{t('home.brandline')}</small></span>
            </Link>
            <button
              type="button"
              className="landing-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="landing-navigation"
              aria-label={menuOpen ? t('home.closeMenu') : t('home.openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span /><span /><span />
            </button>
            <nav id="landing-navigation" className={'landing-nav' + (menuOpen ? ' is-open' : '')} aria-label={t('nav.main')}>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)}>{t('home.navHow')}</a>
              <a href="#try-it" onClick={() => setMenuOpen(false)}>{t('home.navTry')}</a>
              <button type="button" className="landing-language" onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')} lang={locale === 'fa' ? 'en' : 'fa'}>
                {locale === 'fa' ? 'English' : 'فارسی'}
              </button>
              {configured && <>
                <Link className="landing-login" to="/signin">{t('nav.signin')}</Link>
                <Link className="landing-join" to="/signup">{t('home.joinFree')}<span aria-hidden="true">↗</span></Link>
              </>}
            </nav>
          </div>
        </header>
        <div className="landing-main">
          <section className="landing-hero" aria-labelledby="landing-title">
            <div className="landing-copy">
              <p className="landing-eyebrow"><span className="landing-live-dot" />{t('home.landingEyebrow')}</p>
              <h1 id="landing-title">{t('home.heroTitle')}<span>{t('home.heroHighlight')}</span></h1>
              <p className="landing-lead">{t('home.lead')}</p>
              {configured
                ? <div className="landing-actions">
                    <Link className="landing-join landing-join-large" to="/signup">{t('home.joinFree')}<span aria-hidden="true">↗</span></Link>
                    <a className="landing-demo-link" href="#try-it"><span aria-hidden="true">↓</span>{t('home.exploreDemo')}</a>
                  </div>
                : <Notice kind="info">{t('home.notConfigured')}</Notice>}
              <div className="landing-proof"><div className="landing-proof-avatars" aria-hidden="true"><span>A</span><span>پ</span><span>+</span></div><span>{t('home.proofLine')}</span></div>
            </div>
            <div className="landing-visual" id="try-it">
              <div className="landing-orbit landing-orbit-one" />
              <div className="landing-orbit landing-orbit-two" />
              <div className="landing-star landing-star-one" aria-hidden="true">✳</div>
              <div className="landing-star landing-star-two" aria-hidden="true">✦</div>
              <div className="landing-terminal">
                <div className="terminal-bar">
                  <span className="terminal-lights" aria-hidden="true"><i /><i /><i /></span>
                  <span>{t('home.demoTitle')}</span>
                  <span className="terminal-python">PY</span>
                </div>
                <div className="demo-tabs" role="group" aria-label={t('home.demoSteps')}>
                  {(['predict', 'run', 'understand'] as const).map((step) => (
                    <button key={step} type="button" aria-pressed={demoStep === step} onClick={() => setDemoStep(step)}>
                      {t(`home.demo.${step}`)}
                    </button>
                  ))}
                </div>
                <div className="demo-panel" id="demo-panel" aria-live="polite">
                  <p className="demo-prompt">{t(`home.demo.${demoStep}Prompt`)}</p>
                  <div className="demo-code" dir="ltr">
                    <span><i>1</i><code><b>total</b> = <em>12</em> + <em>30</em></code></span>
                    <span><i>2</i><code><b>print</b>(total)</code></span>
                  </div>
                  <div className={'demo-output' + (demoStep === 'predict' ? ' is-muted' : '')} aria-live="polite">
                    <span>{t('home.demo.output')}</span>
                    <code>{demoStep === 'predict' ? t('home.demo.waiting') : demoStep === 'run' ? '42' : t('home.demo.explanation')}</code>
                  </div>
                </div>
                <button type="button" className="demo-run" onClick={() => setDemoStep(demoStep === 'predict' ? 'run' : demoStep === 'run' ? 'understand' : 'predict')}>
                  <span aria-hidden="true">{demoStep === 'predict' ? '▶' : demoStep === 'run' ? '→' : '↻'}</span>
                  {demoStep === 'predict' ? t('home.demo.run') : demoStep === 'run' ? t('home.demo.next') : t('home.demo.restart')}
                </button>
              </div>
              <div className="landing-float-card"><span aria-hidden="true">✦</span><div><b>{t('home.demo.streakTitle')}</b><small>{t('home.demo.streakText')}</small></div></div>
            </div>
          </section>
          <section className="landing-how" id="how-it-works" aria-labelledby="landing-how-title">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">{t('home.methodEyebrow')}</p>
              <h2 id="landing-how-title">{t('home.methodTitle')}</h2>
            </div>
            <ol className="landing-steps">
              <li><span>01</span><div><h3>{t('home.featurePredict')}</h3><p>{t('home.stepPredict')}</p></div><b aria-hidden="true">?</b></li>
              <li><span>02</span><div><h3>{t('home.featureRun')}</h3><p>{t('home.stepRun')}</p></div><b aria-hidden="true">▶</b></li>
              <li><span>03</span><div><h3>{t('home.featureUnderstand')}</h3><p>{t('home.stepUnderstand')}</p></div><b aria-hidden="true">✳</b></li>
            </ol>
          </section>
          <section className="landing-bottom-cta">
            <p>{t('home.bottomEyebrow')}</p>
            <h2>{t('home.bottomTitle')}</h2>
            {configured && <Link className="landing-join landing-join-large" to="/signup">{t('home.joinFree')}<span aria-hidden="true">↗</span></Link>}
          </section>
          <footer className="landing-footer"><Link className="landing-brand" to="/"><Logo /><span>{t('app.name')}</span></Link><span>{t('home.footerLine')}</span></footer>
        </div>
      </div>
    );
  }
  const publishedLessons = course?.lessons.filter((lesson) => lesson.status === 'published') ?? [];
  const plannedLessons = course?.lessons.filter((lesson) => lesson.status === 'planned') ?? [];
  const readKeys = new Set(readRows.filter((row) => row.data.done === true).map((row) => row.key));
  const first = publishedLessons[0];
  const nextChapter = publishedLessons.flatMap((lesson) =>
    (lesson.chapters ?? []).map((chapter) => ({ lesson, chapter })),
  ).find(({ chapter }) => !readKeys.has(`read:${chapter.n}`));
  const continueLesson = nextChapter?.lesson ?? first;
  const continuePath = nextChapter
    ? `/lesson/${nextChapter.lesson.id}/${nextChapter.chapter.id}`
    : continueLesson ? `/lesson/${continueLesson.id}` : null;
  const totalChapters = publishedLessons.reduce((total, lesson) => total + (lesson.chapters?.length ?? 0), 0);
  const completedChapters = publishedLessons.reduce(
    (total, lesson) => total + (lesson.chapters?.filter((chapter) => readKeys.has(`read:${chapter.n}`)).length ?? 0),
    0,
  );
  const normalizedQuery = lessonQuery.trim().toLocaleLowerCase();
  const visibleLessons = (course?.lessons ?? []).filter((lesson) => {
    const matchesFilter = lessonFilter === 'all'
      || (lessonFilter === 'available' ? lesson.status === 'published' : lesson.status === 'planned');
    const matchesQuery = !normalizedQuery
      || lesson.title.en.toLocaleLowerCase().includes(normalizedQuery)
      || (lesson.title.fa?.toLocaleLowerCase().includes(normalizedQuery) ?? false)
      || num(lesson.number).includes(normalizedQuery)
      || String(lesson.number).includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
  return (
    <div className="course-home">
      <section className="course-welcome" aria-labelledby="course-title">
        <div className="course-welcome-copy">
          <p className="course-kicker"><span className="course-kicker-spark" aria-hidden="true">✳</span>{t('home.learningPath')}</p>
          <h1 id="course-title">{course ? pick(course.course.title) : t('home.title')}</h1>
          <p className="course-lead">{course ? pick(course.course.tagline) : t('home.lead')}</p>
          {continueLesson && continuePath && <Link className="course-start" to={continuePath}>
            <span className="course-start-icon" aria-hidden="true">↗</span>
            <span>{t('home.start')}{num(continueLesson.number)}<small>{nextChapter ? nextChapter.chapter.title : pick(continueLesson.title)}</small></span>
          </Link>}
        </div>
        <div className="course-welcome-art" aria-hidden="true">
          <span className="course-art-orbit" />
          <span className="course-art-bracket">{'{'}</span>
          <span className="course-art-number">01</span>
          <span className="course-art-dot" />
          <span className="course-art-caption">print(42)</span>
        </div>
      </section>
      {failed && <Notice kind="bad" live>{t('lesson.loadFailed')}</Notice>}
      {!course && !failed && <Spinner label={t('app.loading')} />}
      {course && (
        <>
          <section className="course-overview" aria-label={t('home.progressLabel')}>
            <div className="course-progress-summary">
              <div className="course-progress-heading">
                <span>{t('home.progressLabel')}</span>
                <strong>{num(completedChapters)}<i> / {num(totalChapters)}</i></strong>
              </div>
              <div
                className="course-progress-track"
                role="progressbar"
                aria-label={t('home.progressLabel')}
                aria-valuemin={0}
                aria-valuemax={Math.max(totalChapters, 1)}
                aria-valuenow={completedChapters}
              >
                <span style={{ width: totalChapters ? `${(completedChapters / totalChapters) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="course-stat">
              <span className="course-stat-icon" aria-hidden="true">↗</span>
              <span><strong>{num(publishedLessons.length)}</strong><small>{t('home.availableLessons')}</small></span>
            </div>
            <div className="course-stat">
              <span className="course-stat-icon course-stat-icon-mint" aria-hidden="true">✦</span>
              <span><strong>{num(plannedLessons.length)}</strong><small>{t('home.upcomingLessons')}</small></span>
            </div>
          </section>
          <section className="course-lessons" aria-labelledby="course-lessons-title">
            <div className="course-section-heading">
              <div>
                <p>{t('home.pathEyebrow')}</p>
                <h2 id="course-lessons-title">{t('home.learningPath')}</h2>
              </div>
              <span className="course-lesson-count">{t('home.lessonCount', { n: num(visibleLessons.length) })}</span>
            </div>
            <div className="course-controls">
              <div className="course-filters" role="group" aria-label={t('home.filterLessons')}>
                {(['all', 'available', 'planned'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={lessonFilter === filter}
                    onClick={() => setLessonFilter(filter)}
                  >
                    {t(`home.filter.${filter}`)}
                    <span>{num(filter === 'all' ? course.lessons.length : filter === 'available' ? publishedLessons.length : plannedLessons.length)}</span>
                  </button>
                ))}
              </div>
              <label className="course-search">
                <span aria-hidden="true">⌕</span>
                <span className="sr-only">{t('home.searchLessons')}</span>
                <input
                  type="search"
                  value={lessonQuery}
                  onChange={(event) => setLessonQuery(event.target.value)}
                  placeholder={t('home.searchLessons')}
                />
              </label>
            </div>
            {visibleLessons.length ? (
              <ol className="course-path-list">
                {visibleLessons.map((lesson, index) => {
                  const available = lesson.status === 'published';
                  const chapters = lesson.chapters ?? [];
                  const done = chapters.filter((chapter) => readKeys.has(`read:${chapter.n}`)).length;
                  const isExpanded = expandedLesson === lesson.id;
                  return (
                    <li className={'course-path-item' + (available ? '' : ' is-planned')} key={lesson.id}>
                      <span className="course-path-connector" aria-hidden="true" />
                      <article className="course-path-card">
                        <div className="course-path-card-main">
                          {available
                            ? <Link className="course-path-link" to={`/lesson/${lesson.id}`} aria-label={`${t('home.open')}: ${pick(lesson.title)}`}>
                                <span className="course-path-number">{num(lesson.number).padStart(2, '0')}</span>
                                <span className="course-path-title">
                                  <small>{t('home.lesson', { n: num(lesson.number) })}</small>
                                  <strong>{pick(lesson.title)}</strong>
                                </span>
                                <span className="course-path-arrow" aria-hidden="true">↗</span>
                              </Link>
                            : <div className="course-path-link">
                                <span className="course-path-number">{num(lesson.number).padStart(2, '0')}</span>
                                <span className="course-path-title">
                                  <small>{t('home.lesson', { n: num(lesson.number) })}</small>
                                  <strong>{pick(lesson.title)}</strong>
                                </span>
                                <span className="course-coming-soon">{t('home.planned')}</span>
                              </div>}
                        </div>
                        {available && (
                          <>
                            <div className="course-path-footer">
                              <span className="course-path-chapters">{t('home.chapters', { n: chapters.length })}</span>
                              {chapters.length > 0 && (
                                <span className="course-path-completion">
                                  <span className="course-mini-track" aria-hidden="true"><i style={{ width: `${(done / chapters.length) * 100}%` }} /></span>
                                  {t('home.chaptersDone', { done: num(done), total: num(chapters.length) })}
                                </span>
                              )}
                              <button
                                type="button"
                                className="course-expand"
                                aria-expanded={isExpanded}
                                aria-controls={`chapters-${lesson.id}`}
                                onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                              >
                                {isExpanded ? t('home.hideChapters') : t('home.exploreChapters')}
                                <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                              </button>
                            </div>
                            {isExpanded && (
                              <ol className="course-chapter-list" id={`chapters-${lesson.id}`}>
                                {chapters.map((chapter) => (
                                  <li key={chapter.id}>
                                    <Link to={`/lesson/${lesson.id}/${chapter.id}`} lang="en" dir="ltr">
                                      <span>{chapter.title}</span>
                                      <span aria-hidden="true">↗</span>
                                    </Link>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="course-empty">
                <span aria-hidden="true">⌕</span>
                <p>{t('home.noLessons')}</p>
                <button type="button" onClick={() => { setLessonQuery(''); setLessonFilter('all'); }}>{t('home.clearFilters')}</button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
