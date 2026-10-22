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
  const [help, setHelp] = useState(false);
  // "/" opens search and "?" lists the shortcuts, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (e.key === '/') { e.preventDefault(); nav('/search'); }
      if (e.key === '?') { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  useEffect(() => { document.title = t('app.name'); }, [t, locale]);
  // Move focus to the page heading after navigation so keyboard and screen-reader users start at the new content.
  useEffect(() => {
    const h = document.getElementById('chapter-title') ?? document.querySelector('main h1');
    (h as HTMLElement | null)?.focus?.({ preventScroll: false });
  }, [loc.pathname]);

  const cycleTheme = () => setPrefs({ theme: prefs.theme === 'light' ? 'dark' : prefs.theme === 'dark' ? 'contrast' : prefs.theme === 'contrast' ? 'system' : 'light' });

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('app.skip')}</a>
      <header className="app-header">
        <div className="wrap">
          <Link className="brand" to="/"><Logo /><span>{t('app.name')}</span></Link>
          <nav className="nav" aria-label={t('nav.main')}>
            <NavLink to="/" end>{t('nav.home')}</NavLink>
            <NavLink to="/search">{t('nav.search')}</NavLink>
            <NavLink to="/review">{t('nav.review')}{dueN > 0 && <span className="badge" aria-label={t('review.due', { n: num(dueN) })}>{num(dueN)}</span>}</NavLink>
            <NavLink to="/progress">{t('nav.progress')}</NavLink>
            {user && <NavLink to="/classes">{t('nav.classes')}</NavLink>}
            {profile?.role === 'teacher' && <NavLink to="/teach">{t('nav.teach')}</NavLink>}
            {user && <NavLink to="/notifications">{t('nt.title')}{unread > 0 && <><span className="badge">{num(unread)}</span><span className="sr-only"> {t('nt.unreadSr')}</span></>}</NavLink>}
            <NavLink to="/settings">{t('nav.settings')}</NavLink>
            {user && <NavLink to="/account">{t('nav.account')}</NavLink>}
          </nav>
          <span className="spacer" />
          <SyncChip />
          <button type="button" className="btn small quiet" onClick={() => setPrefs({ locale: locale === 'fa' ? 'en' : 'fa' })} lang={locale === 'fa' ? 'en' : 'fa'} aria-label={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}>
            {locale === 'fa' ? 'English' : 'فارسی'}
          </button>
          <button type="button" className="btn small quiet" onClick={cycleTheme} aria-label={t('settings.theme') + ': ' + t('settings.theme.' + prefs.theme)}>
            {t('settings.theme.' + prefs.theme)}
          </button>
          {status !== 'loading' && (user
            ? <button type="button" className="btn small alt" onClick={() => void api?.signOut()}>{t('nav.signout')}</button>
            : api && <><Link className="btn small alt" to="/signin">{t('nav.signin')}</Link><Link className="btn small" to="/signup">{t('nav.signup')}</Link></>)}
        </div>
      </header>
      {!online && <div className="wrap"><div className="notice warn" role="status">{t('sync.offline')}</div></div>}
      <main id="main" tabIndex={-1} className="wrap" style={{ outline: 'none', paddingBottom: 48 }}>
        <Outlet />
        <p style={{ marginTop: 32 }}><button type="button" className="btn small quiet" onClick={() => setHelp(true)}><kbd dir="ltr">?</kbd> {t('shortcuts.title')}</button></p>
      </main>
      <Shortcuts open={help} onClose={() => setHelp(false)} />
    </>
  );
}
