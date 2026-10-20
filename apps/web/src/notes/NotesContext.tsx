import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useRows } from '../learn/hooks';

export const noteKey = (ch: number, start: number) => `note:${ch}:${start}`;
export const markKey = (ch: number, start: number) => `mk:${ch}:${start}`;
export const NOTE_MAX = 2000;

interface NotesApi { note: (ch: number, start: number) => string; marked: (ch: number, start: number) => boolean; saveNote: (ch: number, start: number, text: string) => Promise<void>; toggleMark: (ch: number, start: number) => Promise<void> }
const Ctx = createContext<NotesApi | null>(null);

/**
 * Notes (`note:<chapter>:<line>`) and bookmarks (`mk:<chapter>:<line>`) are ordinary progress rows, so they work offline,
 * sync, and are exported and deleted with the account. A deleted note is saved as empty text; an un-bookmark as on:false
 * (bookmarks use their own prefix rather than `bm:` because `bm:` rows can only ever turn on in the server's merge rules).
 */
export function NotesProvider({ children }: { children: ReactNode }) {
  const { progress } = useAuth();
  const rows = useRows(['note:', 'mk:']);
  const map = useMemo(() => new Map(rows.map((r) => [r.key, r.data as Record<string, unknown>])), [rows]);
  const note = useCallback((ch: number, s: number) => (typeof map.get(noteKey(ch, s))?.text === 'string' ? (map.get(noteKey(ch, s))!.text as string) : ''), [map]);
  const marked = useCallback((ch: number, s: number) => map.get(markKey(ch, s))?.on === true, [map]);
  const api = useMemo<NotesApi>(() => ({
    note, marked,
    saveNote: async (ch, s, text) => { await progress.save(noteKey(ch, s), { text: text.slice(0, NOTE_MAX) }); },
    toggleMark: async (ch, s) => { await progress.save(markKey(ch, s), { on: !marked(ch, s) }); },
  }), [note, marked, progress]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const NONE: NotesApi = { note: () => '', marked: () => false, saveNote: async () => undefined, toggleMark: async () => undefined };
export const useNotes = (): NotesApi => useContext(Ctx) ?? NONE;
