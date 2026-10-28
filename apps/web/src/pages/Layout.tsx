import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Shortcuts } from './Shortcuts';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../design/ui';
import { useI18n } from '../i18n';
import { useRows } from '../learn/hooks';
import { useLoad, useTeachApi } from '../teach/hooks';
import { useNotificationCount } from './Notifications';
import { dueItems } from '../learn/srs';
import { setPrefs, usePrefs } from '../prefs/store';

type HeaderIconName = 'home' | 'search' | 'review' | 'progress' | 'classes' | 'teach' | 'notifications' | 'settings' | 'account' | 'language' | 'sun' | 'moon' | 'contrast' | 'signout' | 'signin' | 'menu' | 'close' | 'cloud' | 'cloudOff' | 'sync';

function HeaderIcon({ name }: { name: HeaderIconName }) {
  const paths: Record<HeaderIconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    review: <><path d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    progress: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
    classes: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M8 5V3h8v2M3 10h18M10 10v2h4v-2" /></>,
    teach: <><path d="m3 8 9-5 9 5-9 5-9-5Z" /><path d="M7 10v5c3 3 7 3 10 0v-5M21 8v6" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />,
    contrast: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18V3Z" /></>,
    signout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    signin: <><path d="M14 17l5-5-5-5M19 12H7" /><path d="M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    cloud: <><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9Z" /><path d="m9 13 2 2 4-4" /></>,
    cloudOff: <><path d="M5 5a6 6 0 0 1 10 2 4 4 0 0 1 4 6M5 9a4.5 4.5 0 0 0 2 9h8M3 3l18 18" /></>,
    sync: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3" /></>,
  };

  return <svg className="app-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function SyncChip() {
  const { t } = useI18n();
  const { progress, status } = useAuth();
  const state = useSyncExternalStore((cb) => progress.subscribe(cb), () => progress.getState());
  if (status === 'loading') return null;
  const kind = state === 'offline' ? 'warn' : state === 'saved' ? 'good' : '';
  const icon = state === 'offline' ? 'cloudOff' : state === 'saved' ? 'cloud' : 'sync';
  return <span className={'app-sync-status ' + kind} role="status" aria-live="polite"><HeaderIcon name={icon} />
  {/* <span>{t('sync.' + state)}</span> */}
  </span>;
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
  const teachApi = useTeachApi();
  const classes = useLoad(user && teachApi ? () => teachApi.classes() : null, [teachApi, user?.id]);
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { setAccountOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountMenuRef.current?.querySelector('button')?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);
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
            <HeaderIcon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <div className={'app-header-panel' + (menuOpen ? ' is-open' : '')} id="app-header-panel">
            <nav className="app-nav" aria-label={t('nav.main')}>
              <NavLink to="/" end onClick={() => setMenuOpen(false)}><HeaderIcon name="home" /><span>{t('nav.home')}</span></NavLink>
              <NavLink to="/search" onClick={() => setMenuOpen(false)}><HeaderIcon name="search" /><span>{t('nav.search')}</span></NavLink>
              <NavLink to="/review" onClick={() => setMenuOpen(false)}><HeaderIcon name="review" /><span>{t('nav.review')}</span>{dueN > 0 && <span className="badge" aria-label={t('review.due', { n: num(dueN) })}>{num(dueN)}</span>}</NavLink>
              <NavLink to="/progress" onClick={() => setMenuOpen(false)}><HeaderIcon name="progress" /><span>{t('nav.progress')}</span></NavLink>
              {user && <NavLink to="/classes" onClick={() => setMenuOpen(false)}><HeaderIcon name="classes" /><span>{t('nav.classes')}</span></NavLink>}
              {profile?.role === 'teacher' && <NavLink to="/teach" onClick={() => setMenuOpen(false)}><HeaderIcon name="teach" /><span>{t('nav.teach')}</span></NavLink>}
              {user && <NavLink to="/notifications" onClick={() => setMenuOpen(false)}><HeaderIcon name="notifications" /><span>{t('nt.title')}</span>{unread > 0 && <><span className="badge">{num(unread)}</span><span className="sr-only"> {t('nt.unreadSr')}</span></>}</NavLink>}
              {!user && <NavLink to="/settings" onClick={() => setMenuOpen(false)}><HeaderIcon name="settings" /><span>{t('nav.settings')}</span></NavLink>}
            </nav>
            <div className="app-header-actions">
              <SyncChip />
              {status !== 'loading' && (user
                ? <div className="app-account-menu" ref={accountMenuRef}>
                    <button
                      type="button"
                      className="app-header-action"
                      aria-expanded={accountOpen}
                      aria-controls="app-account-panel"
                      aria-label={t('nav.account')}
                      onClick={() => setAccountOpen((open) => !open)}
                    >
                      <HeaderIcon name="account" /><span>{t('nav.account')}</span>
                    </button>
                    {accountOpen && <div className="app-account-panel" id="app-account-panel">
                      <div className="app-account-summary">
                        <div className="app-account-avatar" aria-hidden="true"><HeaderIcon name="account" /></div>
                        <div className="app-account-identity">
                          <strong>{profile?.full_name || profile?.username || user.email || t('nav.account')}</strong>
                          {profile?.full_name && profile.username && <span>@{profile.username}</span>}
                          {!profile?.full_name && profile?.username && user.email && <span>{user.email}</span>}
                        </div>
                      </div>
                      <div className="app-account-classes">
                        <span className="app-account-section-title">{t('account.class')}</span>
                        {classes.loading ? <span>{t('app.loading')}</span> : classes.error
                          ? <span role="status">{t(classes.error.key)}</span>
                          : (classes.data ?? []).length > 0
                            ? <div className="app-account-class-list">{(classes.data ?? []).map((c) => <span className="app-account-class" key={c.id}><HeaderIcon name="classes" /><span>{c.name}{c.term ? ` · ${c.term}` : ''}</span></span>)}</div>
                            : <span>{t('account.noClass')}</span>}
                      </div>
                      <div className="app-account-preferences">
                        <button type="button" className="app-header-action app-icon-action" onClick={() => setPrefs({ locale: locale === 'fa' ? 'en' : 'fa' })} lang={locale === 'fa' ? 'en' : 'fa'} aria-label={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'} title={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}>
                          <HeaderIcon name="language" /><span>{locale === 'fa' ? 'EN' : 'فا'}</span>
                        </button>
                        <button type="button" className="app-header-action app-icon-action" onClick={cycleTheme} aria-label={t('settings.theme') + ': ' + t('settings.theme.' + prefs.theme)} title={t('settings.theme') + ': ' + t('settings.theme.' + prefs.theme)}>
                          <HeaderIcon name={prefs.theme === 'dark' ? 'moon' : prefs.theme === 'contrast' ? 'contrast' : 'sun'} /><span>{t('settings.theme.' + prefs.theme)}</span>
                        </button>
                      </div>
                      <Link className="app-header-action" to="/settings" onClick={() => setAccountOpen(false)}><HeaderIcon name="settings" /><span>{t('nav.settings')}</span></Link>
                      <Link className="app-header-action" to="/account" onClick={() => setAccountOpen(false)}><HeaderIcon name="account" /><span>{t('account.manage')}</span></Link>
                      <button type="button" className="app-header-action" onClick={() => { setAccountOpen(false); setHelp(true); }}><span><kbd dir="ltr">?</kbd> {t('shortcuts.title')}</span></button>
                      <button type="button" className="app-signout" onClick={() => void api?.signOut()}><HeaderIcon name="signout" /><span>{t('nav.signout')}</span></button>
                    </div>}
                  </div>
                : <>
                    <button type="button" className="app-header-action app-icon-action" onClick={() => setPrefs({ locale: locale === 'fa' ? 'en' : 'fa' })} lang={locale === 'fa' ? 'en' : 'fa'} aria-label={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'} title={locale === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}>
                      <HeaderIcon name="language" /><span>{locale === 'fa' ? 'EN' : 'فا'}</span>
                    </button>
                    <button type="button" className="app-header-action app-icon-action" onClick={cycleTheme} aria-label={t('settings.theme') + ': ' + t('settings.theme.' + prefs.theme)} title={t('settings.theme') + ': ' + t('settings.theme.' + prefs.theme)}>
                      <HeaderIcon name={prefs.theme === 'dark' ? 'moon' : prefs.theme === 'contrast' ? 'contrast' : 'sun'} /><span>{t('settings.theme.' + prefs.theme)}</span>
                    </button>
                    {api && <><Link className="app-header-action" to="/signin"><HeaderIcon name="signin" /><span>{t('nav.signin')}</span></Link><Link className="app-signout" to="/signup"><span>{t('nav.signup')}</span><HeaderIcon name="signin" /></Link></>}
                  </>)}
            </div>
          </div>
        </div>
      </header>}
      {!online && !isStandalonePage && <div className="wrap"><div className="notice warn" role="status">{t('sync.offline')}</div></div>}
      <main id="main" tabIndex={-1} className="wrap" style={{ outline: 'none', paddingBottom: isStandalonePage ? 0 : 48 }}>
        <Outlet />
      </main>
      {!isStandalonePage && <Shortcuts open={help} onClose={() => setHelp(false)} />}
    </>
  );
}
