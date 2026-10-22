import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Field, Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useAllLabs } from '../learn/hooks';
import { itemLabel, kindOfKey } from '../teach/labels';
import { TeachError } from '../teach/api';
import { ErrorLine, Gate, useAction, useLoad, useTeachApi } from '../teach/hooks';
import { latePenaltyNow, myStatus, type MyStatus } from '../teach/logic';
import type { MyResult } from '../teach/types';

export function StatusChip({ s }: { s: MyStatus }) {
  const { t } = useI18n();
  const kind = s === 'returned' ? 'good' : s === 'missed' ? 'bad' : s === 'late' ? 'warn' : '';
  return <span className={'chip ' + kind}>{t('cl.status.' + s)}</span>;
}

/** Lesson page that holds an assignment's chapter ("1-numbers" lives in whichever lesson has that chapter). */
function useLessonLink() {
  const all = useAllLabs();
  return (pageId: string) => {
    const l = all.lessons.find((x) => x.chapters.some((c) => c.id === pageId)) ?? all.lessons[0];
    return l ? `/lesson/${l.id}/${pageId}` : '/';
  };
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(h); }, [ms]);
  return now;
}

/* ------------------------------------------------------------------ /classes */
export function Classes() { return <Gate need="signedIn"><ClassesInner /></Gate>; }

function ClassesInner() {
  const { t, date, num } = useI18n();
  const { user } = useAuth();
  const api = useTeachApi()!;
  const classes = useLoad(() => api.classes(), [api]);
  const results = useLoad(() => api.myResults(), [api]);
  const [code, setCode] = useState('');
  const join = useAction();
  const leave = useAction();
  const now = useNow();
  const mine = (classes.data ?? []).filter((c) => c.teacher_id !== user?.id);
  const upcoming = (results.data ?? []).filter((r) => !r.submitted_at && !r.archived).sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity));
  const nameOf = (id: string) => classes.data?.find((c) => c.id === id)?.name ?? '';

  return (
    <div style={{ maxWidth: 820, margin: '24px auto' }}>
      <h1>{t('cl.title')}</h1>
      <section className="card" aria-labelledby="join-h">
        <h2 id="join-h" style={{ marginTop: 0 }}>{t('cl.join')}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void join.run(async () => {
          const c = await api.joinClass(code.trim());
          if (!c) throw new TeachError('cl.noClass');
          setCode(''); classes.reload(); results.reload();
          return t('cl.joined', { name: c.name });
        }); }}>
          <Field label={t('cl.code')} hint={t('cl.codeHint')}>
            {(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} dir="ltr" style={{ textTransform: 'uppercase' }} />}
          </Field>
          <button className="btn" type="submit" disabled={join.busy || code.trim().length < 4}>{t('cl.joinBtn')}</button>
        </form>
        {join.done && <Notice kind="good" live>{join.done}</Notice>}
        <ErrorLine error={join.error} />
      </section>

      {classes.loading ? <Spinner label={t('app.loading')} /> : (
        <>
          <ErrorLine error={classes.error} />
          <section className="card" aria-labelledby="my-h">
            <h2 id="my-h" style={{ marginTop: 0 }}>{t('cl.mine')}</h2>
            {mine.length === 0 ? <p>{t('cl.none')}</p> : (
              <ul className="plain-list">
                {mine.map((c) => (
                  <li key={c.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span><Link to={`/classes/${c.id}`}><strong>{c.name}</strong></Link>{c.term && <span className="muted-line"> · {c.term}</span>}{c.archived_at && <span className="chip warn" style={{ marginInlineStart: 8 }}>{t('cl.archived')}</span>}</span>
                    <button type="button" className="btn small quiet" disabled={leave.busy} onClick={() => { if (window.confirm(t('cl.leaveConfirm', { name: c.name }))) void leave.run(async () => { await api.leaveClass(c.id, user!.id); classes.reload(); results.reload(); }); }}>{t('cl.leave')}</button>
                  </li>
                ))}
              </ul>
            )}
            <ErrorLine error={leave.error} />
          </section>
          <section className="card" aria-labelledby="up-h">
            <h2 id="up-h" style={{ marginTop: 0 }}>{t('cl.upcoming')}</h2>
            {upcoming.length === 0 ? <p>{t('cl.nothingDue')}</p> : (
              <ul className="plain-list">
                {upcoming.map((r) => (
                  <li key={r.assignment_id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span><Link to={`/classes/${r.class_id}#a-${r.assignment_id}`}>{r.title}</Link> <span className="muted-line">· {nameOf(r.class_id)}</span></span>
                    <span className="row" style={{ gap: 6 }}>
                      {r.due_at ? <span className="muted-line">{t('cl.due', { when: date(r.due_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</span> : <span className="muted-line">{t('cl.noDue')}</span>}
                      <StatusChip s={myStatus(r, now)} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted-line">{t('cl.count', { n: num(upcoming.length) })}</p>
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ /classes/:classId */
export function ClassPage() { return <Gate need="signedIn"><ClassInner /></Gate>; }

function ClassInner() {
  const { classId = '' } = useParams();
  const { t, date, num } = useI18n();
  const api = useTeachApi()!;
  const classes = useLoad(() => api.classes(), [api]);
  const results = useLoad(() => api.myResults(classId), [api, classId]);
  const news = useLoad(() => api.announcements(classId), [api, classId]);
  const cls = classes.data?.find((c) => c.id === classId);
  const now = useNow();
  if (classes.loading || results.loading) return <Spinner label={t('app.loading')} />;
  if (!cls) return <div style={{ maxWidth: 640, margin: '24px auto' }}><Notice kind="bad">{t('cl.notFound')}</Notice><p><Link to="/classes">{t('cl.title')}</Link></p></div>;
  return (
    <div style={{ maxWidth: 820, margin: '24px auto' }}>
      <p><Link to="/classes">← {t('cl.title')}</Link></p>
      <h1>{cls.name}{cls.term && <small className="muted-line"> · {cls.term}</small>}</h1>
      {cls.archived_at && <Notice kind="warn">{t('cl.archivedNote')}</Notice>}
      <ErrorLine error={results.error ?? news.error} />
      {(news.data ?? []).length > 0 && (
        <section className="card" aria-labelledby="ann-h">
          <h2 id="ann-h" style={{ marginTop: 0 }}>{t('cl.announcements')}</h2>
          {news.data!.map((a) => (
            <article key={a.id} className="announce">
              <h3 style={{ margin: '0 0 4px' }}>{a.pinned && <span aria-label={t('cl.pinned')}>📌 </span>}{a.title}</h3>
              <p className="muted-line">{date(a.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
              {a.body && <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>}
            </article>
          ))}
        </section>
      )}
      <h2>{t('cl.assignments')}</h2>
      {(results.data ?? []).length === 0 ? <p>{t('cl.noAssignments')}</p> : (results.data ?? []).map((r) => <AssignmentCard key={r.assignment_id} r={r} now={now} onChange={results.reload} />)}
      <p className="muted-line">{t('cl.count', { n: num((results.data ?? []).length) })}</p>
    </div>
  );
}

function AssignmentCard({ r, now, onChange }: { r: MyResult; now: number; onChange: () => void }) {
  const { t, pick, date, num } = useI18n();
  const { user, progress } = useAuth();
  const api = useTeachApi()!;
  const all = useAllLabs();
  const link = useLessonLink();
  const sub = useAction();
  const cm = useAction();
  const [text, setText] = useState('');
  const comments = useLoad(() => api.comments(r.assignment_id, user!.id), [api, r.assignment_id, r.returned_at]);
  const status = myStatus(r, now);
  const left = r.max_submissions - r.submissions;
  const pen = latePenaltyNow(r.due_at, r.late_policy, now);
  const closed = r.archived || (r.late_policy.mode === 'reject' && r.due_at !== null && Date.parse(r.due_at) < now);
  const items = useMemo(() => r.items.map((i) => ({ ...i, it: all.items.get(i.key) })), [r.items, all.items]);

  const submit = () => {
    const msg = pen > 0 ? t('cl.submitLate', { pct: num(pen) }) : t('cl.submitConfirm');
    if (!window.confirm(msg)) return;
    void sub.run(async () => {
      // make sure the server has the latest answers before it takes the snapshot
      await progress.flush();
      let secs = 0, pastes = 0;
      for (const i of r.items) {
        if (kindOfKey(i.key) !== 'ex') continue;
        const d = (await progress.get(i.key))?.data as { secs?: number; pastes?: number } | undefined;
        secs += d?.secs ?? 0; pastes += d?.pastes ?? 0;
      }
      await api.submit(r.assignment_id, { secs, pastes });
      onChange();
      return t('cl.submitted');
    });
  };

  return (
    <article className="card" id={'a-' + r.assignment_id} aria-labelledby={'h-' + r.assignment_id}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 id={'h-' + r.assignment_id} style={{ margin: 0 }}>{r.title}</h3>
        <StatusChip s={status} />
      </div>
      {r.description && <p style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>}
      <p className="muted-line">
        {r.due_at ? t('cl.due', { when: date(r.due_at, { dateStyle: 'medium', timeStyle: 'short' }) }) : t('cl.noDue')}
        {' · '}{t('cl.points', { n: num(r.max_score) })}
        {' · '}{t('cl.attempts', { used: num(r.submissions), max: num(r.max_submissions) })}
      </p>
      <p className="muted-line">{t('cl.lateRule.' + r.late_policy.mode, { per: num(r.late_policy.per_day ?? 0), max: num(r.late_policy.max ?? 100) })}</p>
      <p><Link className="btn small alt" to={link(r.page_id)}>{t('cl.practice')}</Link></p>
      <details>
        <summary>{t('cl.items', { n: num(items.length) })}</summary>
        <ul>{items.map((i) => <li key={i.key}>{itemLabel(i.it, i.key, pick, (k) => t('cl.kind.' + k))} <span className="muted-line">({t('cl.points', { n: num(i.points) })})</span></li>)}</ul>
      </details>
      {r.submitted_at && <p>{t('cl.submittedAt', { when: date(r.submitted_at, { dateStyle: 'medium', timeStyle: 'short' }) })}{(r.late_seconds ?? 0) > 0 && <> · <span className="chip warn">{t('cl.wasLate')}{(r.penalty_pct ?? 0) > 0 ? ` (−${num(r.penalty_pct ?? 0)}%)` : ''}</span></>}</p>}
      {r.visible && r.score !== null ? (
        <div className="verdict good" role="status">
          <strong>{t('cl.score', { score: num(r.score), max: num(r.max_score) })}</strong>
          {r.detail && (
            <ul className="tests">
              {r.detail.map((d) => (
                <li key={d.key} className={d.state === 'correct' ? 'ok' : 'no'}>
                  <span aria-hidden="true">{d.state === 'correct' ? '✓' : d.state === 'partial' ? '◐' : '✗'}</span> {itemLabel(all.items.get(d.key), d.key, pick, (k) => t('cl.kind.' + k))}: {t('cl.itemState.' + d.state)} ({num(d.earned)}/{num(d.points)})
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : r.submitted_at ? <Notice kind="info">{t('cl.notReturned')}</Notice> : null}
      {r.comment && <Notice kind="info"><strong>{t('cl.teacherComment')}: </strong>{r.comment}</Notice>}
      {status !== 'returned' && left > 0 && !closed && (
        <p className="row">
          <button type="button" className="btn" disabled={sub.busy} onClick={submit}>{r.submissions > 0 ? t('cl.resubmit') : t('cl.submit')}</button>
          {pen > 0 && <span className="chip warn">{t('cl.lateNow', { pct: num(pen) })}</span>}
        </p>
      )}
      {closed && !r.submitted_at && <Notice kind="warn">{t('cl.closedNote')}</Notice>}
      {sub.done && <Notice kind="good" live>{sub.done}</Notice>}
      <ErrorLine error={sub.error} />
      <details open={(comments.data ?? []).length > 0}>
        <summary>{t('cl.comments', { n: num((comments.data ?? []).length) })}</summary>
        <ul className="plain-list">
          {(comments.data ?? []).map((c) => <li key={c.id}><strong>{c.author_id === user?.id ? t('cl.you') : t('cl.teacher')}</strong> <span className="muted-line">{date(c.created_at, { dateStyle: 'short', timeStyle: 'short' })}</span><br />{c.body}</li>)}
        </ul>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void cm.run(async () => { await api.addComment(r.assignment_id, user!.id, text.trim()); setText(''); comments.reload(); }); }}>
          <Field label={t('cl.addComment')}>{(p) => <textarea {...p} rows={2} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />}</Field>
          <button className="btn small" type="submit" disabled={cm.busy || !text.trim()}>{t('cl.send')}</button>
        </form>
        <ErrorLine error={cm.error} />
      </details>
    </article>
  );
}
