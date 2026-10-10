import { useState, useEffect, useRef } from 'react';
import { listHostelUsers, resetUserPassword } from '../../services/auth.service.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Icon from '../../components/jobs/icons.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import ConfirmationDialog from '../../components/common/ConfirmationDialog.jsx';
import TemporaryPasswordModal from '../../components/common/TemporaryPasswordModal.jsx';

const ROLE_CHIPS = [
  { value: '', labelKey: 'people.everyone' },
  { value: 'STUDENT', labelKey: 'people.students' },
  { value: 'HOSTEL_STAFF', labelKey: 'people.staff' },
];

/**
 * Students and staff of the Warden's hostel, with a "Reset password" action (DEC-022,
 * DEC-029). Cards instead of a table so it reads on a phone. Lives in the Warden shell.
 */
export default function WardenPeoplePage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [actionError, setActionError] = useState('');

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const [target, setTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState(null);

  // Ignore responses from searches that a newer keystroke has superseded
  const requestSeq = useRef(0);

  const fetchUsers = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setErrorKey('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (role) params.role = role;
      const res = await listHostelUsers(params);
      if (seq !== requestSeq.current) return;
      if (res.success && res.data) {
        setUsers(res.data.users);
        setTotal(res.data.total);
      } else {
        setErrorKey('error.load');
      }
    } catch {
      if (seq === requestSeq.current) setErrorKey('error.load');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role]);

  const handleConfirmReset = async () => {
    if (!target) return;
    setResetting(true);
    setActionError('');
    try {
      const res = await resetUserPassword(target.id);
      if (res.success && res.data) {
        setIssued({ name: target.name, email: target.email, temporaryPassword: res.data.temporaryPassword });
        fetchUsers();
      } else {
        setActionError(t('error.reset'));
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || t('error.reset'));
    } finally {
      setResetting(false);
      setTarget(null);
    }
  };

  const statusOf = (u) =>
    !u.isActive
      ? { key: 'people.status.off', cls: 'bg-slate-100 text-slate-600' }
      : u.mustChangePassword
        ? { key: 'people.status.mustChange', cls: 'bg-amber-50 text-amber-800' }
        : { key: 'people.status.active', cls: 'bg-emerald-50 text-emerald-700' };

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('people.title')}</h1>
        <p className="mt-1 text-base text-slate-500">{t('people.hint')}</p>
      </section>

      <SearchInput value={search} onChange={setSearch} placeholder={t('people.search')} className="w-full" />

      <div className="flex flex-wrap gap-2.5" role="group" aria-label={t('people.show')}>
        {ROLE_CHIPS.map((chip) => {
          const on = role === chip.value;
          return (
            <button
              key={chip.value || 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => setRole(chip.value)}
              className={`min-h-11 rounded-full border-2 px-4 text-base font-semibold transition ${
                on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {t(chip.labelKey)}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-base font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : errorKey ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
          <Icon name="alert" className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-2 text-lg font-semibold text-rose-800">{t(errorKey)}</p>
          <button type="button" onClick={fetchUsers} className="mt-4 h-12 rounded-xl bg-rose-600 px-6 text-base font-bold text-white hover:bg-rose-700">
            {t('common.retry')}
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-base text-slate-500">{t('people.empty')}</div>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const status = statusOf(u);
            return (
              <li key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">{u.name}</p>
                    <p className="truncate text-sm text-slate-500">{u.email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold ${status.cls}`}>{t(status.key)}</span>
                </div>
                <p className="mt-2 text-base text-slate-600">
                  {u.role === 'STUDENT' ? t('people.roleStudent') : t('people.roleStaff')}
                  {(u.studentId || u.employeeId) && <span className="ml-2 font-mono text-sm text-slate-500">{u.studentId || u.employeeId}</span>}
                  {u.roomNumber && <span className="ml-2">{t('job.room', { room: u.roomNumber })}</span>}
                </p>
                <button
                  type="button"
                  disabled={!u.isActive}
                  onClick={() => {
                    setActionError('');
                    setTarget(u);
                  }}
                  className="mt-3 h-12 w-full rounded-xl border-2 border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('people.reset')}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !errorKey && users.length > 0 && (
        <p className="text-sm text-slate-400">
          {t('people.showing', { shown: users.length, total })}
          {total > users.length ? ` ${t('people.narrow')}` : ''}
        </p>
      )}

      <ConfirmationDialog
        isOpen={Boolean(target)}
        onClose={() => !resetting && setTarget(null)}
        onConfirm={handleConfirmReset}
        title={t('people.confirm.title')}
        message={target ? t('people.confirm.body', { name: target.name }) : null}
        confirmText={t('people.reset')}
        cancelText={t('common.cancel')}
        danger={false}
        loading={resetting}
      />

      <TemporaryPasswordModal
        isOpen={Boolean(issued)}
        onClose={() => setIssued(null)}
        userName={issued?.name}
        userEmail={issued?.email}
        temporaryPassword={issued?.temporaryPassword}
      />
    </div>
  );
}
