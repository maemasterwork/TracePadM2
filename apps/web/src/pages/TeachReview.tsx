import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Field, Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useAllLabs } from '../learn/hooks';
import { buildTestCode, judge } from '../learn/grading';
import { useRunner } from '../runner/RunnerProvider';
import { ErrorLine, Gate, useAction, useLoad, useTeachApi } from '../teach/hooks';
import { itemLabel } from '../teach/labels';
import { integrityNotes } from '../teach/logic';
import { studentName } from '../teach/tabs/shared';

export function TeachReview() { return <Gate need="teacher"><Inner /></Gate>; }

type Check = { passed: number; total: number; matches: boolean } | 'nocode' | 'running';

function Inner() {
  const { classId = '', assignmentId = '', studentId = '' } = useParams();
  const { t, pick, num, date } = useI18n();
  const api = useTeachApi()!;
  const all = useAllLabs();
  const runner = useRunner();
  const asg = useLoad(() => api.assignments(classId), [api, classId]);
  const roster = useLoad(() => api.roster(classId), [api, classId]);
  const subs = useLoad(() => api.submissions(assignmentId, studentId), [api, assignmentId, studentId]);
  const cells = useLoad(() => api.gradebook(classId), [api, classId]);
  const hist = useLoad(() => api.gradeHistory(assignmentId, studentId), [api, assignmentId, studentId]);
  const comments = useLoad(() => api.comments(assignmentId, studentId), [api, assignmentId, studentId]);
  const [pickN, setPickN] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [score, setScore] = useState<string | null>(null); const [reason, setReason] = useState(''); const [note, setNote] = useState<string | null>(null);
  const [text, setText] = useState('');
  const grade = useAction(); const ret = useAction(); const cm = useAction();

  const a = asg.data?.find((x) => x.id === assignmentId);
  const student = roster.data?.find((s) => s.id === studentId);
  const cell = cells.data?.find((c) => c.student_id === studentId && c.assignment_id === assignmentId);
  const sub = useMemo(() => { const l = subs.data ?? []; return l.find((s) => s.n === pickN) ?? l[l.length - 1]; }, [subs.data, pickN]);
  const label = (key: string) => itemLabel(all.items.get(key), key, pick, (k) => t('cl.kind.' + k));
  const flags = sub && a ? integrityNotes(sub.signals, sub.detail, sub.snapshot, a.items.filter((i) => i.key.startsWith('ex:')).length) : [];

  if (asg.loading || roster.loading || subs.loading || cells.loading || !all.ready) return <Spinner label={t('app.loading')} />;
  if (!a || !student) return <div style={{ maxWidth: 640, margin: '24px auto' }}><Notice kind="bad">{t('cl.notFound')}</Notice><p><Link to={`/teach/${classId}?tab=gradebook`}>{t('tc.tab.gradebook')}</Link></p></div>;

  const verify = async (key: string) => {
    const it = all.items.get(key);
    const code = sub?.snapshot[key]?.code;
    if (!it?.ex || typeof code !== 'string' || !code) { setChecks((c) => ({ ...c, [key]: 'nocode' })); return; }
    setChecks((c) => ({ ...c, [key]: 'running' }));
    let passed = 0;
    for (let i = 0; i < it.ex.tests.length; i++) {
      const tc = it.ex.tests[i];
      const { code: c, paramMatched } = buildTestCode(it.ex, code, tc);
      const r = await runner.run({ code: c });
      if (judge(it.ex, tc, i, r, paramMatched).pass) passed += 1;
    }
    const total = it.ex.tests.length;
    setChecks((c) => ({ ...c, [key]: { passed, total, matches: (passed === total) === (sub!.snapshot[key].pass === true) } }));
  };

  const current = cell?.final_score ?? null;
  const shown = score ?? (cell?.override_score != null ? String(cell.override_score) : '');
  const shownNote = note ?? cell?.comment ?? '';

  return (
    <div style={{ maxWidth: 900, margin: '24px auto' }}>
      <p><Link to={`/teach/${classId}?tab=gradebook`}>← {t('tc.tab.gradebook')}</Link></p>
      <h1>{a.title}</h1>
      <h2 style={{ marginTop: 0 }}>{studentName(student)}</h2>
      <ErrorLine error={asg.error ?? subs.error ?? cells.error} />

      {!sub ? <Notice kind="warn">{t('tc.rv.none')}</Notice> : (
        <>
          <div className="row">
            {(subs.data ?? []).length > 1 && (
              <Field label={t('tc.rv.which')}>{(p) => <select {...p} value={sub.n} onChange={(e) => setPickN(Number(e.target.value))}>{subs.data!.map((s) => <option key={s.n} value={s.n}>#{num(s.n)} · {date(s.submitted_at, { dateStyle: 'short', timeStyle: 'short' })}</option>)}</select>}</Field>
            )}
            <p>
              {t('cl.submittedAt', { when: date(sub.submitted_at, { dateStyle: 'medium', timeStyle: 'short' }) })}
              {sub.late_seconds > 0 && <> · <span className="chip warn">{t('cl.wasLate')}{sub.penalty_pct > 0 ? ` (−${num(sub.penalty_pct)}%)` : ''}</span></>}
              {' · '}{t('tc.rv.auto', { score: num(sub.score), max: num(sub.max_score) })}
            </p>
          </div>

          <section className="card" aria-labelledby="rv-items">
            <h3 id="rv-items" style={{ marginTop: 0 }}>{t('tc.rv.items')}</h3>
            <p className="muted-line">{t('tc.rv.itemsNote')}</p>
            {sub.detail.map((d) => {
              const snap = sub.snapshot[d.key] as { code?: string; pass?: boolean; sol?: boolean } | undefined;
              const chk = checks[d.key];
              return (
                <div key={d.key} className="rv-item">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{label(d.key)}</strong>
                    <span><span className={'chip ' + (d.state === 'correct' ? 'good' : d.state === 'partial' ? 'warn' : d.state === 'blank' ? '' : 'bad')}>{t('cl.itemState.' + d.state)}</span> {num(d.earned)}/{num(d.points)}</span>
                  </div>
                  <p className="muted-line">{t('tc.rv.itemMeta', { h: num(d.hints), a: num(d.attempts), p: num(d.pastes) })}{snap?.sol && ` · ${t('tc.rv.solutionSeen')}`}</p>
                  {typeof snap?.code === 'string' && snap.code && (
                    <>
                      <pre className="lab-code" dir="ltr" tabIndex={0}><code>{snap.code}</code></pre>
                      <p className="row">
                        <button type="button" className="btn small alt" disabled={chk === 'running'} onClick={() => void verify(d.key)}>{chk === 'running' ? t('lab.checking') : t('tc.rv.rerun')}</button>
                        {chk && chk !== 'running' && chk !== 'nocode' && <span role="status" className={'chip ' + (chk.matches ? 'good' : 'bad')}>{t(chk.matches ? 'tc.rv.matches' : 'tc.rv.differs', { k: num(chk.passed), n: num(chk.total) })}</span>}
                        {chk === 'nocode' && <span className="chip warn">{t('tc.rv.nocode')}</span>}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </section>

          <section className="card" aria-labelledby="rv-int">
            <h3 id="rv-int" style={{ marginTop: 0 }}>{t('tc.rv.signals')}</h3>
            <Notice kind="info">{t('tc.rv.signalsHonest')}</Notice>
            <ul>
              <li>{t('tc.rv.sigTime', { m: num(Math.round((sub.signals.secs ?? 0) / 60)) })}</li>
              <li>{t('tc.rv.sigPastes', { n: num(sub.signals.pastes ?? 0) })}</li>
            </ul>
            {flags.length === 0 ? <p>{t('tc.rv.noFlags')}</p> : (
              <ul>{flags.map((f, i) => <li key={i}>{t('tc.rv.flag.' + f.kind, { item: f.item ? label(f.item) : '', n: num(f.n ?? 0) })}</li>)}</ul>
            )}
          </section>
        </>
      )}

      <section className="card" aria-labelledby="rv-grade">
        <h3 id="rv-grade" style={{ marginTop: 0 }}>{t('tc.rv.grade')}</h3>
        <p>{t('tc.rv.current', { score: current === null ? '–' : num(current), max: num(cell?.max_score ?? 0) })} {cell?.source === 'override' && <span className="chip">{t('tc.gb.manual')}</span>} {cell?.returned ? <span className="chip good">{t('tc.rv.returned')}</span> : <span className="chip warn">{t('tc.gb.hidden')}</span>}</p>
        <form onSubmit={(e) => { e.preventDefault(); void grade.run(async () => { await api.setGrade(assignmentId, studentId, shown === '' ? null : Number(shown), shownNote, reason.trim()); setReason(''); setScore(null); setNote(null); cells.reload(); hist.reload(); return t('tc.set.saved'); }); }}>
          <div className="grid-2">
            <Field label={t('tc.rv.score')} hint={t('tc.rv.scoreHint', { max: num(cell?.max_score ?? 0) })}>{(p) => <input {...p} type="number" min={0} step={0.5} dir="ltr" value={shown} onChange={(e) => setScore(e.target.value)} />}</Field>
            <Field label={t('tc.rv.reason')} hint={t('tc.rv.reasonHint')}>{(p) => <input {...p} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          </div>
          <Field label={t('tc.rv.comment')}>{(p) => <textarea {...p} rows={3} maxLength={2000} value={shownNote} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="row">
            <button className="btn" type="submit" disabled={grade.busy}>{t('tc.save')}</button>
            {cell?.override_score != null && <button type="button" className="btn alt" disabled={grade.busy} onClick={() => void grade.run(async () => { await api.setGrade(assignmentId, studentId, null, shownNote, 'clear'); setScore(null); cells.reload(); hist.reload(); })}>{t('tc.rv.clear')}</button>}
            <button type="button" className="btn alt" disabled={ret.busy} onClick={() => void ret.run(async () => { await api.returnGrades(assignmentId, [studentId], !cell?.returned); cells.reload(); return t(cell?.returned ? 'tc.rv.hiddenNow' : 'tc.rv.returnedNow'); })}>{cell?.returned ? t('tc.rv.hide') : t('tc.rv.return')}</button>
          </div>
        </form>
        {(grade.done || ret.done) && <Notice kind="good" live>{grade.done ?? ret.done}</Notice>}
        <ErrorLine error={grade.error ?? ret.error} />
        <h4>{t('tc.rv.history')}</h4>
        {(hist.data ?? []).length === 0 ? <p className="muted-line">{t('tc.rv.noHistory')}</p> : (
          <ul className="plain-list">{hist.data!.map((h, i) => <li key={i}>{date(h.at, { dateStyle: 'short', timeStyle: 'short' })} · {h.actor_name ?? '?'} · {h.old_score === null ? '–' : num(h.old_score)} → {h.new_score === null ? '–' : num(h.new_score)} · {h.reason}</li>)}</ul>
        )}
      </section>

      <section className="card" aria-labelledby="rv-comments">
        <h3 id="rv-comments" style={{ marginTop: 0 }}>{t('cl.comments', { n: num((comments.data ?? []).length) })}</h3>
        <ul className="plain-list">
          {(comments.data ?? []).map((c) => <li key={c.id}><strong>{c.author_id === studentId ? studentName(student) : t('cl.teacher')}</strong> <span className="muted-line">{date(c.created_at, { dateStyle: 'short', timeStyle: 'short' })}</span><br />{c.body}</li>)}
        </ul>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void cm.run(async () => { await api.addComment(assignmentId, studentId, text.trim()); setText(''); comments.reload(); }); }}>
          <Field label={t('cl.addComment')}>{(p) => <textarea {...p} rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
          <button className="btn small" type="submit" disabled={cm.busy || !text.trim()}>{t('cl.send')}</button>
        </form>
        <ErrorLine error={cm.error} />
      </section>
    </div>
  );
}
