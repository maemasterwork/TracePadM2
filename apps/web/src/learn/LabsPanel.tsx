import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useRunner } from '../runner/RunnerProvider';
import type { RunResult } from '../runner/types';
import { ExerciseCard, PredictionCard, QuizCard, TraceView } from './Cards';
import { useRows } from './hooks';
import { itemKey } from './record';
import type { ChapterLabs } from './types';
import type { ConceptInfo } from '../content/types';

/** Everything a chapter offers to practise: predictions, a quiz, exercises and the memory-model demo. */
export function LabsPanel({ ch, labs, concepts }: { ch: number; labs: ChapterLabs; concepts: Map<string, ConceptInfo> }) {
  const { t } = useI18n();
  const runner = useRunner();
  const rows = useRows([`pred:${ch}:`, `quiz:${ch}:`, `ex:${ch}:`]);
  const byKey = new Map(rows.map((r) => [r.key, r.data as Record<string, unknown>]));
  const preds = labs.predictions ?? [], quizzes = labs.quizzes ?? [], exs = labs.exercises ?? [];
  const total = preds.length + quizzes.length + exs.length;
  const doneN = preds.filter((p) => byKey.get(itemKey('pred', ch, p.id))?.right === true).length
    + quizzes.filter((q) => byKey.get(itemKey('quiz', ch, q.id))?.right === true).length
    + exs.filter((e) => byKey.get(itemKey('ex', ch, e.id))?.pass === true).length;
  const [demo, setDemo] = useState<RunResult | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  useEffect(() => setDemo(null), [ch]);
  if (total === 0 && !labs.memory_demo) return null;
  const traceDemo = async () => { setDemoBusy(true); try { setDemo(await runner.run({ code: labs.memory_demo!, trace: true })); } finally { setDemoBusy(false); } };

  return (
    <section className="labs" aria-labelledby={`labs-${ch}`}>
      <div className="lab-head">
        <h2 id={`labs-${ch}`}>{t('lab.title')}</h2>
        {total > 0 && <span className="chip" data-testid="lab-progress">{t('lab.progress', { done: doneN, total })}</span>}
      </div>
      <p>{t('lab.help')}</p>
      {preds.length > 0 && <>
        <h3>{t('lab.predictTitle')}</h3>
        <p className="muted-line">{t('lab.predictHelp')}</p>
        {preds.map((p, i) => <PredictionCard key={p.id} ch={ch} p={p} n={i + 1} done={byKey.get(itemKey('pred', ch, p.id))?.right === true} concepts={concepts} />)}
      </>}
      {labs.memory_demo && <>
        <h3>{t('mem.title')}</h3>
        <pre className="lab-code" dir="ltr" tabIndex={0}><code>{labs.memory_demo}</code></pre>
        {!demo ? <button type="button" className="btn small" onClick={() => void traceDemo()} disabled={demoBusy}>{demoBusy ? t('mem.tracing') : t('mem.run')}</button>
          : <TraceView result={demo} code={labs.memory_demo} />}
      </>}
      {quizzes.length > 0 && <>
        <h3>{t('lab.quizTitle')}</h3>
        {quizzes.map((q, i) => <QuizCard key={q.id} ch={ch} q={q} n={i + 1} done={byKey.get(itemKey('quiz', ch, q.id))?.right === true} concepts={concepts} />)}
      </>}
      {exs.length > 0 && <>
        <h3>{t('lab.exerciseTitle')}</h3>
        {exs.map((e, i) => <ExerciseCard key={e.id} ch={ch} e={e} n={i + 1} saved={byKey.get(itemKey('ex', ch, e.id)) as never} concepts={concepts} />)}
      </>}
    </section>
  );
}
