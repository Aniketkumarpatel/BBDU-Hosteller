import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from '../components/common/NotificationBell.jsx';

export default function DashboardLayout({ title, roleLabel, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isStudent = user?.role === 'STUDENT';
  const isWarden = user?.role === 'WARDEN';
  const isStaff = user?.role === 'HOSTEL_STAFF';
  const isAuthority = user?.role === 'AUTHORITY';
  const isAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-base font-bold text-indigo-700">
              <img src="/favicon.svg" alt="" className="h-7 w-7" />
              BBDU Hosteller
            </Link>
            <span className="text-slate-300">/</span>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              {roleLabel || user?.role}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationBell />

            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Secondary Role Navigation Bar */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto py-2">
            {isStudent && (
              <>
                <NavLink
                  to="/student/dashboard"
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/student/complaints"
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  My Complaints
                </NavLink>
                <NavLink
                  to="/student/complaints/new"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  + Submit Complaint
                </NavLink>
                <NavLink
                  to="/mess"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Mess &amp; Dining
                </NavLink>
                <NavLink
                  to="/outpass"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Outpass &amp; Visitors
                </NavLink>
                <NavLink
                  to="/assets"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Room Assets
                </NavLink>
                <NavLink
                  to="/student-services"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Student Services
                </NavLink>
              </>
            )}

            {isWarden && (
              <>
                <NavLink
                  to="/warden/dashboard"
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/warden/complaints"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Hostel Complaints
                </NavLink>
                <NavLink
                  to="/work-orders"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Work Orders
                </NavLink>
                <NavLink
                  to="/assets"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Asset Inventory
                </NavLink>
                <NavLink
                  to="/maintenance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Preventive Maintenance
                </NavLink>
                <NavLink
                  to="/mess"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Mess &amp; Dining
                </NavLink>
                <NavLink
                  to="/cleaning"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Housekeeping
                </NavLink>
                <NavLink
                  to="/outpass"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Outpass &amp; Visitors
                </NavLink>
                <NavLink
                  to="/ai-command-center"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  AI Command Center
                </NavLink>
                <NavLink
                  to="/finance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Finance &amp; Expenses
                </NavLink>
                <NavLink
                  to="/student-services"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Student Services
                </NavLink>
              </>
            )}

            {isStaff && (
              <>
                <NavLink
                  to="/staff/dashboard"
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/staff/complaints"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  My Complaints
                </NavLink>
                <NavLink
                  to="/work-orders"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Work Orders
                </NavLink>
                <NavLink
                  to="/assets"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Asset Inventory
                </NavLink>
                <NavLink
                  to="/maintenance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Maintenance
                </NavLink>
                <NavLink
                  to="/mess"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Mess &amp; Dining
                </NavLink>
                <NavLink
                  to="/cleaning"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Housekeeping
                </NavLink>
                <NavLink
                  to="/outpass"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Outpass &amp; Visitors
                </NavLink>
                <NavLink
                  to="/finance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Finance &amp; Expenses
                </NavLink>
                <NavLink
                  to="/student-services"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Student Services
                </NavLink>
              </>
            )}

            {isAuthority && (
              <>
                <NavLink
                  to="/authority/dashboard"
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Executive Dashboard
                </NavLink>
                <NavLink
                  to="/authority/complaints"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Campus Complaints
                </NavLink>
                <NavLink
                  to="/work-orders"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Work Orders
                </NavLink>
                <NavLink
                  to="/assets"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Asset Inventory
                </NavLink>
                <NavLink
                  to="/maintenance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Preventive Maintenance
                </NavLink>
                <NavLink
                  to="/mess"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Mess &amp; Dining
                </NavLink>
                <NavLink
                  to="/cleaning"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Housekeeping
                </NavLink>
                <NavLink
                  to="/outpass"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Outpass &amp; Visitors
                </NavLink>
                <NavLink
                  to="/ai-command-center"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  AI Command Center
                </NavLink>
                <NavLink
                  to="/finance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Finance &amp; Expenses
                </NavLink>
                <NavLink
                  to="/student-services"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Student Services
                </NavLink>
              </>
            )}

            {isAdmin && (
              <>
                <NavLink
                  to="/admin/dashboard"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Admin Console
                </NavLink>
                <NavLink
                  to="/authority/complaints"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Complaints
                </NavLink>
                <NavLink
                  to="/work-orders"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Work Orders
                </NavLink>
                <NavLink
                  to="/assets"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Asset Inventory
                </NavLink>
                <NavLink
                  to="/maintenance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Preventive Maintenance
                </NavLink>
                <NavLink
                  to="/mess"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Mess &amp; Dining
                </NavLink>
                <NavLink
                  to="/cleaning"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Housekeeping
                </NavLink>
                <NavLink
                  to="/outpass"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Outpass &amp; Visitors
                </NavLink>
                <NavLink
                  to="/ai-command-center"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  AI Command Center
                </NavLink>
                <NavLink
                  to="/finance"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Finance &amp; Expenses
                </NavLink>
                <NavLink
                  to="/student-services"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`
                  }
                >
                  Student Services
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        </div>
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        BBDU Hosteller &bull; Smart Hostel Management &amp; Complaint Escalation Platform &bull; Step 5.2
      </footer>
    </div>
  );
}
