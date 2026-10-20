import { useI18n } from '../i18n';
import { coach } from './coach';

/** Shows an error the way a patient teacher would: where, what it means, what to try, and Python's own words last. */
export function ErrorCoach({ error, code }: { error: { type: string; message: string; line: number | null }; code: string }) {
  const { t, num } = useI18n();
  const hit = coach(error, code);
  return (
    <div className="errorcoach" role="note" aria-label={t('coach.title')}>
      <strong>{error.line ? t('code.errorTitle', { type: error.type, line: num(error.line) }) : t('code.errorNoLine', { type: error.type })}</strong>
      {hit && (
        <>
          <p style={{ margin: '6px 0' }}>{t(`coach.${hit.id}.what`, hit.params)}</p>
          {hit.params.suggest && <p style={{ margin: '6px 0', fontWeight: 600 }}>{t('coach.suggest', { name: hit.params.suggest })}</p>}
          <p style={{ margin: '6px 0' }}><strong>{t('coach.fixLabel')}: </strong>{t(`coach.${hit.id}.fix`, hit.params)}</p>
        </>
      )}
      <div className="code-ltr" dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.86rem', color: 'var(--muted)' }}>{t('coach.raw')}: {error.type}: {error.message}</div>
    </div>
  );
}
