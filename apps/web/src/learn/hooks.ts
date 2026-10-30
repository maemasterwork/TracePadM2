import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { loadConcepts, loadCourse, loadLabs } from '../content/api';
import type { ConceptInfo } from '../content/types';
import type { Row } from '../sync/queue';
import { indexLabs, type IndexedItem } from './record';
import type { Labs } from './types';

/** Rows whose key starts with one of the prefixes; refreshes whenever progress changes (a save here, a sync, guest adoption). */
export function useRows(prefixes: string[]): Row[] {
  const { progress } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const dep = prefixes.join('|');
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const all = (await Promise.all(prefixes.map((p) => progress.list(p)))).flat();
      if (alive) setRows(all);
    };
    void load();
    const off = progress.subscribeRows(() => void load());
    return () => { alive = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, dep]);
  return rows;
}

export interface LabsState { labs: Labs | null; items: Map<string, IndexedItem>; concepts: Map<string, ConceptInfo>; failed: boolean }

export function useLabs(lessonId: string): LabsState {
  const [labs, setLabs] = useState<Labs | null>(null);
  const [concepts, setConcepts] = useState<ConceptInfo[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setLabs(null);
    Promise.all([loadLabs(lessonId), loadConcepts()]).then(([l, c]) => { if (alive) { setLabs(l); setConcepts(c); } }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [lessonId]);
  const items = useMemo(() => (labs ? indexLabs(labs) : new Map<string, IndexedItem>()), [labs]);
  const cmap = useMemo(() => new Map(concepts.map((c) => [c.tag, c])), [concepts]);
  return { labs, items, concepts: cmap, failed };
}

export interface AllLabs { ready: boolean; items: Map<string, IndexedItem & { lessonId: string; chapterId?: string }>; concepts: Map<string, ConceptInfo>; lessons: { id: string; title: { en: string; fa?: string }; chapters: { n: number; id: string; title: string; title_fa?: string }[] }[] }

/** Practice items of every published lesson (review and progress cross lesson boundaries). */
export function useAllLabs(): AllLabs {
  const [state, setState] = useState<AllLabs>({ ready: false, items: new Map(), concepts: new Map(), lessons: [] });
  useEffect(() => {
    let alive = true;
    (async () => {
      const [course, concepts] = await Promise.all([loadCourse(), loadConcepts()]);
      const pub = course.lessons.filter((l) => l.status === 'published');
      const all = await Promise.all(pub.map((l) => loadLabs(l.id)));
      const items = new Map<string, IndexedItem & { lessonId: string; chapterId?: string }>();
      all.forEach((labs, i) => {
        for (const [k, it] of indexLabs(labs)) items.set(k, { ...it, lessonId: pub[i].id, chapterId: pub[i].chapters?.find((c) => c.n === it.ch)?.id });
      });
      if (alive) setState({ ready: true, items, concepts: new Map(concepts.map((c) => [c.tag, c])), lessons: pub.map((l) => ({ id: l.id, title: l.title, chapters: l.chapters ?? [] })) });
    })().catch(() => alive && setState((s) => ({ ...s, ready: true })));
    return () => { alive = false; };
  }, []);
  return state;
}
