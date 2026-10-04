import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export default function AdminProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Super Admin Profile</h1>
        <p className="text-xs text-slate-500">Security credentials &amp; master administrative identity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:col-span-2">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-600 text-2xl font-bold text-white shadow-md">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                  {user?.role}
                </span>
                <StatusBadge status={user?.isActive !== false} />
              </div>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">Full Name</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Official Email</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Role Privilege Level</dt>
              <dd className="mt-1 text-sm font-semibold text-rose-700">SUPER_ADMIN (Tier 1 Root)</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Contact Phone</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{user?.phone || 'Not Provided'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Account ID</dt>
              <dd className="mt-1 font-mono text-xs text-slate-600">{user?.id || user?._id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Security Clearance</dt>
              <dd className="mt-1 text-xs font-semibold text-emerald-700">Full Database &amp; RBAC Access</dd>
            </div>
          </dl>

          <div className="mt-8 border-t border-slate-100 pt-5 flex justify-end">
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out of Admin Console
            </button>
          </div>
        </div>

        {/* Security Notice Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-rose-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-sm font-bold text-slate-900">Security &amp; Governance</h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Super Admin credentials carry highest-level privileges to create, mutate, toggle, and purge student records, accommodation structures, and staff configurations.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800">RBAC Safeguards:</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-500">
                <li>Self-account deletion is blocked.</li>
                <li>Self-account deactivation is blocked.</li>
                <li>Passwords are always hashed with bcryptjs.</li>
                <li>JWT session verified on every API request.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400">
            BBDU Hosteller Platform • Security Engine
          </div>
        </div>
      </div>
    </div>
  );
}
