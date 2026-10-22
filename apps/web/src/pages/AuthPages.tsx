import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AGE_BANDS, AuthError, validateSignUp, type AgeBand, type FieldErrors } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { oauthProviders } from '../auth/supabase';
import { Field, Logo, Notice } from '../design/ui';
import { useI18n } from '../i18n';

function errKey(e: unknown): string { return e instanceof AuthError ? e.key : 'auth.errGeneric'; }

function AuthFrame({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="auth-header-inner">
          <Link className="auth-brand" to="/" aria-label={t('app.name')}><Logo /><span>{t('app.name')}</span></Link>
          <nav className="auth-header-nav" aria-label={t('nav.main')}>
            <button type="button" className="auth-locale" onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')} lang={locale === 'fa' ? 'en' : 'fa'}>
              {locale === 'fa' ? 'English' : 'فارسی'}
            </button>
            <Link className="auth-home-link" to="/"><span aria-hidden="true">←</span>{t('auth.backHome')}</Link>
          </nav>
        </div>
      </header>
      <div className="auth-main">
        <div className="auth-shell">
          <aside className="auth-story">
            <div className="auth-story-decoration" aria-hidden="true"><span>✳</span><span>✦</span><span>·</span></div>
            <p className="auth-story-kicker">{t('auth.storyEyebrow')}</p>
            <h2>{t('auth.storyTitle')}</h2>
            <p className="auth-story-lead">{t('auth.storyLead')}</p>
            <div className="auth-story-code" dir="ltr" role="img" aria-label={t('auth.storyCodeLabel')}>
              <span><i>1</i><code>answer = <b>6</b> * <b>7</b></code></span>
              <span><i>2</i><code>print(answer)</code></span>
              <span className="auth-story-output"><i>›</i><code>42</code></span>
            </div>
            <div className="auth-story-caption"><span aria-hidden="true">✦</span>{t('auth.storyCaption')}</div>
          </aside>
          {children}
        </div>
      </div>
      <footer className="auth-footer"><span>{t('auth.footerLine')}</span></footer>
    </div>
  );
}

function Unavailable({ title }: { title: string }) {
  const { t } = useI18n();
  return <AuthFrame><div className="card auth-card"><h1 style={{ marginTop: 0 }}>{title}</h1><Notice kind="info">{t('auth.notConfigured')}</Notice><Link className="btn" to="/">{t('auth.guestContinue')}</Link></div></AuthFrame>;
}

function OAuthButtons() {
  const { t } = useI18n();
  const { api } = useAuth();
  const [err, setErr] = useState('');
  if (!oauthProviders.length) return null;
  return (
    <>
      <p className="hint" style={{ textAlign: 'center' }}>{t('auth.or')}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        {oauthProviders.map((p) => <button key={p} type="button" className="btn quiet" onClick={() => api!.oauth(p).catch((e) => setErr(errKey(e)))}>{t(p === 'google' ? 'auth.google' : 'auth.microsoft')}</button>)}
      </div>
      {err && <Notice kind="bad" live>{t(err)}</Notice>}
    </>
  );
}

export function SignIn() {
  const { t } = useI18n();
  const { api, user, configured } = useAuth();
  const nav = useNavigate();
  const [id, setId] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  if (!configured || !api) return <Unavailable title={t('auth.signIn')} />;
  if (user) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { await api.signIn(id, pw); nav('/'); } catch (x) { setErr(errKey(x)); } finally { setBusy(false); }
  };
  const magic = async () => {
    setErr(''); setMsg('');
    if (!id.includes('@')) { setErr('auth.errEmail'); return; }
    try { await api.sendMagicLink(id); setMsg(t('auth.magicSent')); } catch (x) { setErr(errKey(x)); }
  };
  return (
    <AuthFrame><div className="card auth-card">
      <h1 style={{ marginTop: 0 }}>{t('auth.signIn')}</h1>
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.email') + ' / ' + t('auth.username')}>{(p) => <input {...p} type="text" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} dir="ltr" required />}</Field>
        <Field label={t('auth.password')}>{(p) => <input {...p} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" required />}</Field>
        {err && <Notice kind="bad" live>{t(err)}</Notice>}
        {msg && <Notice kind="good" live>{msg}</Notice>}
        <div className="row"><button className="btn" disabled={busy || !id || !pw}>{t('auth.signIn')}</button>
          <button type="button" className="btn quiet" onClick={magic}>{t('auth.magic')}</button></div>
      </form>
      <OAuthButtons />
      <p><Link to="/reset">{t('auth.forgot')}</Link></p>
      <p>{t('auth.noAccount')} <Link to="/signup">{t('nav.signup')}</Link></p>
    </div></AuthFrame>
  );
}

export function SignUp() {
  const { t, locale } = useI18n();
  const { api, user, configured } = useAuth();
  const [mode, setMode] = useState<'email' | 'username'>('email');
  const [v, setV] = useState({ email: '', username: '', password: '', fullName: '', ageBand: '' as AgeBand | '' });
  const [errs, setErrs] = useState<FieldErrors>({}); const [top, setTop] = useState(''); const [done, setDone] = useState<'confirm' | 'in' | ''>(''); const [busy, setBusy] = useState(false);
  if (!configured || !api) return <Unavailable title={t('auth.signUp')} />;
  if (user && !done) return <Navigate to="/" replace />;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTop('');
    const input = { ...v, mode, locale };
    const fe = validateSignUp(input);
    setErrs(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try { const r = await api.signUp(input); setDone(r.needsConfirmation ? 'confirm' : 'in'); } catch (x) { setTop(errKey(x)); } finally { setBusy(false); }
  };
  if (done === 'confirm') return <AuthFrame><div className="card auth-card"><h1>{t('auth.confirmTitle')}</h1><Notice kind="good" live>{t('auth.confirmEmail')}</Notice><Link className="btn" to="/signin">{t('auth.signIn')}</Link></div></AuthFrame>;
  const under13 = v.ageBand === 'under13';
  return (
    <AuthFrame><div className="card auth-card">
      <h1 style={{ marginTop: 0 }}>{t('auth.signUp')}</h1>
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.fullName')} error={errs.fullName && t(errs.fullName)}>{(p) => <input {...p} type="text" autoComplete="name" value={v.fullName} onChange={set('fullName')} />}</Field>
        <Field label={t('auth.ageBand')} error={errs.ageBand && t(errs.ageBand)}>{(p) => (
          <select {...p} value={v.ageBand} onChange={set('ageBand')}>
            <option value="">{t('auth.ageChoose')}</option>
            {AGE_BANDS.map((a) => <option key={a} value={a}>{t('auth.ageBand.' + a)}</option>)}
          </select>)}</Field>
        {under13 && <Notice kind="warn" live>{t('auth.under13')}</Notice>}
        {(v.ageBand === '13_15' || v.ageBand === '16_17') && <Notice kind="info">{t('auth.minorNote')}</Notice>}
        <label className="switch"><input type="checkbox" checked={mode === 'username'} onChange={(e) => setMode(e.target.checked ? 'username' : 'email')} /> {t('auth.noEmail')}</label>
        {mode === 'email'
          ? <Field label={t('auth.email')} error={errs.email && t(errs.email)}>{(p) => <input {...p} type="email" autoComplete="email" dir="ltr" value={v.email} onChange={set('email')} />}</Field>
          : <Field label={t('auth.username')} hint={t('auth.usernameHint')} error={errs.username && t(errs.username)}>{(p) => <input {...p} type="text" autoComplete="username" dir="ltr" value={v.username} onChange={set('username')} />}</Field>}
        <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={errs.password && t(errs.password)}>{(p) => <input {...p} type="password" autoComplete="new-password" dir="ltr" value={v.password} onChange={set('password')} />}</Field>
        {top && <Notice kind="bad" live>{t(top)}</Notice>}
        <button className="btn" disabled={busy || under13}>{t('auth.signUp')}</button>
      </form>
      <OAuthButtons />
      <p>{t('auth.haveAccount')} <Link to="/signin">{t('auth.signIn')}</Link></p>
    </div></AuthFrame>
  );
}

export function Reset() {
  const { t } = useI18n();
  const { api, configured } = useAuth();
  const [email, setEmail] = useState(''); const [err, setErr] = useState(''); const [sent, setSent] = useState(false);
  if (!configured || !api) return <Unavailable title={t('auth.resetTitle')} />;
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); try { await api.sendReset(email); setSent(true); } catch (x) { setErr(errKey(x)); } };
  return (
    <AuthFrame><div className="card auth-card">
      <h1 style={{ marginTop: 0 }}>{t('auth.resetTitle')}</h1>
      {sent ? <Notice kind="good" live>{t('auth.resetSent')}</Notice> : (
        <form onSubmit={submit} noValidate>
          <Field label={t('auth.email')}>{(p) => <input {...p} type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          {err && <Notice kind="bad" live>{t(err)}</Notice>}
          <button className="btn" disabled={!email}>{t('auth.resetSend')}</button>
        </form>)}
      <p><Link to="/signin">{t('auth.signIn')}</Link></p>
    </div></AuthFrame>
  );
}

export function UpdatePassword() {
  const { t } = useI18n();
  const { api, user, configured, status } = useAuth();
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(false);
  if (!configured || !api) return <Unavailable title={t('auth.newPassword')} />;
  if (status === 'loading') return <AuthFrame><div className="card auth-card"><h1 style={{ marginTop: 0 }}>{t('auth.newPassword')}</h1><p role="status">{t('app.loading')}</p></div></AuthFrame>; // the reset link is still being exchanged
  if (!user) return <Navigate to="/signin" replace />;
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); try { await api.updatePassword(pw); setOk(true); } catch (x) { setErr(errKey(x)); } };
  return (
    <AuthFrame><div className="card auth-card">
      <h1 style={{ marginTop: 0 }}>{t('auth.newPassword')}</h1>
      {ok ? <><Notice kind="good" live>{t('auth.passwordChanged')}</Notice><Link className="btn" to="/">{t('nav.home')}</Link></> : (
        <form onSubmit={submit} noValidate>
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>{(p) => <input {...p} type="password" autoComplete="new-password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
          {err && <Notice kind="bad" live>{t(err)}</Notice>}
          <button className="btn" disabled={!pw}>{t('auth.setPassword')}</button>
        </form>)}
    </div></AuthFrame>
  );
}
