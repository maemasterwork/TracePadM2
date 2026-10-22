import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Notice, Spinner } from '../../design/ui';
import { useI18n } from '../../i18n';
import { ErrorLine, useAction, useLoad } from '../hooks';
import { cellPct, cellStatus, gradebookCsv, gradebookRows, lmsCsv } from '../logic';
import { studentName, type TabProps } from './shared';

export function download(name: string, text: string, type = 'text/csv;charset=utf-8') {
  // a byte-order mark makes Excel read UTF-8 (Persian names) correctly
  const blob = new Blob(['﻿', text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function GradebookTab({ api, cls, roster }: TabProps) {
  const { t, num } = useI18n();
  const asg = useLoad(() => api.assignments(cls.id), [api, cls.id]);
  const cells = useLoad(() => api.gradebook(cls.id), [api, cls.id]);
  const overall = useLoad(() => api.overall(cls.id), [api, cls.id]);
  const act = useAction();
  const published = (asg.data ?? []).filter((a) => a.status === 'published');
  const rows = useMemo(() => gradebookRows(roster, cells.data ?? [], overall.data ?? []), [roster, cells.data, overall.data]);
  const now = Date.now();
  const slug = cls.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'class';

  if (asg.loading || cells.loading) return <Spinner label={t('app.loading')} />;
  const reload = () => { cells.reload(); overall.reload(); };
  return (
    <div>
      <ErrorLine error={asg.error ?? cells.error ?? overall.error ?? act.error} />
      <Notice kind="info">{t('tc.gb.rules')}</Notice>
      {published.length === 0 ? <p>{t('tc.noAsg')}</p> : (
        <section className="card" aria-labelledby="gb-h">
          <div className="row no-print" style={{ justifyContent: 'space-between' }}>
            <h2 id="gb-h" style={{ margin: 0 }}>{t('tc.gb.title')}</h2>
            <span className="row">
              <button type="button" className="btn small alt" onClick={() => download(`${slug}-grades.csv`, gradebookCsv(rows, published, now))}>{t('tc.gb.csv')}</button>
              <button type="button" className="btn small alt" onClick={() => download(`${slug}-lms.csv`, lmsCsv(rows, published))}>{t('tc.gb.lms')}</button>
              <button type="button" className="btn small alt" onClick={() => window.print()}>{t('tc.gb.print')}</button>
            </span>
          </div>
          <h2 className="print-only">{cls.name}</h2>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tc.gb.title')}>
            <table className="gradebook">
              <thead>
                <tr>
                  <th scope="col">{t('tc.student')}</th>
                  {published.map((a) => (
                    <th scope="col" key={a.id}>
                      {a.title}
                      <div className="no-print"><button type="button" className="btn small quiet" disabled={act.busy} onClick={() => void act.run(async () => { const n = await api.returnGrades(a.id, null, true); reload(); return String(n); })}>{t('tc.gb.return')}</button></div>
                    </th>
                  ))}
                  <th scope="col">{t('tc.overall')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student.id}>
                    <th scope="row">{studentName(r.student)}</th>
                    {published.map((a) => {
                      const c = r.cells.get(a.id);
                      const st = cellStatus(c, now);
                      const pct = cellPct(c);
                      return (
                        <td key={a.id} className={'gb-' + st}>
                          <Link to={`/teach/${cls.id}/review/${a.id}/${r.student.id}`} aria-label={`${studentName(r.student)}, ${a.title}: ${pct === null ? '–' : `${num(c!.final_score!)}/${num(c!.max_score)}`}`}>
                            {pct === null ? '–' : `${num(c!.final_score!)}/${num(c!.max_score)}`}
                          </Link>
                          <div className="muted-line">{t('tc.cell.' + st)}{c?.source === 'override' && ` · ${t('tc.gb.manual')}`}{c && c.submitted_at && !c.returned && ` · ${t('tc.gb.hidden')}`}</div>
                        </td>
                      );
                    })}
                    <td><strong>{r.overall === null ? '–' : num(r.overall) + '%'}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {act.done && <p role="status" className="no-print">{t('tc.gb.returned', { n: num(Number(act.done)) })}</p>}
        </section>
      )}
    </div>
  );
}
