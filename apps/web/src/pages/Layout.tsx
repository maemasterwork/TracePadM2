import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Shortcuts } from './Shortcuts';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../design/ui';
import { useI18n } from '../i18n';
import { useRows } from '../learn/hooks';
import { useNotificationCount } from './Notifications';
import { dueItems } from '../learn/srs';
import { setPrefs, usePrefs } from '../prefs/store';

function SyncChip() {
  const { t } = useI18n();
  const { progress, status } = useAuth();
  const state = useSyncExternalStore((cb) => progress.subscribe(cb), () => progress.getState());
  if (status === 'loading') return null;
  const kind = state === 'offline' ? 'warn' : state === 'saved' ? 'good' : '';
  return <span className={'chip ' + kind} role="status" aria-live="polite">{t('sync.' + state)}</span>;
}

function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export function Layout() {
  const { t, locale, num } = useI18n();
  const { status, user, api, profile } = useAuth();
  const unread = useNotificationCount();
  const revRows = useRows(['rev:']);
  const dueN = dueItems(revRows as never, Date.now(), 99).length;
  const prefs = usePrefs();
  const loc = useLocation();
  const online = useOnline();
  const nav = useNavigate();
  const isPublicLanding = loc.pathname === '/' && status !== 'signedIn';
  const isAuthPage = ['/signin', '/signup', '/reset', '/auth/update-password'].includes(loc.pathname);
  const showHeader = !isAuthPage && !isPublicLanding;
  const isStandalonePage = isAuthPage || isPublicLanding;
  const [help, setHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // "/" opens search and "?" lists the shortcuts, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isStandalonePage) return;
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (e.key === '/') { e.preventDefault(); nav('/search'); }
      if (e.key === '?') { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isStandalonePage, nav]);

  useEffect(() => { document.title = t('app.name'); }, [t, locale]);
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);
  // Move focus to the page heading after navigation so keyboard and screen-reader users start at the new content.
  useEffect(() => {
    const h = document.getElementById('chapter-title') ?? document.querySelector('main h1');
    (h as HTMLElement | null)?.focus?.({ preventScroll: false });
  }, [loc.pathname]);

  const cycleTheme = () => setPrefs({ theme: prefs.theme === 'light' ? 'dark' : prefs.theme === 'dark' ? 'contrast' : prefs.theme === 'contrast' ? 'system' : 'light' });

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('app.skip')}</a>
      {showHeader && <header className="app-header">
        <div className="app-header-inner">
          <Link className="app-brand" to="/" aria-label={t('app.name')}>
            <span className="app-brand-mark"><Logo /></span>
            <span className="app-brand-name">{t('app.name')}<small>{t('home.brandline')}</small></span>
          </Link>
          <button
            type="button"
            className="app-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="app-header-panel"
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
          <div className={'app-header-panel' + (menuOpen ? ' is-open' : '')} id="app-header-panel">
            <nav className="app-nav" aria-label={t('nav.main')}>
              <NavLink to="/" end onClick={() => setMenuOpen(false)}>{t('nav.home')}</NavLink>
              <NavLink to="/search" onClick={() => setMenuOpen(false)}>{t('nav.search')}</NavLink>
              <NavLink to="/review" onClick={() => setMenuOpen(false)}>{t('nav.review')}{dueN > 0 && <span className="badge" aria-label={t('review.due', { n: num(dueN) })}>{num(dueN)}</span>}</NavLink>
              <NavLink to="/progress" onClick={() => setMenuOpen(false)}>{t('nav.progress')}</NavLink>
              {user && <NavLink to="/classes" onClick={() => setMenuOpen(false)}>{t('nav.classes')}</NavLink>}
              {profile?.role === 'teacher' && <NavLink to="/teach" onClick={() => setMenuOpen(false)}>{t('nav.teach')}</NavLink>}
              {user && <NavLink to="/notifications" onClick={() => setMenuOpen(false)}>{t('nt.title')}{unread > 0 && <><span className="badge">{num(unread)}</span><span className="sr-only"> {t('nt.unreadSr')}</span></>}</NavLink>}
              <NavLink to="/settings" onClick={() => setMenuOpen(false)}>{t('nav.settings')}</NavLink>
              {user && <NavLink to="/account" onClick={() => setMenuOpen(false)}>{t('nav.account')}</NavLink>}
            </nav>
            <div className="app-header-actions">
              <SyncChip />
              <button type="button" className="app-header-action" onClick={() => setPrefs({ locale: locale === 'fa' ? 'en' : 'fa' })} lang={locale === 'fa' ? 'en' : 'fa'} aria-label={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}>
                {locale === 'fa' ? 'English' : 'فارسی'}
              </button>
              <button type="button" className="app-header-action" onClick={cycleTheme} aria-label={t('settings.theme') + ': ' + t('settings.theme.' + prefs.theme)}>
                <span className="app-theme-mark" aria-hidden="true">{prefs.theme === 'dark' ? '☾' : prefs.theme === 'contrast' ? '◐' : '☼'}</span>
                {t('settings.theme.' + prefs.theme)}
              </button>
              {status !== 'loading' && (user
                ? <button type="button" className="app-signout" onClick={() => void api?.signOut()}>{t('nav.signout')}<span aria-hidden="true">↗</span></button>
                : api && <><Link className="app-header-action" to="/signin">{t('nav.signin')}</Link><Link className="app-signout" to="/signup">{t('nav.signup')}<span aria-hidden="true">↗</span></Link></>)}
            </div>
          </div>
        </div>
      </header>}
      {!online && !isStandalonePage && <div className="wrap"><div className="notice warn" role="status">{t('sync.offline')}</div></div>}
      <main id="main" tabIndex={-1} className="wrap" style={{ outline: 'none', paddingBottom: isStandalonePage ? 0 : 48 }}>
        <Outlet />
        {!isStandalonePage && <p style={{ marginTop: 32 }}><button type="button" className="btn small quiet" onClick={() => setHelp(true)}><kbd dir="ltr">?</kbd> {t('shortcuts.title')}</button></p>}
      </main>
      {!isStandalonePage && <Shortcuts open={help} onClose={() => setHelp(false)} />}
    </>
  );
}
