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
    <div className="teach-workspace teach-dashboard">
      <header className="teach-page-heading">
        <div>
          <p className="teach-eyebrow">{t('nav.teach')}</p>
          <h1>{t('tc.title')}</h1>
        </div>
        <a className="teach-heading-action" href="#tc-new"><span aria-hidden="true">＋</span>{t('tc.newClass')}</a>
      </header>
      <ErrorLine error={classes.error} />
      <section className="teach-section" aria-labelledby="tc-classes">
        <div className="teach-section-heading">
          <div>
            <p className="teach-eyebrow">{t('tc.title')}</p>
            <h2 id="tc-classes">{t('tc.classes')}</h2>
          </div>
          <label className="teach-checkbox"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> <span>{t('tc.showArchived')}</span></label>
        </div>
        {classes.loading ? <Spinner label={t('app.loading')} /> : list.length === 0 ? <p>{t('tc.noClasses')}</p> : (
          <ul className="teach-class-list">
            {list.map((c) => (
              <li key={c.id}>
                <Link className="teach-class-link" to={`/teach/${c.id}`}>
                  <span className="teach-class-mark" aria-hidden="true"><span>{c.name.trim().charAt(0).toLocaleUpperCase()}</span></span>
                  <span className="teach-class-copy">
                    <strong>{c.name}</strong>
                    <small>{[c.term, orgName_(c.org_id)].filter(Boolean).join(' · ') || t('tc.title')}</small>
                  </span>
                  <span className="teach-class-badges">
                    {c.teacher_id !== user?.id && <span className="teach-tag">{t('tc.coTeaching')}</span>}
                    {c.archived_at && <span className="teach-tag is-archived">{t('cl.archived')}</span>}
                  </span>
                  <span className="teach-class-arrow" aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="teach-section teach-create-section" aria-labelledby="tc-new">
        <div className="teach-section-heading">
          <div>
            <p className="teach-eyebrow">{t('tc.classes')}</p>
            <h2 id="tc-new">{t('tc.newClass')}</h2>
          </div>
          <span className="teach-section-icon" aria-hidden="true">＋</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void create.run(async () => { const id = await api.createClass(name.trim(), term.trim(), org || null); nav(`/teach/${id}?tab=settings`); }); }}>
          <div className="teach-form-grid">
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
          </div>
          <div className="teach-form-actions">
            <button className="btn" type="submit" disabled={create.busy || !name.trim()}>{t('tc.create')}</button>
          </div>
          <ErrorLine error={create.error} />
        </form>
      </section>

      <section className="teach-section" aria-labelledby="tc-orgs">
        <div className="teach-section-heading">
          <div>
            <p className="teach-eyebrow">{t('tc.title')}</p>
            <h2 id="tc-orgs">{t('org.title')}</h2>
          </div>
        </div>
        <p className="teach-section-description">{t('org.intro')}</p>
        {(orgs.data ?? []).length > 0 && (
          <ul className="teach-org-list">
            {orgs.data!.map((o) => (
              <li key={o.id}>
                <span className="teach-org-symbol" aria-hidden="true">⌂</span>
                <strong>{o.name}</strong>
                <span className="teach-tag">{t('org.role.' + (roleOf(o.id) ?? 'teacher'))}</span>
                {roleOf(o.id) === 'admin' && <Link className="teach-org-manage" to={`/teach/org/${o.id}`}>{t('org.manage')}<span aria-hidden="true">↗</span></Link>}
              </li>
            ))}
          </ul>
        )}
        <div className="teach-org-forms">
          <form onSubmit={(e) => { e.preventDefault(); void mkOrg.run(async () => { const id = await api.createOrg(orgName.trim()); setOrgName(''); orgs.reload(); roles.reload(); nav(`/teach/org/${id}`); }); }}>
            <h3>{t('org.new')}</h3>
            <Field label={t('org.new')}>{(p) => <input {...p} required maxLength={80} value={orgName} onChange={(e) => setOrgName(e.target.value)} />}</Field>
            <button className="btn small" type="submit" disabled={mkOrg.busy || !orgName.trim()}>{t('org.create')}</button>
            <ErrorLine error={mkOrg.error} />
          </form>
          <form onSubmit={(e) => { e.preventDefault(); void joinOrg.run(async () => { const o = await api.joinOrg(orgCode.trim()); if (!o) throw new TeachError('org.noCode'); setOrgCode(''); orgs.reload(); roles.reload(); return t('org.joined', { name: o.name }); }); }}>
            <h3>{t('org.join')}</h3>
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
