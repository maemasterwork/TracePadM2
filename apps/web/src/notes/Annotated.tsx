import { useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { NOTE_MAX, useNotes } from './NotesContext';

/** Wraps a paragraph-like block with an anchor id and note and bookmark controls. */
export function Annotated({ ch, start, children }: { ch: number; start: number; children: ReactNode }) {
  const { t } = useI18n();
  const notes = useNotes();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const text = notes.note(ch, start);
  const marked = notes.marked(ch, start);
  const id = `blk-${ch}-${start}`;
  return (
    <div className={'blk' + (marked ? ' marked' : '')} id={'b' + start}>
      {children}
      <div className="blk-tools" role="group" aria-label={t('notes.tools')}>
        <button type="button" className="icon-btn" onClick={() => { setDraft(text); setEditing(true); }} aria-label={text ? t('notes.edit') : t('notes.add')} title={text ? t('notes.edit') : t('notes.add')}><span aria-hidden="true">✎</span></button>
        <button type="button" className="icon-btn" aria-pressed={marked} onClick={() => void notes.toggleMark(ch, start)} aria-label={marked ? t('notes.unbookmark') : t('notes.bookmark')} title={marked ? t('notes.unbookmark') : t('notes.bookmark')}><span aria-hidden="true">{marked ? '★' : '☆'}</span></button>
      </div>
      {text && !editing && <aside className="note-box" aria-label={t('notes.note')}><strong>{t('notes.note')}: </strong><span dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{text}</span></aside>}
      {editing && (
        <form className="note-edit" onSubmit={(e) => { e.preventDefault(); void notes.saveNote(ch, start, draft.trim()).then(() => setEditing(false)); }}>
          <label htmlFor={id}>{t('notes.label')}</label>
          <textarea id={id} dir="auto" rows={3} maxLength={NOTE_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <p className="muted-line">{t('notes.private')}</p>
          <div className="row">
            <button className="btn small">{t('notes.save')}</button>
            <button type="button" className="btn small quiet" onClick={() => setEditing(false)}>{t('notes.cancel')}</button>
            {text && <button type="button" className="btn small danger" onClick={() => { void notes.saveNote(ch, start, '').then(() => setEditing(false)); }}>{t('notes.delete')}</button>}
          </div>
        </form>
      )}
    </div>
  );
}
