import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

const LIST: [string, string][] = [['/', 'shortcuts.search'], [']', 'shortcuts.nextCh'], ['[', 'shortcuts.prevCh'], ['Ctrl + Enter', 'shortcuts.run'], ['?', 'shortcuts.title']];

/** The keyboard-shortcut list, in a native <dialog> (focus is trapped and Esc closes it). */
export function Shortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="shortcuts" onClose={onClose} aria-labelledby="sc-h">
      <h2 id="sc-h" style={{ marginTop: 0 }}>{t('shortcuts.title')}</h2>
      <table><tbody>{LIST.map(([k, l]) => <tr key={k}><th scope="row"><kbd dir="ltr">{k}</kbd></th><td>{t(l)}</td></tr>)}</tbody></table>
      <p className="muted-line">{t('shortcuts.escape')}</p>
      <button type="button" className="btn small" onClick={onClose}>{t('shortcuts.close')}</button>
    </dialog>
  );
}
