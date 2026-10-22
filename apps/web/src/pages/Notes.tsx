import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCourse, loadLesson } from '../content/api';
import type { Block, Lesson } from '../content/types';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useRows } from '../learn/hooks';
import { plain } from '../search';
import { chapterNo } from '../content/chapterNo';

function findBlock(l: Lesson, ch: number, start: number): { text: string; chapterId?: string; heading: string } | null {
  const scan = (blocks: Block[]) => blocks.find((b) => b.type !== 'code' && b.start === start) as (Block & { raw?: string }) | undefined;
  const c = l.chapters.find((x) => x.n === ch);
  if (!c) return null;
  const b = scan(c.blocks) ?? c.sections.map((s) => scan(s.blocks)).find(Boolean);
  if (!b) return null;
  const raw = 'raw' in b && typeof b.raw === 'string' ? b.raw : '';
  return { text: plain(raw).slice(0, 180), chapterId: c.id, heading: c.heading };
}

export function Notes() {
  const { t, num } = useI18n();
  const rows = useRows(['note:', 'mk:']);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  useEffect(() => { loadCourse().then((c) => Promise.all(c.lessons.filter((l) => l.status === 'published').map((l) => loadLesson(l.id)))).then(setLessons).catch(() => setLessons([])); }, []);
  if (!lessons) return <Spinner label={t('app.loading')} />;
  const entries = rows.map((r) => {
    const [kind, chs, st] = r.key.split(':');
    const d = r.data as { text?: string; on?: boolean };
    const isNote = kind === 'note';
    if (isNote ? !d.text : d.on !== true) return null;
    const ch = Number(chs), start = Number(st);
    const lesson = lessons.find((l) => l.chapters.some((c) => c.n === ch)); // chapter numbers are unique across lessons
    const b = lesson ? findBlock(lesson, ch, start) : null;
    return { key: r.key, isNote, ch, start, text: d.text ?? '', b, lesson };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, z) => a.ch - z.ch || a.start - z.start);
  return (
    <div style={{ maxWidth: 780, margin: '24px auto' }}>
      <h1>{t('notes.mine')}</h1>
      {entries.length === 0 ? <Notice kind="info">{t('notes.none')}</Notice> : (
        <ul className="notes-list">
          {entries.map((e) => (
            <li key={e.key} className="card">
              <p className="muted-line" dir="ltr" lang="en">{e.b ? `${chapterNo(e.ch)}. ${e.b.heading}` : ''} <span className="chip">{e.isNote ? t('notes.note') : t('notes.mark')}</span></p>
              <p dir="ltr" lang="en" style={{ margin: '4px 0' }}>{e.b?.text}</p>
              {e.isNote && <p className="note-box" dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{e.text}</p>}
              {e.lesson && e.b?.chapterId && <Link className="btn small quiet" to={`/lesson/${e.lesson.id}/${e.b.chapterId}#b${e.start}`}>{t('notes.goto')} ({num(e.start)})</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
