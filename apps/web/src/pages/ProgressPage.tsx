import { Link } from 'react-router-dom';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useAllLabs, useRows } from '../learn/hooks';
import { masteryByTag, type ItemRow } from '../learn/mastery';
import { watchCount } from '../learn/srs';
import { StreakLine } from './Review';
import { chapterNo } from '../content/chapterNo';

export function ProgressPage() {
  const { t, pick, num } = useI18n();
  const all = useAllLabs();
  const rows = useRows(['pred:', 'quiz:', 'ex:', 'read:', 'rev:']);
  if (!all.ready) return <Spinner label={t('app.loading')} />;

  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const tags = masteryByTag(rows as unknown as ItemRow[], (key) => {
    const item = all.items.get(key);
    return item?.tag ? { tag: item.tag, guess: item.guess } : undefined;
  });
  const { due } = watchCount(rows as never);
  const chapterStats = all.lessons.flatMap((lesson) => lesson.chapters.map((chapter) => {
    const items = [...all.items.values()].filter((item) => item.lessonId === lesson.id && item.ch === chapter.n);
    const done = items.filter((item) => {
      const data = rowsByKey.get(item.key)?.data;
      return data?.right === true || data?.pass === true;
    }).length;
    return {
      lesson,
      chapter,
      done,
      total: items.length,
      isRead: rowsByKey.get(`read:${chapter.n}`)?.data.done === true,
    };
  }));
  const chaptersRead = chapterStats.filter((chapter) => chapter.isRead).length;
  const totalChapters = chapterStats.length;
  const solidConcepts = tags.filter((tag) => tag.level === 'solid').length;
  const answerCount = tags.reduce((total, tag) => total + tag.n, 0);
  const readPercent = totalChapters ? Math.round((chaptersRead / totalChapters) * 100) : 0;

  return (
    <div className="progress-page">
      <section className="progress-hero" aria-labelledby="progress-title">
        <div className="progress-hero-copy">
          <p className="progress-eyebrow"><span aria-hidden="true">✳</span>{t('nav.progress')}</p>
          <h1 id="progress-title">{t('progress.title')}</h1>
          <p>{t('progress.conceptsHelp')}</p>
          <div className="progress-hero-actions">
            <Link className="progress-primary-action" to={due > 0 ? '/review' : '/'} aria-label={due > 0 ? t('review.due', { n: num(due) }) : t('nav.home')}>
              <span aria-hidden="true">{due > 0 ? '↻' : '↗'}</span>
              {due > 0 ? t('review.due', { n: num(due) }) : t('nav.home')}
            </Link>
            {due === 0 && <Link className="progress-secondary-action" to="/review">{t('review.title')}<span aria-hidden="true">↗</span></Link>}
          </div>
        </div>
        <div className="progress-hero-visual" aria-hidden="true">
          <span className="progress-orbit" />
          <span className="progress-visual-spark">✳</span>
          <span className="progress-visual-number">{num(readPercent)}<small>%</small></span>
          <span className="progress-visual-caption">{t('lesson.isRead')}</span>
        </div>
      </section>

      <div className="progress-streak"><StreakLine /></div>

      <section className="progress-summary" aria-label={t('progress.title')}>
        <article className="progress-metric progress-metric-featured">
          <span className="progress-metric-icon" aria-hidden="true">↗</span>
          <span className="progress-metric-value">{num(chaptersRead)}<small> / {num(totalChapters)}</small></span>
          <span className="progress-metric-label">{t('progress.chapters')}</span>
          <span className="progress-meter" role="progressbar" aria-label={t('progress.chapters')} aria-valuemin={0} aria-valuemax={totalChapters} aria-valuenow={chaptersRead}>
            <span style={{ width: `${readPercent}%` }} />
          </span>
        </article>
        <article className="progress-metric">
          <span className="progress-metric-icon progress-metric-violet" aria-hidden="true">✦</span>
          <span className="progress-metric-value">{num(solidConcepts)}<small> / {num(tags.length)}</small></span>
          <span className="progress-metric-label">{t('progress.concepts')}</span>
        </article>
        <article className="progress-metric">
          <span className="progress-metric-icon progress-metric-apricot" aria-hidden="true">⌁</span>
          <span className="progress-metric-value">{num(answerCount)}</span>
          <span className="progress-metric-label">{t('progress.answersTracked')}</span>
        </article>
        <article className="progress-metric">
          <span className="progress-metric-icon progress-metric-mint" aria-hidden="true">↻</span>
          <span className="progress-metric-value">{num(due)}</span>
          <span className="progress-metric-label">{t('progress.reviewQueue')}</span>
        </article>
      </section>

      <section className="progress-section" aria-labelledby="progress-chapters-title">
        <div className="progress-section-heading">
          <div>
            <p>{t('home.pathEyebrow')}</p>
            <h2 id="progress-chapters-title">{t('progress.chapters')}</h2>
          </div>
          <span className="progress-count">{t('home.lessonCount', { n: num(all.lessons.length) })}</span>
        </div>
        <div className="progress-lesson-list">
          {all.lessons.map((lesson, lessonIndex) => {
            const lessonChapters = chapterStats.filter((item) => item.lesson.id === lesson.id);
            const lessonRead = lessonChapters.filter((item) => item.isRead).length;
            const lessonPercent = lessonChapters.length ? Math.round((lessonRead / lessonChapters.length) * 100) : 0;
            return (
              <section className="progress-lesson-card" key={lesson.id} aria-labelledby={`progress-lesson-${lesson.id}`}>
                <div className="progress-lesson-heading">
                  <div>
                    <span>{t('home.lesson', { n: num(lessonIndex + 1) })}</span>
                    <h3 id={`progress-lesson-${lesson.id}`}>{pick(lesson.title)}</h3>
                  </div>
                  <span className="progress-lesson-completion">{num(lessonRead)}<small> / {num(lessonChapters.length)}</small></span>
                </div>
                <div className="progress-lesson-meter" role="progressbar" aria-label={pick(lesson.title)} aria-valuemin={0} aria-valuemax={lessonChapters.length} aria-valuenow={lessonRead}>
                  <span style={{ width: `${lessonPercent}%` }} />
                </div>
                <ul className="progress-chapter-list">
                  {lessonChapters.map(({ chapter, done, total, isRead }) => (
                    <li key={chapter.id}>
                      <Link to={`/lesson/${lesson.id}/${chapter.id}`} dir="ltr" lang="en">
                        <span className="progress-chapter-number">{num(chapterNo(chapter.n)).padStart(2, '0')}</span>
                        <span className="progress-chapter-title">{chapter.title}</span>
                        <span className="progress-chapter-detail">{t('lab.progress', { done: num(done), total: num(total) })}</span>
                        {isRead
                          ? <span className="progress-chapter-status is-read" aria-label={t('lesson.isRead')}>✓</span>
                          : <span className="progress-chapter-status" aria-hidden="true">↗</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>

      <section className="progress-concepts" aria-labelledby="progress-concepts-title">
        <div className="progress-section-heading">
          <div>
            <p>{t('progress.conceptsHelp')}</p>
            <h2 id="progress-concepts-title">{t('progress.concepts')}</h2>
          </div>
          <span className="progress-count">{num(tags.length)}</span>
        </div>
        {tags.length === 0 ? <Notice kind="info">{t('progress.empty')}</Notice> : (
          <ul className="progress-concept-list">
            {tags.map((mastery) => {
              const concept = all.concepts.get(mastery.tag);
              const name = concept ? pick(concept.name) : mastery.tag;
              const reference = concept?.chapters[0];
              const [lessonId, chapterNumber] = reference ? reference.split('#') : [];
              const chapterId = all.lessons.find((lesson) => lesson.id === lessonId)?.chapters.find((chapter) => chapter.n === Number(chapterNumber))?.id;
              const percent = Math.round(mastery.p * 100);
              return (
                <li key={mastery.tag}>
                  <div className="progress-concept-heading">
                    <strong>{name}</strong>
                    <span className={'progress-level ' + mastery.level}>{t('progress.level.' + mastery.level)}</span>
                    {mastery.lastOk === false && <span className="progress-review-flag">{t('progress.needsReview')}</span>}
                  </div>
                  <div className="progress-concept-meter" role="img" aria-label={`${name}: ${t('progress.level.' + mastery.level)}, ${num(percent)}%`}>
                    <span className={mastery.level} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="progress-concept-footer">
                    <span>{t('progress.answers', { n: num(mastery.n) })}</span>
                    {lessonId && chapterId && <Link to={`/lesson/${lessonId}/${chapterId}`}>{t('progress.openChapter', { n: num(chapterNo(Number(chapterNumber))) })}<span aria-hidden="true">↗</span></Link>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <details className="progress-about">
          <summary>{t('progress.about')}</summary>
          <p>{t('progress.aboutText')}</p>
        </details>
      </section>
    </div>
  );
}
