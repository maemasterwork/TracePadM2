import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Notice, Spinner } from '../design/ui';
import { useI18n } from '../i18n';
import { useAllLabs } from '../learn/hooks';
import { AnnouncementsTab } from '../teach/tabs/AnnouncementsTab';
import { AssignmentsTab } from '../teach/tabs/AssignmentsTab';
import { GradebookTab } from '../teach/tabs/GradebookTab';
import { Overview } from '../teach/tabs/Overview';
import { SettingsTab } from '../teach/tabs/SettingsTab';
import { Students } from '../teach/tabs/Students';
import { ErrorLine, Gate, useLoad, useTeachApi } from '../teach/hooks';

const TABS = ['overview', 'students', 'assignments', 'gradebook', 'announcements', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function TeachClass() { return <Gate need="teacher"><Inner /></Gate>; }

function Inner() {
  const { classId = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const { t, num } = useI18n();
  const { user } = useAuth();
  const api = useTeachApi()!;
  const all = useAllLabs();
  const classes = useLoad(() => api.classes(), [api]);
  const roster = useLoad(() => api.roster(classId), [api, classId]);
  const cls = classes.data?.find((c) => c.id === classId);
  const tab: Tab = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as Tab) : 'overview';

  if (classes.loading || roster.loading || !all.ready) return <Spinner label={t('app.loading')} />;
  if (!cls) return <div style={{ maxWidth: 640, margin: '24px auto' }}><Notice kind="bad">{t('cl.notFound')}</Notice><p><Link to="/teach">{t('tc.title')}</Link></p></div>;
  const props = { api, cls, roster: roster.data ?? [], all, isOwner: cls.teacher_id === user?.id, userId: user!.id, reloadClass: classes.reload, reloadRoster: roster.reload };
  return (
    <div style={{ maxWidth: 1100, margin: '24px auto' }}>
      <p className="no-print"><Link to="/teach">← {t('tc.title')}</Link></p>
      <h1>{cls.name}{cls.term && <small className="muted-line"> · {cls.term}</small>} {cls.archived_at && <span className="chip warn">{t('cl.archived')}</span>}</h1>
      <ErrorLine error={classes.error ?? roster.error} />
      <p className="muted-line">{t('tc.studentsCount', { n: num((roster.data ?? []).length) })}</p>
      <div role="tablist" aria-label={t('tc.tabs')} className="tabs no-print">
        {TABS.map((k) => (
          <button key={k} role="tab" type="button" id={'tab-' + k} aria-selected={tab === k} aria-controls="tabpanel" tabIndex={tab === k ? 0 : -1} className={'tab' + (tab === k ? ' on' : '')}
            onClick={() => setSp({ tab: k })}
            onKeyDown={(e) => { const i = TABS.indexOf(k); const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { const dir = document.dir === 'rtl' ? -d : d; const n = TABS[(i + dir + TABS.length) % TABS.length]; setSp({ tab: n }); setTimeout(() => document.getElementById('tab-' + n)?.focus(), 0); } }}>
            {t('tc.tab.' + k)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="tabpanel" aria-labelledby={'tab-' + tab} tabIndex={0} style={{ outline: 'none' }}>
        {tab === 'overview' && <Overview {...props} />}
        {tab === 'students' && <Students {...props} />}
        {tab === 'assignments' && <AssignmentsTab {...props} />}
        {tab === 'gradebook' && <GradebookTab {...props} />}
        {tab === 'announcements' && <AnnouncementsTab {...props} />}
        {tab === 'settings' && <SettingsTab {...props} />}
      </div>
    </div>
  );
}
