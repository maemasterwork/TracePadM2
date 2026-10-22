import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { makeTeachApi } from '../teach/api';
import { ErrorLine, Gate, useAction, useLoad, useTeachApi } from '../teach/hooks';

const KINDS = ['assignment', 'grade', 'announcement', 'comment'] as const;

/** Number of unread notifications; checked now, every minute and when the tab becomes visible. Zero for guests. */
export function useNotificationCount(): number {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user || !supabase) { setN(0); return; }
    const api = makeTeachApi(supabase);
    let alive = true;
    const go = () => { api.notifications().then((r) => { if (alive) setN(r.filter((x) => !x.read_at).length); }).catch(() => undefined); };
    go();
    const h = setInterval(go, 60_000);
    const vis = () => { if (!document.hidden) go(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('tracepad:notifications', go);
    return () => { alive = false; clearInterval(h); document.removeEventListener('visibilitychange', vis); window.removeEventListener('tracepad:notifications', go); };
  }, [user]);
  return n;
}

export function Notifications() { return <Gate need="signedIn"><Inner /></Gate>; }

function Inner() {
  const { t, date, num } = useI18n();
  const { user, profile, api: authApi, refreshProfile } = useAuth();
  const api = useTeachApi()!;
  const nav = useNavigate();
  const list = useLoad(() => api.notifications(), [api]);
  const act = useAction();
  const prefs = ((profile?.display_prefs as { notify?: Record<string, boolean> } | undefined)?.notify) ?? {};
  const unread = (list.data ?? []).filter((n) => !n.read_at);
  const bump = () => window.dispatchEvent(new Event('tracepad:notifications'));
  const savePref = (k: string, on: boolean) => void act.run(async () => {
    if (!authApi || !user || !profile) return;
    await authApi.updateProfile(user.id, { display_prefs: { ...profile.display_prefs, notify: { ...prefs, [k]: on } } });
    await refreshProfile();
  });
  if (list.loading) return <Spinner label={t('app.loading')} />;
  return (
    <div style={{ maxWidth: 760, margin: '24px auto' }}>
      <h1>{t('nt.title')}</h1>
      <ErrorLine error={list.error ?? act.error} />
      <section className="card" aria-labelledby="nt-list">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="nt-list" style={{ margin: 0 }}>{t('nt.latest')}</h2>
          <button type="button" className="btn small alt" disabled={unread.length === 0 || act.busy} onClick={() => void act.run(async () => { await api.markRead(unread.map((n) => n.id)); list.reload(); bump(); })}>{t('nt.markAll')}</button>
        </div>
        {(list.data ?? []).length === 0 ? <p>{t('nt.none')}</p> : (
          <ul className="plain-list notes-list">
            {list.data!.map((n) => (
              <li key={n.id} className={n.read_at ? '' : 'unread'}>
                <button type="button" className="linklike" onClick={() => void (async () => { if (!n.read_at) { await api.markRead([n.id]).catch(() => undefined); bump(); } if (n.link) nav(n.link); else list.reload(); })()}>
                  <strong>{t('nt.kind.' + n.kind)}</strong>: {n.title}
                </button>
                {n.body && <div className="muted-line">{n.body}</div>}
                <div className="muted-line">{date(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}{!n.read_at && <span className="chip" style={{ marginInlineStart: 8 }}>{t('nt.new')}</span>}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted-line">{t('cl.count', { n: num((list.data ?? []).length) })}</p>
      </section>
      <section className="card" aria-labelledby="nt-prefs">
        <h2 id="nt-prefs" style={{ marginTop: 0 }}>{t('nt.prefs')}</h2>
        <p className="muted-line">{t('nt.prefsHelp')}</p>
        <ul className="plain-list">
          {KINDS.map((k) => (
            <li key={k}><label className="row" style={{ gap: 8 }}><input type="checkbox" checked={prefs[k] !== false} onChange={(e) => savePref(k, e.target.checked)} /> {t('nt.pref.' + k)}</label></li>
          ))}
        </ul>
        <Notice kind="info">{t('nt.noEmail')}</Notice>
        <p><Link to="/classes">{t('cl.title')}</Link></p>
      </section>
    </div>
  );
}
