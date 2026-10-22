import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { makeTeachApi, teachErr, type TeachApi, TeachError } from './api';

export function useTeachApi(): TeachApi | null {
  return useMemo(() => (supabase ? makeTeachApi(supabase) : null), []);
}

/** Loads something from the server. `pollMs` refreshes in the background (used for the live class view); errors keep the old data. */
export function useLoad<T>(fn: (() => Promise<T>) | null, deps: unknown[], pollMs = 0): { data: T | null; error: TeachError | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<TeachError | null>(null);
  const [loading, setLoading] = useState(Boolean(fn));
  const [tick, setTick] = useState(0);
  const ref = useRef(fn);
  ref.current = fn;
  const lastDeps = useRef<string | null>(null);
  useEffect(() => {
    if (!ref.current) { setLoading(false); return; }
    let alive = true;
    const go = (first: boolean) => {
      if (first) setLoading(true);
      ref.current!().then((d) => { if (alive) { setData(d); setError(null); setLoading(false); } }).catch((e) => { if (alive) { setError(teachErr(e)); setLoading(false); } });
    };
    // a reload() keeps what is on screen (and the component state around it) instead of flashing a loading state
    const key = JSON.stringify(deps);
    const same = lastDeps.current === key;
    lastDeps.current = key;
    go(!same);
    const h = pollMs > 0 ? setInterval(() => { if (!document.hidden) go(false); }, pollMs) : undefined;
    return () => { alive = false; if (h) clearInterval(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, pollMs]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function ErrorLine({ error }: { error: TeachError | null | undefined }) {
  const { t } = useI18n();
  if (!error) return null;
  return <Notice kind="bad" live>{t(error.key)}</Notice>;
}

/** Runs a button action with a busy flag and an error line; the action's own result may flash a message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TeachError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setBusy(true); setError(null); setDone(null);
    try { const m = await fn(); if (typeof m === 'string') setDone(m); return true; }
    catch (e) { setError(teachErr(e)); return false; }
    finally { setBusy(false); }
  }, []);
  return { busy, error, done, run, clear: () => { setError(null); setDone(null); } };
}

export function Gate({ need, children, titleKey, guestKey, noServerKey }: {
  need: 'signedIn' | 'teacher';
  children: ReactNode;
  titleKey?: string;
  guestKey?: string;
  noServerKey?: string;
}) {
  const { t } = useI18n();
  const { status, profile, configured } = useAuth();
  if (status === 'loading') return <Spinner label={t('app.loading')} />;
  if (!configured || status === 'guest') {
    return (
      <div style={{ maxWidth: 640, margin: '24px auto' }}>
        <h1>{t(titleKey ?? 'gate.title')}</h1>
        <Notice kind="info">{t(configured ? guestKey ?? 'gate.guest' : noServerKey ?? 'gate.noServer')}</Notice>
        {configured && <p className="row"><Link className="btn" to="/signin">{t('nav.signin')}</Link><Link className="btn alt" to="/signup">{t('nav.signup')}</Link></p>}
      </div>
    );
  }
  if (need === 'teacher' && profile && profile.role !== 'teacher') {
    return (
      <div style={{ maxWidth: 640, margin: '24px auto' }}>
        <h1>{t('gate.title')}</h1>
        <Notice kind="info">{t('gate.notTeacher')}</Notice>
        <p><Link className="btn" to="/account">{t('nav.account')}</Link></p>
      </div>
    );
  }
  if (need === 'teacher' && !profile) return <Spinner label={t('app.loading')} />;
  return <>{children}</>;
}

/** <input type="datetime-local"> value <-> ISO string (the browser's own time zone). */
export const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);
