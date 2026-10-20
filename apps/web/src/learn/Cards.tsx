import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n';
import { MemoryModel } from '../memory/MemoryModel';
import { Editor } from '../runner/Editor';
import { useRunner } from '../runner/RunnerProvider';
import type { RunResult } from '../runner/types';
import { ErrorCoach } from './ErrorCoach';
import { buildTestCode, firstDifference, hintLevel, hintState, judge, predictionMatches, type TestOutcome } from './grading';
import { recordAnswer, recordExercise } from './record';
import { RichText } from './RichText';
import type { Exercise, LText, Prediction, Quiz } from './types';

export const MAX_TRACE_STEPS = 1500;

export function useTexts() {
  const { pick, locale } = useI18n();
  const rich = (x: LText | undefined) => <RichText text={pick(x)} />;
  const machine = (x: LText | undefined) => locale === 'fa' && x?.fa_status === 'machine';
  return { rich, machine };
}

function Chips({ done, tag, concepts, machineNote }: { done: boolean; tag?: string; concepts: Map<string, { name: LText }>; machineNote?: boolean }) {
  const { t, pick } = useI18n();
  const name = tag ? concepts.get(tag)?.name : undefined;
  return (
    <span className="row" style={{ gap: 6 }}>
      {name && <span className="chip">{t('lab.concept', { name: pick(name) })}</span>}
      {done && <span className="chip good">✓ {t('lab.done')}</span>}
      {machineNote && <span className="chip warn">{t('lab.machineFa')}</span>}
    </span>
  );
}

type Concepts = Map<string, { name: LText }>;

/** Sets a run in motion and keeps the "engine is starting" notice in step with it. */
function useRun() {
  const runner = useRunner();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (req: Parameters<typeof runner.run>[0]): Promise<RunResult> => {
    setBusy(true);
    try { return await runner.run(req); } finally { setBusy(false); }
  }, [runner]);
  return { run, busy, runner };
}

/* ------------------------------------------------------------------ prediction */
export function PredictionCard({ ch, p, n, done, concepts, review, onResult }: { ch: number; p: Prediction; n?: number; done?: boolean; concepts: Concepts; review?: boolean; onResult?: (ok: boolean) => void }) {
  const { t } = useI18n();
  const { progress } = useAuth();
  const { rich, machine } = useTexts();
  const { run, busy } = useRun();
  const [guess, setGuess] = useState('');
  const [res, setRes] = useState<{ ok: boolean; out: string; err: RunResult['error'] } | null>(null);
  const [steps, setSteps] = useState<RunResult | null>(null);
  const seen = useRef(false); // once the answer has been shown, further tries are practice, not evidence
  const id = `pred-${ch}-${p.id}`;

  const check = async () => {
    const r = await run({ code: p.code });
    const ok = p.nondeterministic ? true : predictionMatches(guess, p);
    setRes({ ok, out: r.error && r.events.length === 0 ? '' : r.stdout, err: r.error });
    await recordAnswer(progress, 'pred', ch, p.id, ok, { guess: guess.slice(0, 2000) }, Date.now(), seen.current);
    seen.current = true;
    onResult?.(ok);
  };
  const trace = async () => setSteps(await run({ code: p.code, trace: true, ...{} }));
  const diff = res && !res.ok ? firstDifference(p.answer, guess) : null;

  return (
    <article className="card lab" aria-labelledby={id + '-h'} data-item={`pred:${ch}:${p.id}`}>
      <div className="lab-head">
        <h4 id={id + '-h'}>{n ? t('lab.predictionNum', { n }) : t('lab.predictTitle')}</h4>
        <Chips done={!!done} tag={p.tag} concepts={concepts} machineNote={machine(p.why)} />
      </div>
      <pre className="lab-code" dir="ltr" tabIndex={0} aria-label={t('lab.predictTitle')}><code>{p.code}</code></pre>
      <div className="field">
        <label htmlFor={id + '-g'}>{t('lab.guessLabel')}</label>
        <textarea id={id + '-g'} className="code-ltr" dir="ltr" rows={Math.min(Math.max(p.answer.split('\n').length, 2), 8)} value={guess} onChange={(e) => setGuess(e.target.value)} spellCheck={false} autoComplete="off" />
      </div>
      <div className="row">
        <button type="button" className="btn small" onClick={() => void check()} disabled={busy || (!guess.trim() && !p.nondeterministic)}>{busy ? t('lab.checking') : t('lab.runCompare')}</button>
        {res && !review && <button type="button" className="btn small quiet" onClick={() => { setRes(null); setSteps(null); }}>{t('lab.tryAgain')}</button>}
      </div>
      {res && (
        <div className={'verdict ' + (res.ok ? 'good' : 'bad')} role="status">
          <strong>{res.ok ? t('lab.matched') : t('lab.missed')}</strong>
          <div className="cmp">
            <div><span className="cmp-h">{t('lab.youGuessed')}</span><pre dir="ltr">{guess || ' '}</pre></div>
            <div><span className="cmp-h">{t('lab.pythonPrinted')}</span><pre dir="ltr">{(res.out || p.answer).replace(/\n$/, '') || ' '}</pre></div>
          </div>
          {diff && <p className="muted-line" dir="auto">{t('lab.firstDiff', { line: diff.line, want: diff.want || '∅', got: diff.got || '∅' })}</p>}
          {res.err && <ErrorCoach error={res.err} code={p.code} />}
          <p><strong>{t('lab.why')}: </strong>{rich(p.why)}</p>
          {p.memory_after && !steps && <button type="button" className="btn small alt" onClick={() => void trace()} disabled={busy}>{t('lab.showMemory')}</button>}
          {steps && <><button type="button" className="btn small quiet" onClick={() => setSteps(null)}>{t('lab.hideMemory')}</button><TraceView result={steps} code={p.code} /></>}
        </div>
      )}
    </article>
  );
}

export function TraceView({ result, code }: { result: RunResult; code: string }) {
  if (!result.steps?.length) return null;
  return <MemoryModel code={code} steps={result.steps} truncated={result.truncated} failed={!!result.error} maxSteps={MAX_TRACE_STEPS} />;
}

/* ------------------------------------------------------------------ quiz */
export function QuizCard({ ch, q, n, done, concepts, review, onResult }: { ch: number; q: Quiz; n?: number; done?: boolean; concepts: Concepts; review?: boolean; onResult?: (ok: boolean) => void }) {
  const { t, pick } = useI18n();
  const { progress } = useAuth();
  const { rich, machine } = useTexts();
  const [pickIdx, setPick] = useState<number | null>(null);
  const [res, setRes] = useState<boolean | null>(null);
  const seen = useRef(false);
  const id = `quiz-${ch}-${q.id}`;
  // In a review the options come in a different order each time, so the position cannot be memorised.
  const order = useMemo(() => {
    const idx = q.options.map((_, i) => i);
    if (review) for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx;
  }, [q, review]);

  const check = async () => {
    if (pickIdx == null) return;
    const ok = pickIdx === q.correct;
    setRes(ok);
    await recordAnswer(progress, 'quiz', ch, q.id, ok, { pick: pickIdx }, Date.now(), seen.current);
    seen.current = true;
    onResult?.(ok);
  };
  return (
    <article className="card lab" aria-labelledby={id + '-h'} data-item={`quiz:${ch}:${q.id}`}>
      <div className="lab-head">
        <h4 id={id + '-h'}>{n ? t('lab.quizNum', { n }) : t('lab.quizTitle')}</h4>
        <Chips done={!!done} tag={q.tag} concepts={concepts} machineNote={machine(q.why)} />
      </div>
      <fieldset className="quiz" disabled={res !== null}>
        <legend>{rich(q.question)}</legend>
        {order.map((oi) => (
          <label key={oi} className={'opt' + (res !== null && oi === q.correct ? ' right' : res === false && oi === pickIdx ? ' wrong' : '')}>
            <input type="radio" name={id} checked={pickIdx === oi} onChange={() => setPick(oi)} />
            <span>{rich(q.options[oi])}</span>
          </label>
        ))}
      </fieldset>
      <div className="row">
        <button type="button" className="btn small" onClick={() => void check()} disabled={pickIdx == null || res !== null}>{t('lab.checkAnswer')}</button>
        {res !== null && !review && <button type="button" className="btn small quiet" onClick={() => { setRes(null); setPick(null); }}>{t('lab.tryAgain')}</button>}
      </div>
      {res !== null && (
        <div className={'verdict ' + (res ? 'good' : 'bad')} role="status">
          <strong>{res ? t('lab.correct') : t('lab.incorrect')}</strong>
          {!res && <p>{t('lab.rightAnswer')}: {rich(q.options[q.correct])}</p>}
          <p><strong>{t('lab.why')}: </strong>{rich(q.why)}</p>
          <span className="sr-only">{pick(q.options[pickIdx ?? 0])}</span>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ exercise */
export function ExerciseCard({ ch, e, n, saved, concepts }: { ch: number; e: Exercise; n: number; saved?: { pass?: boolean; code?: string; hints?: number; attempts?: number; hist?: { ok: boolean }[]; sol?: boolean }; concepts: Concepts }) {
  const { t, num } = useI18n();
  const { progress } = useAuth();
  const { rich } = useTexts();
  const { run, busy } = useRun();
  const [code, setCode] = useState(e.starter);
  const touched = useRef(false);
  const [out, setOut] = useState<RunResult | null>(null);
  const [outcomes, setOutcomes] = useState<TestOutcome[] | null>(null);
  const [hints, setHints] = useState(0);
  const [showSol, setShowSol] = useState(false);
  const [history, setHistory] = useState<{ k: number; total: number }[]>([]);
  const active = useRef({ ms: 0, last: 0 });
  const id = `ex-${ch}-${e.id}`;

  // Restore the learner's last code and hint count once, unless they have already started typing.
  useEffect(() => {
    if (touched.current || !saved) return;
    if (typeof saved.code === 'string' && saved.code) setCode(saved.code);
    if (typeof saved.hints === 'number') setHints((h) => Math.max(h, Math.min(saved.hints!, e.hints.length)));
  }, [saved?.code, saved?.hints]); // eslint-disable-line react-hooks/exhaustive-deps

  const tick = () => { const now = Date.now(); if (active.current.last && now - active.current.last < 60_000) active.current.ms += now - active.current.last; active.current.last = now; };
  const edit = (v: string) => { touched.current = true; tick(); setCode(v); };
  const hs = hintState(e, hints);

  const runFree = async () => { tick(); setOut(await run({ code })); };
  const check = async () => {
    tick();
    const results: TestOutcome[] = [];
    for (let i = 0; i < e.tests.length; i++) {
      const tc = e.tests[i];
      const { code: c, paramMatched } = buildTestCode(e, code, tc);
      const r = await run({ code: c });
      results.push(judge(e, tc, i, r, paramMatched));
      if (r.timedOut) break;
    }
    const passed = results.filter((r) => r.pass).length;
    const pass = passed === e.tests.length;
    setOutcomes(results);
    setHistory((h) => [...h, { k: passed, total: e.tests.length }].slice(-8));
    await recordExercise(progress, ch, e.id, { pass, passed, total: e.tests.length, code, hints, secs: Math.round(active.current.ms / 1000), usedSolution: showSol });
  };
  const reset = () => { touched.current = true; setCode(e.starter); setOutcomes(null); setOut(null); };
  const done = saved?.pass === true || (outcomes?.every((o) => o.pass) ?? false);
  const visible = outcomes?.filter((o) => !o.hidden) ?? [];
  const shownHints = e.hints.slice(0, hs.shown);
  const secs = Math.round(active.current.ms / 1000);
  const mm = (s: number) => `${num(Math.floor(s / 60))}:${num(s % 60).padStart(2, num(0))}`;
  const attempts = Math.max(saved?.attempts ?? 0, history.length);

  return (
    <article className="card lab" aria-labelledby={id + '-h'} data-item={`ex:${ch}:${e.id}`}>
      <div className="lab-head">
        <h4 id={id + '-h'}>{t('lab.exerciseNum', { n })}{e.title ? ` · ${e.title}` : ''}</h4>
        <Chips done={done} concepts={concepts} />
      </div>
      <p>{rich(e.prompt)}</p>
      <div className="codeblock">
        <div className="bar">
          <button type="button" className="btn small alt" onClick={() => void runFree()} disabled={busy}>{t('lab.run')}</button>
          <button type="button" className="btn small" onClick={() => void check()} disabled={busy}>{busy ? t('lab.checking') : t('lab.check')}</button>
          <span className="grow" />
          <button type="button" className="btn small quiet" onClick={reset}>{t('lab.resetCode')}</button>
        </div>
        <Editor value={code} onChange={edit} label={t('lab.editorLabel')} onRun={() => void runFree()} />
        {out && (
          <div className="outbox" tabIndex={0} role="region" aria-label={t('lab.output')}>
            {out.events.length === 0 && !out.error && <span className="note">{t('code.noOutput')}</span>}
            {out.events.map((ev, i) => <span key={i} className={ev[0]}>{ev[1]}</span>)}
            {out.timedOut && <div className="note">{t('lab.timedOut')}</div>}
          </div>
        )}
        {out?.error && out.error.type !== 'KeyboardInterrupt' && <ErrorCoach error={out.error} code={code} />}
      </div>
      {outcomes && (
        <div className={'verdict ' + (done ? 'good' : 'bad')} role="status">
          <strong>{done ? t('lab.allPass', { n: num(outcomes.length) }) : t('lab.somePass', { k: num(outcomes.filter((o) => o.pass).length), n: num(outcomes.length) })}</strong>
          <ul className="tests">
            {outcomes.map((o) => (
              <li key={o.index} className={o.pass ? 'ok' : 'no'}>
                <span aria-hidden="true">{o.pass ? '✓' : '✗'}</span> {o.hidden ? t('lab.hiddenTest', { n: num(o.index + 1) }) : t('lab.testN', { n: num(o.index + 1) })}: {o.pass ? t('lab.pass') : t('lab.fail')}
                {!o.pass && !o.hidden && (
                  <div className="cmp" dir="ltr">
                    <div><span className="cmp-h">{t('lab.expected')}</span><pre>{o.want || ' '}</pre></div>
                    <div><span className="cmp-h">{t('lab.got')}</span><pre>{o.got || ' '}</pre></div>
                  </div>
                )}
                {o.paramMissing && <p className="muted-line">{t('lab.paramMissing')}</p>}
                {o.timedOut && <p className="muted-line">{t('lab.timedOut')}</p>}
              </li>
            ))}
          </ul>
          {visible.some((o) => !o.pass && o.error) && <ErrorCoach error={(() => { const m = /^(\w+): ([\s\S]*)$/.exec(visible.find((o) => !o.pass && o.error)!.error!); return { type: m?.[1] ?? 'Error', message: m?.[2] ?? '', line: null }; })()} code={code} />}
        </div>
      )}
      <div className="hints">
        {shownHints.map((h, i) => (
          <div key={i} className="hint-box">
            <strong>{t('lab.hintOf', { i: num(i + 1), n: num(hs.total) })} · {t(`lab.hintLevel.${hintLevel(hs.total, i)}`)}: </strong>{rich(h)}
          </div>
        ))}
        <div className="row">
          {hs.canShowHint && <button type="button" className="btn small quiet" onClick={() => setHints(hs.shown + 1)}>{t('lab.hint')}</button>}
          {!showSol && <button type="button" className="btn small quiet" disabled={!hs.canShowSolution} onClick={() => setShowSol(true)} aria-describedby={id + '-lock'}>{t('lab.showSolution')}</button>}
          {!hs.canShowSolution && <span id={id + '-lock'} className="muted-line">{t('lab.solutionLocked', { n: num(hs.total) })}</span>}
        </div>
        {showSol && (
          <div className="hint-box">
            <strong>{t('lab.solution')}</strong>
            <pre className="lab-code" dir="ltr" tabIndex={0}><code>{e.solution}</code></pre>
            <span className="muted-line">{t('lab.solutionNote')}</span>
          </div>
        )}
      </div>
      <p className="muted-line">{t('lab.attemptsLine', { n: num(attempts), h: num(hs.shown), s: mm(secs) })}</p>
      {history.length > 0 && (
        <details>
          <summary>{t('lab.history')}</summary>
          <ol className="attempts">{history.map((h, i) => <li key={i}>{t('lab.historyRow', { n: num(i + 1), k: num(h.k), total: num(h.total) })}</li>)}</ol>
        </details>
      )}
    </article>
  );
}
