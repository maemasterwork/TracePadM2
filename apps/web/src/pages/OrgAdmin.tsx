import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Field, Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { ErrorLine, Gate, useAction, useLoad, useTeachApi } from '../teach/hooks';

export function OrgAdmin() { return <Gate need="teacher"><Inner /></Gate>; }

function Inner() {
  const { orgId = '' } = useParams();
  const { t, num, date } = useI18n();
  const api = useTeachApi()!;
  const orgs = useLoad(() => api.orgs(), [api]);
  const summary = useLoad(() => api.orgSummary(orgId), [api, orgId]);
  const members = useLoad(() => api.orgMembers(orgId), [api, orgId]);
  const report = useLoad(() => api.orgReport(orgId), [api, orgId]);
  const invite = useLoad(() => api.orgInvite(orgId), [api, orgId]);
  const org = orgs.data?.find((o) => o.id === orgId);
  const [seats, setSeats] = useState<string | null>(null); const [name, setName] = useState<string | null>(null);
  const seatAct = useAction(); const nameAct = useAction(); const mem = useAction(); const inv = useAction();

  if (orgs.loading || summary.loading) return <Spinner label={t('app.loading')} />;
  if (!org || summary.error) return <div style={{ maxWidth: 640, margin: '24px auto' }}><Notice kind="bad">{t('org.notAdmin')}</Notice><p><Link to="/teach">{t('tc.title')}</Link></p></div>;
  const s = summary.data!;
  const seatVal = seats ?? (org.seat_limit === null ? '' : String(org.seat_limit));
  return (
    <div style={{ maxWidth: 960, margin: '24px auto' }}>
      <p><Link to="/teach">← {t('tc.title')}</Link></p>
      <h1>{org.name}</h1>
      <ErrorLine error={members.error ?? report.error ?? invite.error} />
      <section className="card" aria-labelledby="org-sum">
        <h2 id="org-sum" style={{ marginTop: 0 }}>{t('org.summary')}</h2>
        <ul className="stats">
          <li><strong>{num(s.teachers)}</strong> {t('org.teachers')}</li>
          <li><strong>{num(s.classes)}</strong> {t('org.activeClasses')}</li>
          <li><strong>{num(s.archived_classes)}</strong> {t('org.archivedClasses')}</li>
          <li><strong>{num(s.seats_used)}{s.seat_limit !== null && ` / ${num(s.seat_limit)}`}</strong> {t('org.seats')}</li>
        </ul>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void seatAct.run(async () => { await api.setSeats(orgId, seatVal === '' ? null : Number(seatVal)); orgs.reload(); summary.reload(); return t('tc.set.saved'); }); }}>
          <Field label={t('org.seatLimit')} hint={t('org.seatHint')}>{(p) => <input {...p} type="number" min={1} dir="ltr" value={seatVal} onChange={(e) => setSeats(e.target.value)} />}</Field>
          <button className="btn small" type="submit" disabled={seatAct.busy}>{t('tc.save')}</button>
        </form>
        {seatAct.done && <Notice kind="good" live>{seatAct.done}</Notice>}<ErrorLine error={seatAct.error} />
        <form className="row" onSubmit={(e) => { e.preventDefault(); void nameAct.run(async () => { await api.renameOrg(orgId, (name ?? org.name).trim()); setName(null); orgs.reload(); return t('tc.set.saved'); }); }}>
          <Field label={t('org.name')}>{(p) => <input {...p} required maxLength={80} value={name ?? org.name} onChange={(e) => setName(e.target.value)} />}</Field>
          <button className="btn small" type="submit" disabled={nameAct.busy}>{t('tc.save')}</button>
        </form>
        <ErrorLine error={nameAct.error} />
      </section>

      <section className="card" aria-labelledby="org-inv">
        <h2 id="org-inv" style={{ marginTop: 0 }}>{t('org.invite')}</h2>
        <p className="muted-line">{t('org.inviteHelp')}</p>
        <p style={{ fontSize: '1.6rem', letterSpacing: '0.18em' }} dir="ltr" data-testid="org-code"><code>{invite.data ?? '…'}</code></p>
        <button type="button" className="btn small alt" disabled={inv.busy} onClick={() => void inv.run(async () => { await api.rotateOrgInvite(orgId); invite.reload(); return t('org.rotated'); })}>{t('org.rotate')}</button>
        {inv.done && <Notice kind="good" live>{inv.done}</Notice>}<ErrorLine error={inv.error} />
      </section>

      <section className="card" aria-labelledby="org-mem">
        <h2 id="org-mem" style={{ marginTop: 0 }}>{t('org.members')}</h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('org.members')}>
          <table>
            <thead><tr><th scope="col">{t('tc.student')}</th><th scope="col">{t('org.roleLabel')}</th><th scope="col">{t('org.classesOwned')}</th><th scope="col"><span className="sr-only">{t('tc.actions')}</span></th></tr></thead>
            <tbody>
              {(members.data ?? []).map((m) => (
                <tr key={m.user_id}>
                  <th scope="row">{m.full_name || m.username || m.user_id.slice(0, 8)}</th>
                  <td>
                    <select aria-label={t('org.roleLabel')} value={m.role} disabled={mem.busy} onChange={(e) => void mem.run(async () => { await api.setOrgMember(orgId, m.user_id, e.target.value as 'admin' | 'teacher'); members.reload(); })}>
                      <option value="admin">{t('org.role.admin')}</option><option value="teacher">{t('org.role.teacher')}</option>
                    </select>
                  </td>
                  <td>{num(m.classes)}</td>
                  <td><button type="button" className="btn small quiet" disabled={mem.busy} onClick={() => { if (window.confirm(t('org.removeConfirm'))) void mem.run(async () => { await api.setOrgMember(orgId, m.user_id, null); members.reload(); }); }}>{t('tc.remove')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ErrorLine error={mem.error} />
      </section>

      <section className="card" aria-labelledby="org-rep">
        <h2 id="org-rep" style={{ marginTop: 0 }}>{t('org.report')}</h2>
        <p className="muted-line">{t('org.reportNote')}</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('org.report')}>
          <table>
            <thead><tr>
              <th scope="col">{t('tc.className')}</th><th scope="col">{t('org.teacher')}</th><th scope="col">{t('org.students')}</th><th scope="col">{t('org.assignments')}</th>
              <th scope="col">{t('org.submissions')}</th><th scope="col">{t('org.avg')}</th><th scope="col">{t('org.lastSub')}</th>
            </tr></thead>
            <tbody>
              {(report.data ?? []).map((r) => (
                <tr key={r.class_id}>
                  <th scope="row">{r.name}{r.term && <span className="muted-line"> · {r.term}</span>}{r.archived && <span className="chip warn" style={{ marginInlineStart: 6 }}>{t('cl.archived')}</span>}</th>
                  <td>{r.teacher_name}</td><td>{num(r.students)}</td><td>{num(r.assignments)}</td><td>{num(r.submissions)}</td>
                  <td>{r.avg_pct === null ? '–' : num(r.avg_pct) + '%'}</td><td>{r.last_submission ? date(r.last_submission, { dateStyle: 'medium' }) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
