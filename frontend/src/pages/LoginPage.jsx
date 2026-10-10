import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getDashboardPathForRole } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError(t('login.err.empty'));
      return;
    }

    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      // Redirect to origin or appropriate role dashboard; a temporary password must be replaced first
      const target = user.mustChangePassword
        ? '/change-password'
        : location.state?.from?.pathname || getDashboardPathForRole(user.role);
      navigate(target, { replace: true });
    } catch (err) {
      // A 401 means wrong email or password; anything else keeps the server's message
      setError(err?.response?.status === 401 ? t('login.err.wrong') : err.userMessage || err.message || t('login.err.wrong'));
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    ['Student', 'student@bbdu.ac.in'],
    ['Warden', 'warden@bbdu.ac.in'],
    ['Staff', 'staff@bbdu.ac.in'],
    ['Authority', 'authority@bbdu.ac.in'],
    ['Admin', 'admin@bbdu.ac.in'],
  ];

  const handleFillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setError('');
  };

  const inputClass =
    'mt-1.5 h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-4 focus:ring-brand-100';

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-3xl bg-white p-6 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{t('login.title')}</h1>
        <p className="mt-1 text-base text-slate-500">{t('login.subtitle')}</p>

        {error && (
          <div role="alert" className="mt-5 rounded-2xl bg-brand-50 p-3.5 text-base font-medium text-brand-800 ring-1 ring-brand-200">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@bbdu.ac.in"
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                {t('login.password')}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="h-8 rounded-lg px-2 text-sm font-bold text-brand-600 hover:text-brand-800"
              >
                {showPassword ? t('pw.hide') : t('pw.show')}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[0_8px_18px_-8px_rgba(200,42,65,0.7)] transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t('login.working')}
              </span>
            ) : (
              t('login.button')
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-center text-base text-slate-500">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="font-bold text-brand-600 hover:underline">
              {t('login.register')}
            </Link>
          </p>

          <div className="mt-5 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600">
            <div className="font-semibold text-slate-700">Quick Demo Accounts (Password: Password@123)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {demoAccounts.map(([label, demoEmail]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleFillDemo(demoEmail)}
                  className="h-9 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
