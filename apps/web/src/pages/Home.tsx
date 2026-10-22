import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { loadCourse } from '../content/api';
import type { Course } from '../content/types';
import { Logo, Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';

type DemoStep = 'predict' | 'run' | 'understand';

export function Home() {
  const { t, pick, num, locale, setLocale } = useI18n();
  const { status, configured } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [failed, setFailed] = useState(false);
  const [demoStep, setDemoStep] = useState<DemoStep>('predict');
  const [menuOpen, setMenuOpen] = useState(false);
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
  const first = course?.lessons.find((l) => l.status === 'published');
  return (
    <>
      <section className="hero">
        <h1>{course ? pick(course.course.title) : t('home.title')}</h1>
        <p className="lead">{course ? pick(course.course.tagline) : t('home.lead')}</p>
        {first && <Link className="btn" to={`/lesson/${first.id}`}>{t('home.start')}</Link>}
      </section>
      {failed && <Notice kind="bad" live>{t('lesson.loadFailed')}</Notice>}
      {!course && !failed && <Spinner label={t('app.loading')} />}
      {course && (
        <ul className="lesson-list">
          {course.lessons.map((l) => (
            <li key={l.id}>
              <div className={'card' + (l.status === 'planned' ? ' planned' : '')}>
                <span className="num" aria-hidden="true">{num(l.number)}</span>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}><span className="sr-only">{t('home.lesson', { n: num(l.number) })}: </span>{pick(l.title)}</h2>
                {l.status === 'published'
                  ? <>
                      <span className="chip">{t('home.chapters', { n: l.chapters?.length ?? 0 })}</span>
                      <Link className="btn small" style={{ marginTop: 'auto' }} to={`/lesson/${l.id}`}>{t('home.open')}</Link>
                    </>
                  : <span className="chip warn" style={{ marginTop: 'auto' }}>{t('home.planned')}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
