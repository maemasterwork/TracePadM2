import { useEffect, useState } from 'react';
import { useRunner } from '../runner/RunnerProvider';
import type { FlowEntry } from './types';

export interface LiveFlow { entry: FlowEntry | null; skip: string | null; busy: boolean }

/**
 * Flowchart of code the learner is editing: asks the Python worker (same generator as the build) shortly after typing
 * stops. A program that does not parse yet is not an error, it just has no chart until it does.
 */
export function useLiveFlow(code: string, enabled: boolean, delayMs = 500): LiveFlow {
  const runner = useRunner();
  const [state, setState] = useState<LiveFlow>({ entry: null, skip: null, busy: false });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setState((s) => ({ ...s, busy: true }));
    const h = setTimeout(() => {
      runner.flow(code).then((r) => {
        if (!alive) return;
        if ('charts' in r) setState({ entry: r, skip: null, busy: false });
        else setState({ entry: null, skip: 'skip' in r ? r.skip : 'error', busy: false });
      }).catch(() => alive && setState({ entry: null, skip: 'unavailable', busy: false }));
    }, delayMs);
    return () => { alive = false; clearTimeout(h); };
  }, [runner, code, enabled, delayMs]);
  return state;
}
