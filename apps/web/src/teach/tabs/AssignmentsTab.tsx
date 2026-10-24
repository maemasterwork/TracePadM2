import { useMemo, useState } from 'react';
import { Field, Notice, Spinner } from '../../design/ui';
import { useI18n } from '../../i18n';
import { ErrorLine, fromLocalInput, toLocalInput, useAction, useLoad } from '../hooks';
import { itemLabel } from '../labels';
import { DEFAULT_POINTS, itemsMax, type PointRule } from '../logic';
import type { Assignment, AssignmentInput, LateMode } from '../types';
import { studentName, type TabProps } from './shared';
import { chapterNo } from '../../content/chapterNo';

interface Form {
  title: string; description: string; page_id: string; kinds: Record<'pred' | 'quiz' | 'ex', boolean>; pts: PointRule; skip: Set<string>;
  release: string; due: string; close: string; mode: LateMode; perDay: number; max: number; weight: number; maxSubs: number; show: 'on_submit' | 'on_return';
}

export function AssignmentsTab({ api, cls, all, roster }: TabProps) {
  const { t, pick, date, num } = useI18n();
  const list = useLoad(() => api.assignments(cls.id), [api, cls.id]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const chapters = all.lessons.flatMap((l) => l.chapters.map((c) => ({ ...c, lessonId: l.id })));
  // only chapters that have practice items can be assigned (the flowchart primer has several chapters with none)
  const assignable = chapters.filter((c) => [...all.items.values()].some((i) => i.lessonId === c.lessonId && i.ch === c.n));
  const blank = (): Form => ({ title: '', description: '', page_id: assignable[0]?.id ?? chapters[0]?.id ?? '', kinds: { pred: true, quiz: true, ex: true }, pts: { ...DEFAULT_POINTS }, skip: new Set(), release: '', due: '', close: '', mode: 'accept', perDay: 10, max: 50, weight: 1, maxSubs: 1, show: 'on_return' });
  const [form, setForm] = useState<Form>(blank());
  const save = useAction();
  const del = useAction();

  const chapterItems = useMemo(() => {
    const ch = chapters.find((c) => c.id === form.page_id);
    return ch ? [...all.items.values()].filter((i) => i.lessonId === ch.lessonId && i.ch === ch.n) : [];
  }, [all.items, form.page_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = chapterItems.filter((i) => form.kinds[i.kind] && !form.skip.has(i.key)).map((i) => ({ key: i.key, points: form.pts[i.kind] }));

  const open = (a: Assignment | null) => {
    if (!a) { setForm(blank()); setEditing('new'); return; }
    const inChapter = [...all.items.values()].filter((i) => { const ch = chapters.find((c) => c.id === a.page_id); return ch && i.lessonId === ch.lessonId && i.ch === ch.n; });
    const keys = new Set(a.items.map((i) => i.key));
    const kinds = { pred: false, quiz: false, ex: false };
    const pts = { ...DEFAULT_POINTS };
    for (const i of a.items) { const k = i.key.split(':')[0] as 'pred' | 'quiz' | 'ex'; kinds[k] = true; pts[k] = i.points; }
    setForm({
      title: a.title, description: a.description, page_id: a.page_id, kinds, pts, skip: new Set(inChapter.filter((i) => kinds[i.kind] && !keys.has(i.key)).map((i) => i.key)),
      release: toLocalInput(a.release_at), due: toLocalInput(a.due_at), close: toLocalInput(a.close_at), mode: a.late_policy.mode, perDay: a.late_policy.per_day ?? 10, max: a.late_policy.max ?? 50,
      weight: a.weight, maxSubs: a.max_submissions, show: a.show_results,
    });
    setEditing(a.id);
  };
  const upd = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const toInput = (status: 'draft' | 'published'): AssignmentInput => ({
    class_id: cls.id, page_id: form.page_id, title: form.title.trim(), description: form.description.trim(), items: chosen, status,
    release_at: fromLocalInput(form.release), due_at: fromLocalInput(form.due), close_at: fromLocalInput(form.close),
    late_policy: form.mode === 'penalty' ? { mode: 'penalty', per_day: form.perDay, max: form.max } : { mode: form.mode }, weight: form.weight, max_submissions: form.maxSubs, show_results: form.show,
  });
  const submit = (status: 'draft' | 'published') => void save.run(async () => {
    await api.saveAssignment(editing === 'new' ? null : editing, toInput(status));
    setEditing(null); list.reload();
    return t(status === 'published' ? 'tc.asg.published' : 'tc.asg.savedDraft');
  });
  const current = (list.data ?? []).find((a) => a.id === editing);

  return (
    <div>
      <ErrorLine error={list.error ?? del.error} />
      {save.done && <Notice kind="good" live>{save.done}</Notice>}
      {editing === null && (
        <section className="card" aria-labelledby="asg-h">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="asg-h" style={{ margin: 0 }}>{t('tc.asg.title')}</h2>
            <button type="button" className="btn" onClick={() => open(null)}>{t('tc.asg.new')}</button>
          </div>
          {list.loading ? <Spinner label={t('app.loading')} /> : (list.data ?? []).length === 0 ? <p>{t('tc.noAsg')}</p> : (
            <ul className="plain-list">
              {list.data!.map((a) => (
                <li key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span><strong>{a.title || t('tc.asg.untitled')}</strong> <span className="muted-line">· {t('tc.asg.itemsPts', { n: num(a.items.length), p: num(itemsMax(a.items)) })}{a.due_at ? ` · ${t('cl.due', { when: date(a.due_at, { dateStyle: 'medium', timeStyle: 'short' }) })}` : ''}</span></span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className={'chip ' + (a.status === 'published' ? 'good' : 'warn')}>{t('tc.asg.status.' + a.status)}</span>
                    <button type="button" className="btn small alt" onClick={() => open(a)}>{t('tc.edit')}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing !== null && (
        <section className="card" aria-labelledby="asg-form-h">
          <h2 id="asg-form-h" style={{ marginTop: 0 }}>{editing === 'new' ? t('tc.asg.new') : t('tc.asg.edit')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); submit(current?.status ?? 'draft'); }}>
            <Field label={t('tc.asg.name')}>{(p) => <input {...p} required maxLength={120} value={form.title} onChange={(e) => upd({ title: e.target.value })} />}</Field>
            <Field label={t('tc.asg.desc')}>{(p) => <textarea {...p} rows={3} maxLength={2000} value={form.description} onChange={(e) => upd({ description: e.target.value })} />}</Field>
            <Field label={t('tc.asg.chapter')}>{(p) => (
              <select {...p} value={form.page_id} onChange={(e) => upd({ page_id: e.target.value, skip: new Set() })}>
                {all.lessons.filter((l) => assignable.some((c) => c.lessonId === l.id)).map((l) => (
                  <optgroup key={l.id} label={pick(l.title)}>
                    {assignable.filter((c) => c.lessonId === l.id).map((c) => <option key={c.id} value={c.id}>{num(chapterNo(c.n))}. {c.title}</option>)}
                  </optgroup>
                ))}
              </select>
            )}</Field>
            <fieldset>
              <legend>{t('tc.asg.itemsLegend')}</legend>
              {(['pred', 'quiz', 'ex'] as const).map((k) => {
                const of = chapterItems.filter((i) => i.kind === k);
                if (of.length === 0) return null;
                return (
                  <div key={k} className="card" style={{ marginBlock: 8 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={form.kinds[k]} onChange={(e) => upd({ kinds: { ...form.kinds, [k]: e.target.checked } })} /> <strong>{t('tc.asg.kind.' + k, { n: num(of.length) })}</strong></label>
                      <label className="row" style={{ gap: 6 }}>{t('tc.asg.pointsEach')} <input type="number" min={0} max={100} step={0.5} value={form.pts[k]} onChange={(e) => upd({ pts: { ...form.pts, [k]: Math.max(0, Math.min(100, Number(e.target.value))) } })} style={{ inlineSize: 80 }} /></label>
                    </div>
                    {form.kinds[k] && (
                      <ul className="plain-list">
                        {of.map((i) => (
                          <li key={i.key}><label className="row" style={{ gap: 6 }}>
                            <input type="checkbox" checked={!form.skip.has(i.key)} onChange={(e) => { const s = new Set(form.skip); if (e.target.checked) s.delete(i.key); else s.add(i.key); upd({ skip: s }); }} />
                            <span>{itemLabel(i, i.key, pick, (kk) => t('cl.kind.' + kk))}</span>
                          </label></li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              <p className="muted-line">{t('tc.asg.total', { n: num(chosen.length), p: num(itemsMax(chosen)) })}</p>
            </fieldset>
            <div className="grid-2">
              <Field label={t('tc.asg.release')} hint={t('tc.asg.releaseHint')}>{(p) => <input {...p} type="datetime-local" dir="ltr" value={form.release} onChange={(e) => upd({ release: e.target.value })} />}</Field>
              <Field label={t('tc.asg.dueAt')}>{(p) => <input {...p} type="datetime-local" dir="ltr" value={form.due} onChange={(e) => upd({ due: e.target.value })} />}</Field>
              <Field label={t('tc.asg.close')} hint={t('tc.asg.closeHint')}>{(p) => <input {...p} type="datetime-local" dir="ltr" value={form.close} onChange={(e) => upd({ close: e.target.value })} />}</Field>
              <Field label={t('tc.asg.late')}>{(p) => (
                <select {...p} value={form.mode} onChange={(e) => upd({ mode: e.target.value as LateMode })}>
                  <option value="accept">{t('tc.asg.late.accept')}</option><option value="penalty">{t('tc.asg.late.penalty')}</option><option value="reject">{t('tc.asg.late.reject')}</option>
                </select>
              )}</Field>
              {form.mode === 'penalty' && <>
                <Field label={t('tc.asg.perDay')}>{(p) => <input {...p} type="number" min={0} max={100} value={form.perDay} onChange={(e) => upd({ perDay: Number(e.target.value) })} />}</Field>
                <Field label={t('tc.asg.maxPenalty')}>{(p) => <input {...p} type="number" min={0} max={100} value={form.max} onChange={(e) => upd({ max: Number(e.target.value) })} />}</Field>
              </>}
              <Field label={t('tc.asg.weight')} hint={t('tc.asg.weightHint')}>{(p) => <input {...p} type="number" min={0} max={100} step={0.5} value={form.weight} onChange={(e) => upd({ weight: Number(e.target.value) })} />}</Field>
              <Field label={t('tc.asg.maxSubs')}>{(p) => <input {...p} type="number" min={1} max={20} value={form.maxSubs} onChange={(e) => upd({ maxSubs: Math.max(1, Math.min(20, Number(e.target.value))) })} />}</Field>
              <Field label={t('tc.asg.show')}>{(p) => (
                <select {...p} value={form.show} onChange={(e) => upd({ show: e.target.value as Form['show'] })}>
                  <option value="on_return">{t('tc.asg.show.return')}</option><option value="on_submit">{t('tc.asg.show.submit')}</option>
                </select>
              )}</Field>
            </div>
            {current?.status === 'published' && <Notice kind="info">{t('tc.asg.editNote')}</Notice>}
            <div className="row">
              {current?.status !== 'published' && <button type="button" className="btn alt" disabled={save.busy || !form.title.trim()} onClick={() => submit('draft')}>{t('tc.asg.saveDraft')}</button>}
              {current?.status === 'published'
                ? <button type="submit" className="btn" disabled={save.busy || !form.title.trim() || chosen.length === 0}>{t('tc.save')}</button>
                : <button type="button" className="btn" disabled={save.busy || !form.title.trim() || chosen.length === 0} onClick={() => submit('published')}>{t('tc.asg.publish')}</button>}
              {current?.status === 'published' && <button type="button" className="btn alt" disabled={save.busy} onClick={() => submit('draft')}>{t('tc.asg.unpublish')}</button>}
              <button type="button" className="btn quiet" onClick={() => setEditing(null)}>{t('tc.cancel')}</button>
              {current && <button type="button" className="btn danger" disabled={del.busy} onClick={() => { if (window.confirm(t('tc.asg.deleteConfirm', { name: current.title }))) void del.run(async () => { await api.deleteAssignment(current.id); setEditing(null); list.reload(); }); }}>{t('tc.delete')}</button>}
            </div>
            <ErrorLine error={save.error} />
          </form>
          {current && <Extensions api={api} assignment={current} roster={roster} />}
        </section>
      )}
    </div>
  );
}

function Extensions({ api, assignment, roster }: { api: TabProps['api']; assignment: Assignment; roster: TabProps['roster'] }) {
  const { t, date } = useI18n();
  const list = useLoad(() => api.extensions(assignment.id), [api, assignment.id]);
  const [sid, setSid] = useState(''); const [due, setDue] = useState(''); const [reason, setReason] = useState('');
  const act = useAction();
  const name = (id: string) => { const s = roster.find((r) => r.id === id); return s ? studentName(s) : id.slice(0, 8); };
  return (
    <div style={{ marginTop: 24 }}>
      <h3>{t('tc.ext.title')}</h3>
      <p className="muted-line">{t('tc.ext.help')}</p>
      <ErrorLine error={list.error ?? act.error} />
      <ul className="plain-list">
        {(list.data ?? []).map((e) => (
          <li key={e.student_id} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{name(e.student_id)} → {date(e.due_at, { dateStyle: 'medium', timeStyle: 'short' })}{e.reason && <span className="muted-line"> · {e.reason}</span>}</span>
            <button type="button" className="btn small quiet" disabled={act.busy} onClick={() => void act.run(async () => { await api.removeExtension(assignment.id, e.student_id); list.reload(); })}>{t('tc.remove')}</button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { await api.grantExtension(assignment.id, sid, fromLocalInput(due)!, reason.trim()); setSid(''); setDue(''); setReason(''); list.reload(); }); }}>
        <Field label={t('tc.student')}>{(p) => <select {...p} required value={sid} onChange={(e) => setSid(e.target.value)}><option value="">–</option>{roster.map((s) => <option key={s.id} value={s.id}>{studentName(s)}</option>)}</select>}</Field>
        <Field label={t('tc.ext.due')}>{(p) => <input {...p} required type="datetime-local" dir="ltr" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
        <Field label={t('tc.ext.reason')}>{(p) => <input {...p} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <button className="btn small" type="submit" disabled={act.busy || !sid || !due}>{t('tc.ext.grant')}</button>
      </form>
    </div>
  );
}
