import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, Notice } from '../../design/ui';
import { useI18n } from '../../i18n';
import { ErrorLine, useAction, useLoad } from '../hooks';
import type { TabProps } from './shared';

export function SettingsTab({ api, cls, isOwner, reloadClass }: TabProps) {
  const { t, date } = useI18n();
  const nav = useNavigate();
  const info = useLoad(() => api.joinInfo(cls.id), [api, cls.id, cls.join_code_expires_at]);
  const staff = useLoad(() => api.staff(cls.id), [api, cls.id]);
  const orgMembers = useLoad(cls.org_id ? () => api.orgMembers(cls.org_id!) : null, [api, cls.org_id]);
  const [name, setName] = useState(cls.name); const [term, setTerm] = useState(cls.term);
  const [days, setDays] = useState('');
  const [dupName, setDupName] = useState(cls.name); const [dupTerm, setDupTerm] = useState(''); const [copy, setCopy] = useState(true);
  const [addUser, setAddUser] = useState(''); const [addRole, setAddRole] = useState<'teacher' | 'ta'>('ta');
  const [confirmName, setConfirmName] = useState('');
  const rename = useAction(); const code = useAction(); const arch = useAction(); const dup = useAction(); const st = useAction(); const del = useAction();
  const expired = info.data?.expires_at ? Date.parse(info.data.expires_at) < Date.now() : false;
  const candidates = (orgMembers.data ?? []).filter((m) => !(staff.data ?? []).some((s) => s.user_id === m.user_id));

  return (
    <div>
      <section className="card" aria-labelledby="set-name">
        <h2 id="set-name" style={{ marginTop: 0 }}>{t('tc.set.details')}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void rename.run(async () => { await api.renameClass(cls.id, name.trim(), term.trim()); reloadClass(); return t('tc.set.saved'); }); }}>
          <Field label={t('tc.className')}>{(p) => <input {...p} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={t('tc.term')}>{(p) => <input {...p} maxLength={40} value={term} onChange={(e) => setTerm(e.target.value)} />}</Field>
          <button className="btn small" type="submit" disabled={rename.busy || !name.trim()}>{t('tc.save')}</button>
        </form>
        {rename.done && <Notice kind="good" live>{rename.done}</Notice>}<ErrorLine error={rename.error} />
      </section>

      <section className="card" aria-labelledby="set-code">
        <h2 id="set-code" style={{ marginTop: 0 }}>{t('tc.set.code')}</h2>
        <p className="muted-line">{t('tc.set.codeHelp')}</p>
        <p style={{ fontSize: '1.8rem', letterSpacing: '0.2em' }} dir="ltr" data-testid="join-code"><code>{info.data?.join_code ?? '…'}</code></p>
        <p>{info.data?.expires_at ? (expired ? <span className="chip bad">{t('tc.set.closed')}</span> : t('tc.set.expires', { when: date(info.data.expires_at, { dateStyle: 'medium', timeStyle: 'short' }) })) : t('tc.set.noExpiry')}</p>
        <div className="row">
          <Field label={t('tc.set.days')}>{(p) => (
            <select {...p} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="">{t('tc.set.never')}</option><option value="1">{t('tc.set.d1')}</option><option value="7">{t('tc.set.d7')}</option><option value="30">{t('tc.set.d30')}</option>
            </select>
          )}</Field>
          <button type="button" className="btn small" disabled={code.busy} onClick={() => void code.run(async () => { await api.rotateCode(cls.id, days ? Number(days) : null); info.reload(); reloadClass(); return t('tc.set.rotated'); })}>{t('tc.set.rotate')}</button>
          <button type="button" className="btn small alt" disabled={code.busy || expired} onClick={() => void code.run(async () => { await api.closeJoining(cls.id); info.reload(); reloadClass(); return t('tc.set.closedNow'); })}>{t('tc.set.close')}</button>
        </div>
        {code.done && <Notice kind="good" live>{code.done}</Notice>}<ErrorLine error={code.error} />
      </section>

      <section className="card" aria-labelledby="set-staff">
        <h2 id="set-staff" style={{ marginTop: 0 }}>{t('tc.set.staff')}</h2>
        <ul className="plain-list">
          {(staff.data ?? []).map((s) => (
            <li key={s.user_id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{s.full_name || s.user_id.slice(0, 8)} <span className="chip">{t('tc.set.role.' + s.role)}</span></span>
              {isOwner && s.role !== 'owner' && <button type="button" className="btn small quiet" disabled={st.busy} onClick={() => void st.run(async () => { await api.setStaff(cls.id, s.user_id, null); staff.reload(); })}>{t('tc.remove')}</button>}
            </li>
          ))}
        </ul>
        {isOwner && (cls.org_id ? (
          <form className="row" onSubmit={(e) => { e.preventDefault(); void st.run(async () => { await api.setStaff(cls.id, addUser, addRole); setAddUser(''); staff.reload(); }); }}>
            <Field label={t('tc.set.addPerson')}>{(p) => <select {...p} required value={addUser} onChange={(e) => setAddUser(e.target.value)}><option value="">–</option>{candidates.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.username || m.user_id.slice(0, 8)}</option>)}</select>}</Field>
            <Field label={t('tc.set.roleLabel')}>{(p) => <select {...p} value={addRole} onChange={(e) => setAddRole(e.target.value as 'teacher' | 'ta')}><option value="ta">{t('tc.set.role.ta')}</option><option value="teacher">{t('tc.set.role.teacher')}</option></select>}</Field>
            <button className="btn small" type="submit" disabled={st.busy || !addUser}>{t('tc.set.add')}</button>
          </form>
        ) : <p className="muted-line">{t('tc.set.needOrg')}</p>)}
        <ErrorLine error={st.error} />
      </section>

      <section className="card" aria-labelledby="set-life">
        <h2 id="set-life" style={{ marginTop: 0 }}>{t('tc.set.life')}</h2>
        <p>
          <button type="button" className="btn alt" disabled={arch.busy} onClick={() => void arch.run(async () => { await api.archive(cls.id, !cls.archived_at); reloadClass(); return t(cls.archived_at ? 'tc.set.unarchived' : 'tc.set.archivedNow'); })}>{cls.archived_at ? t('tc.set.unarchive') : t('tc.set.archive')}</button>
          <span className="muted-line"> {t('tc.set.archiveHelp')}</span>
        </p>
        {arch.done && <Notice kind="good" live>{arch.done}</Notice>}<ErrorLine error={arch.error} />
        <h3>{t('tc.set.dup')}</h3>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void dup.run(async () => { const id = await api.duplicate(cls.id, dupName.trim(), dupTerm.trim(), copy); nav(`/teach/${id}?tab=settings`); }); }}>
          <Field label={t('tc.className')}>{(p) => <input {...p} required maxLength={80} value={dupName} onChange={(e) => setDupName(e.target.value)} />}</Field>
          <Field label={t('tc.term')}>{(p) => <input {...p} maxLength={40} value={dupTerm} onChange={(e) => setDupTerm(e.target.value)} />}</Field>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /> {t('tc.set.dupCopy')}</label>
          <button className="btn small" type="submit" disabled={dup.busy || !dupName.trim()}>{t('tc.set.dupBtn')}</button>
        </form>
        <ErrorLine error={dup.error} />
      </section>

      {isOwner && (
        <section className="card" aria-labelledby="set-del">
          <h2 id="set-del" style={{ marginTop: 0 }}>{t('tc.set.danger')}</h2>
          <p>{t('tc.set.deleteHelp')}</p>
          <form className="row" onSubmit={(e) => { e.preventDefault(); void del.run(async () => { await api.deleteClass(cls.id); nav('/teach'); }); }}>
            <Field label={t('tc.set.typeName', { name: cls.name })}>{(p) => <input {...p} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />}</Field>
            <button className="btn danger small" type="submit" disabled={del.busy || confirmName !== cls.name}>{t('tc.set.deleteBtn')}</button>
          </form>
          <ErrorLine error={del.error} />
        </section>
      )}
    </div>
  );
}
