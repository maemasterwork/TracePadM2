import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice, Spinner } from '../../design/ui';
import { useI18n } from '../../i18n';
import { ErrorLine, useLoad } from '../hooks';
import { itemLabel, kindOfKey } from '../labels';
import { distribution, heatMap, hintUsage, mostMissed, stuckStudents } from '../logic';
import { studentName, type TabProps } from './shared';

const level = (pct: number | null) => (pct === null ? 'none' : pct >= 85 ? 'a' : pct >= 60 ? 'b' : pct >= 30 ? 'c' : 'd');

export function Overview({ api, cls, roster, all }: TabProps) {
  const { t, pick, num } = useI18n();
  const [live, setLive] = useState(false);
  const [by, setBy] = useState<'chapter' | 'concept'>('chapter');
  const rows = useLoad(() => api.itemRows(cls.id), [api, cls.id], live ? 15_000 : 0);
  const overall = useLoad(() => api.overall(cls.id), [api, cls.id], live ? 15_000 : 0);
  const now = Date.now();
  const itemRows = rows.data ?? [];

  const heat = useMemo(() => {
    const chTitle = new Map(all.lessons.flatMap((l) => l.chapters.map((c) => [String(c.n), c.title] as const)));
    if (by === 'chapter') {
      const order = [...new Set([...all.items.values()].map((i) => String(i.ch)))].sort((a, b) => Number(a) - Number(b));
      return { ...heatMap(roster, itemRows, all.items, (i) => String(i.ch), order), title: (id: string) => `${num(Number(id))}. ${chTitle.get(id) ?? ''}` };
    }
    return { ...heatMap(roster, itemRows, all.items, (i) => i.tag ?? null), title: (id: string) => { const c = all.concepts.get(id); return c ? pick(c.name) : id; } };
  }, [by, roster, itemRows, all, pick, num]);

  const missed = useMemo(() => mostMissed(itemRows, all.items, (it, p) => (it.quiz ? pick(it.quiz.options[p] ?? { en: '?' }).replace(/<[^>]+>/g, '') : String(p))), [itemRows, all.items, pick]);
  const stuck = useMemo(() => stuckStudents(roster, itemRows, now), [roster, itemRows, now]);
  const hints = useMemo(() => hintUsage(itemRows), [itemRows]);
  const dist = useMemo(() => distribution((overall.data ?? []).map((o) => o.pct)), [overall.data]);
  const distMax = Math.max(1, ...dist);
  const active7 = new Set(itemRows.filter((r) => now - Date.parse(r.updated_at) < 7 * 86_400_000).map((r) => r.student_id)).size;
  const label = (key: string) => itemLabel(all.items.get(key), key, pick, (k) => t('cl.kind.' + k));

  if (rows.loading && !rows.data) return <Spinner label={t('app.loading')} />;
  return (
    <div>
      <ErrorLine error={rows.error ?? overall.error} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p>{t('tc.ov.summary', { n: num(roster.length), active: num(active7) })}</p>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> {t('tc.ov.live')}</label>
      </div>
      {roster.length === 0 && <Notice kind="info">{t('tc.ov.noStudents')}</Notice>}
      <Notice kind="info">{t('tc.ov.selfReported')}</Notice>

      <section className="card" aria-labelledby="heat-h">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="heat-h" style={{ margin: 0 }}>{t('tc.ov.heat')}</h2>
          <span className="row" role="group" aria-label={t('tc.ov.heatBy')}>
            <button type="button" className={'btn small ' + (by === 'chapter' ? '' : 'quiet')} aria-pressed={by === 'chapter'} onClick={() => setBy('chapter')}>{t('tc.ov.byChapter')}</button>
            <button type="button" className={'btn small ' + (by === 'concept' ? '' : 'quiet')} aria-pressed={by === 'concept'} onClick={() => setBy('concept')}>{t('tc.ov.byConcept')}</button>
          </span>
        </div>
        <p className="muted-line">{t('tc.ov.heatHelp')}</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tc.ov.heat')}>
          <table className="heat">
            <thead><tr><th scope="col">{t('tc.student')}</th>{heat.columns.map((c) => <th scope="col" key={c.id} title={heat.title(c.id)}><span className="heat-h">{heat.title(c.id)}</span></th>)}</tr></thead>
            <tbody>
              <tr className="avg"><th scope="row">{t('tc.ov.classAvg')}</th>{heat.classAvg.map((v, i) => <td key={i} className={'h-' + level(v)}>{v === null ? '–' : num(Math.round(v)) + '%'}</td>)}</tr>
              {heat.rows.map((r) => (
                <tr key={r.student.id}>
                  <th scope="row">{studentName(r.student)}</th>
                  {r.cells.map((c, i) => {
                    const pct = c.tried === 0 ? null : Math.round((100 * c.done) / c.total);
                    return <td key={i} className={'h-' + level(pct)} title={t('tc.ov.cellTitle', { done: num(c.done), total: num(c.total), tried: num(c.tried) })}>{pct === null ? '–' : num(pct) + '%'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted-line">{t('tc.ov.legend')}</p>
      </section>

      <div className="grid-2">
        <section className="card" aria-labelledby="stuck-h">
          <h2 id="stuck-h" style={{ marginTop: 0 }}>{t('tc.ov.stuck')}</h2>
          <p className="muted-line">{t('tc.ov.stuckHelp')}</p>
          {stuck.length === 0 ? <p>{t('tc.ov.nobodyStuck')}</p> : (
            <ul className="plain-list">
              {stuck.map((s) => (
                <li key={s.student.id}>
                  <Link to={`/teach/${cls.id}?tab=students&student=${s.student.id}`}><strong>{studentName(s.student)}</strong></Link>
                  {' '}{s.reasons.map((r) => <span key={r} className="chip warn" style={{ marginInlineEnd: 4 }}>{t('tc.ov.reason.' + r, { n: num(s.idleDays ?? 0) })}</span>)}
                  {s.repeated.length > 0 && <div className="muted-line">{t('tc.ov.repeated')}: {s.repeated.slice(0, 3).map(label).join(' · ')}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="dist-h">
          <h2 id="dist-h" style={{ marginTop: 0 }}>{t('tc.ov.dist')}</h2>
          <p className="muted-line">{t('tc.ov.distHelp')}</p>
          <ol className="bars" aria-label={t('tc.ov.dist')}>
            {dist.map((n, i) => (
              <li key={i}><span className="bar-l" dir="ltr">{num(i * 10)}–{num(i === 9 ? 100 : i * 10 + 9)}</span><span className="bar" style={{ inlineSize: `${(100 * n) / distMax}%` }} /><span className="bar-n">{num(n)}</span></li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card" aria-labelledby="miss-h">
        <h2 id="miss-h" style={{ marginTop: 0 }}>{t('tc.ov.missed')}</h2>
        <p className="muted-line">{t('tc.ov.missedHelp')}</p>
        {missed.length === 0 ? <p>{t('tc.ov.noMissed')}</p> : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tc.ov.missed')}>
            <table>
              <thead><tr><th scope="col">{t('tc.ov.item')}</th><th scope="col">{t('tc.ov.wrong')}</th><th scope="col">{t('tc.ov.common')}</th></tr></thead>
              <tbody>
                {missed.map((m) => (
                  <tr key={m.key}>
                    <td>{label(m.key)} <span className="muted-line">({t('cl.kind.' + kindOfKey(m.key))})</span></td>
                    <td>{t('tc.ov.wrongOf', { w: num(m.wrong), n: num(m.attempted) })}</td>
                    <td dir="auto">{m.common.length === 0 ? '–' : m.common.map((c) => `${c.answer} ×${num(c.count)}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="hint-h">
        <h2 id="hint-h" style={{ marginTop: 0 }}>{t('tc.ov.hints')}</h2>
        {hints.length === 0 ? <p>{t('tc.ov.noHints')}</p> : (
          <ul className="plain-list">{hints.slice(0, 8).map((h) => <li key={h.key}>{label(h.key)}: {t('tc.ov.hintsLine', { s: num(h.students), h: num(h.hints) })}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
