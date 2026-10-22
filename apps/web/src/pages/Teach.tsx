import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Field, Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { TeachError } from '../teach/api';
import { ErrorLine, Gate, useAction, useLoad, useTeachApi } from '../teach/hooks';

export function Teach() { return <Gate need="teacher"><TeachInner /></Gate>; }

function TeachInner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const api = useTeachApi()!;
  const nav = useNavigate();
  const classes = useLoad(() => api.classes(), [api]);
  const orgs = useLoad(() => api.orgs(), [api]);
  const roles = useLoad(() => api.myOrgRoles(), [api]);
  const [name, setName] = useState(''); const [term, setTerm] = useState(''); const [org, setOrg] = useState('');
  const [orgName, setOrgName] = useState(''); const [orgCode, setOrgCode] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const create = useAction(); const mkOrg = useAction(); const joinOrg = useAction();
  const roleOf = (id: string) => roles.data?.find((r) => r.org_id === id)?.role;
  const orgName_ = (id: string | null) => orgs.data?.find((o) => o.id === id)?.name;
  const list = (classes.data ?? []).filter((c) => showArchived || !c.archived_at);

  return (
    <div style={{ maxWidth: 900, margin: '24px auto' }}>
      <h1>{t('tc.title')}</h1>
      <ErrorLine error={classes.error} />
      <section className="card" aria-labelledby="tc-classes">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="tc-classes" style={{ margin: 0 }}>{t('tc.classes')}</h2>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t('tc.showArchived')}</label>
        </div>
        {classes.loading ? <Spinner label={t('app.loading')} /> : list.length === 0 ? <p>{t('tc.noClasses')}</p> : (
          <ul className="plain-list">
            {list.map((c) => (
              <li key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span><Link to={`/teach/${c.id}`}><strong>{c.name}</strong></Link>{c.term && <span className="muted-line"> · {c.term}</span>}{orgName_(c.org_id) && <span className="muted-line"> · {orgName_(c.org_id)}</span>}</span>
                <span className="row" style={{ gap: 6 }}>
                  {c.teacher_id !== user?.id && <span className="chip">{t('tc.coTeaching')}</span>}
                  {c.archived_at && <span className="chip warn">{t('cl.archived')}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="tc-new">
        <h2 id="tc-new" style={{ marginTop: 0 }}>{t('tc.newClass')}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void create.run(async () => { const id = await api.createClass(name.trim(), term.trim(), org || null); nav(`/teach/${id}?tab=settings`); }); }}>
          <Field label={t('tc.className')}>{(p) => <input {...p} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={t('tc.term')} hint={t('tc.termHint')}>{(p) => <input {...p} maxLength={40} value={term} onChange={(e) => setTerm(e.target.value)} />}</Field>
          {(orgs.data ?? []).length > 0 && (
            <Field label={t('tc.org')}>{(p) => (
              <select {...p} value={org} onChange={(e) => setOrg(e.target.value)}>
                <option value="">{t('tc.noOrg')}</option>
                {orgs.data!.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}</Field>
          )}
          <button className="btn" type="submit" disabled={create.busy || !name.trim()}>{t('tc.create')}</button>
          <ErrorLine error={create.error} />
        </form>
      </section>

      <section className="card" aria-labelledby="tc-orgs">
        <h2 id="tc-orgs" style={{ marginTop: 0 }}>{t('org.title')}</h2>
        <p className="muted-line">{t('org.intro')}</p>
        {(orgs.data ?? []).length > 0 && (
          <ul className="plain-list">
            {orgs.data!.map((o) => (
              <li key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{o.name}</strong>
                <span className="row" style={{ gap: 6 }}>
                  <span className="chip">{t('org.role.' + (roleOf(o.id) ?? 'teacher'))}</span>
                  {roleOf(o.id) === 'admin' && <Link className="btn small alt" to={`/teach/org/${o.id}`}>{t('org.manage')}</Link>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="grid-2">
          <form onSubmit={(e) => { e.preventDefault(); void mkOrg.run(async () => { const id = await api.createOrg(orgName.trim()); setOrgName(''); orgs.reload(); roles.reload(); nav(`/teach/org/${id}`); }); }}>
            <Field label={t('org.new')}>{(p) => <input {...p} required maxLength={80} value={orgName} onChange={(e) => setOrgName(e.target.value)} />}</Field>
            <button className="btn small" type="submit" disabled={mkOrg.busy || !orgName.trim()}>{t('org.create')}</button>
            <ErrorLine error={mkOrg.error} />
          </form>
          <form onSubmit={(e) => { e.preventDefault(); void joinOrg.run(async () => { const o = await api.joinOrg(orgCode.trim()); if (!o) throw new TeachError('org.noCode'); setOrgCode(''); orgs.reload(); roles.reload(); return t('org.joined', { name: o.name }); }); }}>
            <Field label={t('org.join')} hint={t('org.joinHint')}>{(p) => <input {...p} dir="ltr" autoComplete="off" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} />}</Field>
            <button className="btn small alt" type="submit" disabled={joinOrg.busy || orgCode.trim().length < 4}>{t('org.joinBtn')}</button>
            {joinOrg.done && <Notice kind="good" live>{joinOrg.done}</Notice>}
            <ErrorLine error={joinOrg.error} />
          </form>
        </div>
      </section>
    </div>
  );
}
