import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { PredictionCard, QuizCard } from '../learn/Cards';
import { useAllLabs, useRows } from '../learn/hooks';
import { activityTimes } from '../learn/record';
import { DAY, dueItems, revKey, streak, watchCount, type RevState } from '../learn/srs';
import { chapterNo } from '../content/chapterNo';

export function StreakLine() {
  const { t, num } = useI18n();
  const rows = useRows(['pred:', 'quiz:', 'ex:', 'rev:']);
  const s = useMemo(() => streak(activityTimes(rows as never), Date.now()), [rows]);
  const text = s.current > 0 ? t('streak.days', { n: s.current }) : s.best > 0 ? t('streak.welcome') : t('streak.zero');
  return (
    <p className="streak" role="status">
      <span aria-hidden="true">{s.current > 0 ? '🔥 ' : '🌱 '}</span>{text}
      {s.todayDone && <> · {t('streak.today')}</>}
      {s.best > 1 && <> · {t('streak.best', { n: num(s.best) })}</>}
    </p>
  );
}

export function Review() {
  const { t, num } = useI18n();
  const { progress } = useAuth();
  const all = useAllLabs();
  const rows = useRows(['rev:']);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [answered, setAnswered] = useState<{ ok: boolean; note: string } | null>(null);
  const [tally, setTally] = useState({ right: 0, n: 0 });
  const [finished, setFinished] = useState(false);

  if (!all.ready) return <Spinner label={t('app.loading')} />;
  const due = dueItems(rows as never, Date.now()).filter((k) => all.items.has(k));
  const { waiting } = watchCount(rows as never);

  const start = () => { setQueue(due); setPos(0); setAnswered(null); setTally({ right: 0, n: 0 }); setFinished(false); };
  const onResult = (key: string) => async (ok: boolean) => {
    const rev = (await progress.get(revKey(key)))?.data as unknown as RevState | undefined;
    const days = rev ? Math.max(1, Math.round((rev.due - Date.now()) / DAY)) : 1;
    const note = rev?.done ? t('review.graduated') : ok ? t('review.moved', { d: num(days) }) : t('review.reset');
    setAnswered({ ok, note });
    setTally((x) => ({ right: x.right + (ok ? 1 : 0), n: x.n + 1 }));
  };

  const key = queue?.[pos];
  const item = key ? all.items.get(key) : undefined;
  return (
    <div style={{ maxWidth: 760, margin: '24px auto' }}>
      <h1>{t('review.title')}</h1>
      <p>{t('review.lead')}</p>
      <StreakLine />
      {!queue && (
        due.length > 0
          ? <div className="card"><p><strong>{t('review.due', { n: num(due.length) })}</strong></p><button type="button" className="btn" onClick={start}>{t('review.start')}</button></div>
          : <Notice kind="info">{waiting > 0 ? t('review.none', { n: num(waiting) }) : t('review.noneAtAll')}</Notice>
      )}
      {queue && !finished && item && key && (
        <>
          <p className="chip" role="status">{t('review.item', { i: num(pos + 1), n: num(queue.length) })}</p>
          <p className="muted-line">{t('review.fromChapter', { n: num(chapterNo(item.ch)) })}</p>
          {item.kind === 'pred' && <PredictionCard key={key} ch={item.ch} p={item.pred!} concepts={all.concepts} review onResult={(ok) => void onResult(key)(ok)} />}
          {item.kind === 'quiz' && <QuizCard key={key} ch={item.ch} q={item.quiz!} concepts={all.concepts} review onResult={(ok) => void onResult(key)(ok)} />}
          {answered && (
            <div className="row" style={{ marginTop: 12 }}>
              <span className={'chip ' + (answered.ok ? 'good' : 'bad')}>{answered.note}</span>
              {item.chapterId && <Link className="btn small quiet" to={`/lesson/${item.lessonId}/${item.chapterId}`}>{t('review.backToChapter')}</Link>}
              <button type="button" className="btn small" onClick={() => { setAnswered(null); if (pos + 1 >= queue.length) setFinished(true); else setPos(pos + 1); }}>{pos + 1 >= queue.length ? t('review.finish') : t('review.next')}</button>
            </div>
          )}
        </>
      )}
      {queue && finished && (
        <Notice kind="good" live>{t('review.done', { right: num(tally.right), n: num(tally.n) })}</Notice>
      )}
    </div>
  );
}
