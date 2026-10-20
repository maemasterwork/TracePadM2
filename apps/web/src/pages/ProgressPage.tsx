import { Link } from 'react-router-dom';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useAllLabs, useRows } from '../learn/hooks';
import { masteryByTag, type ItemRow } from '../learn/mastery';
import { watchCount } from '../learn/srs';
import { StreakLine } from './Review';

export function ProgressPage() {
  const { t, pick, num } = useI18n();
  const all = useAllLabs();
  const rows = useRows(['pred:', 'quiz:', 'ex:', 'read:', 'rev:']);
  if (!all.ready) return <Spinner label={t('app.loading')} />;
  const tags = masteryByTag(rows as unknown as ItemRow[], (k) => { const i = all.items.get(k); return i?.tag ? { tag: i.tag, guess: i.guess } : undefined; });
  const { due } = watchCount(rows as never);
  const data = (k: string) => rows.find((r) => r.key === k)?.data as Record<string, unknown> | undefined;
  return (
    <div style={{ maxWidth: 820, margin: '24px auto' }}>
      <h1>{t('progress.title')}</h1>
      <StreakLine />
      <p>
        {due > 0 ? <Link className="btn small" to="/review">{t('review.due', { n: num(due) })}</Link> : <Link className="btn small quiet" to="/review">{t('review.title')}</Link>}
      </p>

      {all.lessons.map((l) => (
        <section className="card" key={l.id} aria-labelledby={'pc-' + l.id}>
          <h2 id={'pc-' + l.id} style={{ marginTop: 0 }}>{t('progress.chapters')} · {pick(l.title)}</h2>
          <ul className="chapter-progress">
            {l.chapters.map((c) => {
              const mine = [...all.items.values()].filter((i) => i.lessonId === l.id && i.ch === c.n);
              const done = mine.filter((i) => { const d = data(i.key); return d && (d.right === true || d.pass === true); }).length;
              const isRead = data('read:' + c.n)?.done === true;
              return (
                <li key={c.id}>
                  <Link to={`/lesson/${l.id}/${c.id}`} dir="ltr" lang="en">{num(c.n)}. {c.title}</Link>
                  <span className="chip">{t('lab.progress', { done: num(done), total: num(mine.length) })}</span>
                  {isRead && <span className="chip good">✓ {t('lesson.isRead')}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="card" aria-labelledby="pc-concepts">
        <h2 id="pc-concepts" style={{ marginTop: 0 }}>{t('progress.concepts')}</h2>
        <p className="muted-line">{t('progress.conceptsHelp')}</p>
        {tags.length === 0 ? <Notice kind="info">{t('progress.empty')}</Notice> : (
          <ul className="concepts">
            {tags.map((m) => {
              const c = all.concepts.get(m.tag);
              const name = c ? pick(c.name) : m.tag;
              const chapter = c?.chapters[0];
              const [lessonId, chn] = chapter ? chapter.split('#') : [];
              const chId = all.lessons.find((l) => l.id === lessonId)?.chapters.find((x) => x.n === Number(chn))?.id;
              const pct = Math.round(m.p * 100);
              return (
                <li key={m.tag}>
                  <div className="concept-h">
                    <span>{name}</span>
                    <span className={'chip ' + (m.level === 'solid' ? 'good' : m.level === 'growing' ? '' : 'warn')}>{t('progress.level.' + m.level)}</span>
                    {m.lastOk === false && <span className="chip bad">{t('progress.needsReview')}</span>}
                  </div>
                  <div className="meter" role="img" aria-label={`${name}: ${t('progress.level.' + m.level)}, ${num(pct)}%`}><span style={{ width: pct + '%' }} /></div>
                  <span className="muted-line">{t('progress.answers', { n: num(m.n) })}{lessonId && chId && <> · <Link to={`/lesson/${lessonId}/${chId}`}>{t('progress.openChapter', { n: num(Number(chn)) })}</Link></>}</span>
                </li>
              );
            })}
          </ul>
        )}
        <details>
          <summary>{t('progress.about')}</summary>
          <p>{t('progress.aboutText')}</p>
        </details>
      </section>
    </div>
  );
}
