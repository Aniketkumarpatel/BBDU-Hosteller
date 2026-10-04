import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PublicLayout() {
  const { isAuthenticated, user, getDashboardPath } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-indigo-700">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            BBDU Hosteller
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link to="/" className="text-slate-600 hover:text-indigo-700">
              Home
            </Link>
            {isAuthenticated ? (
              <Link
                to={getDashboardPath()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-xs transition hover:bg-indigo-700"
              >
                Dashboard ({user?.role})
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-slate-700 shadow-xs transition hover:bg-slate-50"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-white shadow-xs transition hover:bg-indigo-700"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} BBDU Hosteller. Smart Hostel Management & Complaint Escalation.
      </footer>
    </div>
  );
}
