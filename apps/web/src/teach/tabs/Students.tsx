import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Notice, Spinner } from '../../design/ui';
import { useI18n } from '../../i18n';
import { ErrorLine, useAction, useLoad } from '../hooks';
import { cellPct, cellStatus, dailyBuckets, studentTimeline } from '../logic';
import { studentName, type TabProps } from './shared';

export function Students(p: TabProps) {
  const { api, cls, roster, reloadRoster } = p;
  const { t, num, date } = useI18n();
  const [sp, setSp] = useSearchParams();
  const sel = sp.get('student');
  const overall = useLoad(() => api.overall(cls.id), [api, cls.id]);
  const rows = useLoad(() => api.itemRows(cls.id), [api, cls.id]);
  const remove = useAction();
  const ov = new Map((overall.data ?? []).map((o) => [o.student_id, o.pct]));
  const last = useMemo(() => { const m = new Map<string, number>(); for (const r of rows.data ?? []) m.set(r.student_id, Math.max(m.get(r.student_id) ?? 0, Date.parse(r.updated_at))); return m; }, [rows.data]);
  const student = roster.find((s) => s.id === sel);

  return (
    <div>
      <ErrorLine error={overall.error ?? rows.error ?? remove.error} />
      {roster.length === 0 ? <Notice kind="info">{t('tc.ov.noStudents')}</Notice> : (
        <section className="card" aria-labelledby="roster-h">
          <h2 id="roster-h" style={{ marginTop: 0 }}>{t('tc.students', { n: num(roster.length) })}</h2>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tc.students', { n: num(roster.length) })}>
            <table>
              <thead><tr><th scope="col">{t('tc.student')}</th><th scope="col">{t('tc.username')}</th><th scope="col">{t('tc.overall')}</th><th scope="col">{t('tc.lastActive')}</th><th scope="col"><span className="sr-only">{t('tc.actions')}</span></th></tr></thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id} aria-current={s.id === sel ? 'true' : undefined}>
                    <th scope="row"><button type="button" className="linklike" onClick={() => setSp({ tab: 'students', student: s.id })}>{studentName(s)}</button></th>
                    <td dir="ltr">{s.username ?? '–'}</td>
                    <td>{ov.get(s.id) == null ? '–' : num(ov.get(s.id)!) + '%'}</td>
                    <td>{last.get(s.id) ? date(last.get(s.id)!, { dateStyle: 'medium' }) : t('tc.never')}</td>
                    <td><button type="button" className="btn small quiet" disabled={remove.busy} onClick={() => { if (window.confirm(t('tc.removeConfirm', { name: studentName(s) }))) void remove.run(async () => { await api.removeStudent(cls.id, s.id); reloadRoster(); }); }}>{t('tc.remove')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {student && <StudentDetail {...p} student={student} onClose={() => setSp({ tab: 'students' })} />}
    </div>
  );
}

function StudentDetail({ api, cls, all, student, onClose }: TabProps & { student: { id: string; full_name: string; username: string | null }; onClose: () => void }) {
  const { t, num, date } = useI18n();
  const asg = useLoad(() => api.assignments(cls.id), [api, cls.id]);
  const cells = useLoad(() => api.gradebook(cls.id), [api, cls.id]);
  const rows = useLoad(() => api.itemRows(cls.id), [api, cls.id]);
  const mine = (rows.data ?? []).filter((r) => r.student_id === student.id);
  const timeline = useMemo(() => studentTimeline(mine), [mine]);
  const days = useMemo(() => dailyBuckets(timeline), [timeline]);
  const done = mine.filter((r) => (r.key.startsWith('ex:') ? r.data.pass === true : r.data.right === true)).length;
  const published = (asg.data ?? []).filter((a) => a.status === 'published');
  const byA = new Map((cells.data ?? []).filter((c) => c.student_id === student.id).map((c) => [c.assignment_id, c]));
  if (rows.loading || asg.loading) return <Spinner label={t('app.loading')} />;
  return (
    <section className="card" aria-labelledby="sd-h">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="sd-h" style={{ margin: 0 }}>{studentName(student)}</h2>
        <button type="button" className="btn small quiet" onClick={onClose}>{t('tc.close')}</button>
      </div>
      <p>{t('tc.sd.summary', { done: num(done), total: num(all.items.size), tried: num(mine.filter((r) => /^(pred|quiz|ex):/.test(r.key)).length) })}</p>
      <h3>{t('tc.sd.assignments')}</h3>
      {published.length === 0 ? <p>{t('tc.noAsg')}</p> : (
        <ul className="plain-list">
          {published.map((a) => {
            const c = byA.get(a.id);
            const pct = cellPct(c);
            return <li key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{a.title}</span>
              <span className="row" style={{ gap: 6 }}>
                <span className="chip">{t('tc.cell.' + cellStatus(c, Date.now()))}</span>
                {pct !== null && <span>{num(pct)}%</span>}
                <Link className="btn small alt" to={`/teach/${cls.id}/review/${a.id}/${student.id}`}>{t('tc.review')}</Link>
              </span>
            </li>;
          })}
        </ul>
      )}
      <h3>{t('tc.sd.timeline')}</h3>
      <p className="muted-line">{t('tc.sd.timelineNote')}</p>
      {days.length === 0 ? <p>{t('tc.sd.noActivity')}</p> : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tc.sd.timeline')}>
          <table>
            <thead><tr><th scope="col">{t('tc.sd.day')}</th><th scope="col">{t('tc.sd.attempts')}</th><th scope="col">{t('tc.sd.right')}</th></tr></thead>
            <tbody>{days.map((d) => <tr key={d.day}><th scope="row">{date(new Date(d.day + 'T12:00:00'), { dateStyle: 'medium' })}</th><td>{num(d.attempts)}</td><td>{num(d.right)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
