import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadFlow } from '../content/api';
import type { FlowEntry, FlowMap } from './types';

const Ctx = createContext<FlowMap | null>(null);

/** Loads the flowcharts of one lesson (flow.json). If the file is missing or fails, the lesson simply has no charts. */
export function FlowProvider({ lessonId, children }: { lessonId: string | undefined; children: ReactNode }) {
  const [map, setMap] = useState<FlowMap | null>(null);
  useEffect(() => {
    let alive = true;
    setMap(null);
    if (lessonId) loadFlow(lessonId).then((m) => { if (alive) setMap(m); }).catch(() => undefined);
    return () => { alive = false; };
  }, [lessonId]);
  return <Ctx.Provider value={map}>{children}</Ctx.Provider>;
}

/** key: `block:<block id>` for a lesson example, `pred:<chapter>:<id>` for a prediction program. */
export function useFlowEntry(key: string): FlowEntry | null {
  return useContext(Ctx)?.[key] ?? null;
}
