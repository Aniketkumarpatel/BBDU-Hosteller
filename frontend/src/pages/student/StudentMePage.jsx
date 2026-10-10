import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import Icon from '../../components/jobs/icons.jsx';
import { describeBlock } from '../../utils/jobFormat.js';

/** Account: who I am, where I live, language, password, sign out. */
export default function StudentMePage() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { profile } = useOutletContext();
  const navigate = useNavigate();

  const me = profile || user || {};
  const room = me.roomNumber || me.roomId?.roomNumber || '';
  const block = me.blockId?.name || '';
  const hostel = me.hostelId?.name || '';

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const rows = [
    { label: t('me.studentId'), value: me.studentId },
    { label: t('job.hostel'), value: hostel },
    { label: t('student.yourRoom'), value: room ? [t('job.room', { room }), block ? describeBlock(t, block) : ''].filter(Boolean).join(' · ') : '' },
  ].filter((row) => row.value);

  return (
    <div className="space-y-5 px-4 pt-4">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('me.title')}</h1>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
            {(me.name || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-slate-900">{me.name}</p>
            <p className="truncate text-sm text-slate-500">{me.email}</p>
          </div>
        </div>
        {rows.length > 0 && (
          <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-base">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="text-right font-semibold text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <span className="text-lg font-bold text-slate-900">{t('me.language')}</span>
        <LanguageToggle />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <Link to="/change-password" className="flex h-16 items-center justify-between px-5 text-lg font-bold text-slate-800 hover:bg-slate-50">
          {t('menu.changePassword')}
          <Icon name="chevronRight" className="h-5 w-5 text-slate-300" />
        </Link>
        <button type="button" onClick={signOut} className="flex h-16 w-full items-center justify-between border-t border-slate-100 px-5 text-left text-lg font-bold text-brand-700 hover:bg-brand-50">
          {t('menu.signOut')}
        </button>
      </section>
    </div>
  );
}
