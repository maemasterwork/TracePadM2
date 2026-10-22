import { useState } from 'react';
import { Field, Notice, Spinner } from '../../design/ui';
import { useI18n } from '../../i18n';
import { ErrorLine, useAction, useLoad } from '../hooks';
import type { TabProps } from './shared';

export function AnnouncementsTab({ api, cls, userId }: TabProps) {
  const { t, date } = useI18n();
  const list = useLoad(() => api.announcements(cls.id), [api, cls.id]);
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [pinned, setPinned] = useState(false);
  const post = useAction(); const del = useAction();
  return (
    <div>
      <section className="card" aria-labelledby="ann-new">
        <h2 id="ann-new" style={{ marginTop: 0 }}>{t('tc.ann.new')}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void post.run(async () => { await api.postAnnouncement(cls.id, userId, title.trim(), body.trim(), pinned); setTitle(''); setBody(''); setPinned(false); list.reload(); return t('tc.ann.posted'); }); }}>
          <Field label={t('tc.ann.title')}>{(p) => <input {...p} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label={t('tc.ann.body')}>{(p) => <textarea {...p} rows={4} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> {t('tc.ann.pin')}</label>
          <p className="muted-line">{t('tc.ann.notify')}</p>
          <button className="btn" type="submit" disabled={post.busy || !title.trim()}>{t('tc.ann.post')}</button>
        </form>
        {post.done && <Notice kind="good" live>{post.done}</Notice>}
        <ErrorLine error={post.error ?? del.error} />
      </section>
      {list.loading ? <Spinner label={t('app.loading')} /> : (list.data ?? []).map((a) => (
        <article key={a.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>{a.pinned && '📌 '}{a.title}</h3>
            <button type="button" className="btn small quiet" disabled={del.busy} onClick={() => { if (window.confirm(t('tc.ann.deleteConfirm'))) void del.run(async () => { await api.deleteAnnouncement(a.id); list.reload(); }); }}>{t('tc.delete')}</button>
          </div>
          <p className="muted-line">{date(a.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {a.body && <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>}
        </article>
      ))}
    </div>
  );
}
