import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

export default function Topbar({ title, onOpenSidebar }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Super Admin Console
        </span>

        <div className="hidden text-right text-xs sm:block">
          <div className="font-semibold text-slate-800">{user?.name}</div>
          <div className="text-[10px] text-slate-500">{user?.role}</div>
        </div>

        <Link
          to="/change-password"
          className="hidden text-xs font-medium text-slate-500 hover:text-slate-800 sm:inline"
        >
          Change password
        </Link>

        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
