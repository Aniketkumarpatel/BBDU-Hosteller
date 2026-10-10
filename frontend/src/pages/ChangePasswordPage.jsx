import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import LanguageToggle from '../components/common/LanguageToggle.jsx';
import { getPasswordPolicyIssue } from '../utils/passwordPolicy.js';

const inputClass =
  'mt-1.5 h-12 w-full rounded-xl border-2 border-slate-200 px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden';
const labelClass = 'block text-sm font-semibold text-slate-700';

/**
 * Change password. In forced mode (temporary or admin-set password) it is the only
 * screen the account can use, so it speaks plain words in English or Hindi, and the
 * language switch is on the card itself.
 */
export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const forced = Boolean(user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError(t(forced ? 'pw.err.currentForced' : 'pw.err.current'));
      return;
    }
    const issue = getPasswordPolicyIssue(newPassword);
    if (issue) {
      setError(t(`pw.err.${issue}`));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t('pw.err.same'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('pw.err.match'));
      return;
    }

    setSubmitting(true);
    try {
      const updatedUser = await changePassword({ currentPassword, newPassword });
      navigate(getDashboardPathForRole(updatedUser.role), { replace: true });
    } catch (err) {
      // The server's message (for example "Current password is incorrect.") is shown as it is
      setError(err?.response?.data?.message || t('pw.err.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>

        <div className="mt-2 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {forced ? t('pw.titleForced') : t('menu.changePassword')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
        </div>

        {forced && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-base text-amber-800">{t('pw.banner')}</div>}

        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-base font-medium text-red-700">
            {error}
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="currentPassword" className={labelClass}>
                {forced ? t('pw.temporary') : t('pw.current')}
              </label>
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="h-9 px-2 text-sm font-semibold text-brand-600 hover:text-brand-800"
              >
                {showPasswords ? t('pw.hide') : t('pw.show')}
              </button>
            </div>
            <input
              id="currentPassword"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="newPassword" className={labelClass}>
              {t('pw.new')}
            </label>
            <input
              id="newPassword"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-sm text-slate-500">{t('pw.hint')}</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              {t('pw.confirm')}
            </label>
            <input
              id="confirmPassword"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {submitting ? t('pw.saving') : t('pw.save')}
          </button>
        </form>

        <div className="mt-4 text-center">
          {forced ? (
            <button type="button" onClick={handleSignOut} className="h-11 px-3 text-base font-medium text-slate-500 hover:text-slate-800">
              {t('pw.signOutInstead')}
            </button>
          ) : (
            <button type="button" onClick={() => navigate(-1)} className="h-11 px-3 text-base font-medium text-slate-500 hover:text-slate-800">
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
