import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import { listHostelUsers, resetUserPassword } from '../../services/auth.service.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import FilterSelect from '../../components/common/FilterSelect.jsx';
import ConfirmationDialog from '../../components/common/ConfirmationDialog.jsx';
import TemporaryPasswordModal from '../../components/common/TemporaryPasswordModal.jsx';

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Students' },
  { value: 'HOSTEL_STAFF', label: 'Staff' },
];

export default function WardenPeoplePage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [target, setTarget] = useState(null); // user awaiting reset confirmation
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState(null); // { name, email, temporaryPassword }

  // Ignore responses from searches that have been superseded by a newer keystroke
  const requestSeq = useRef(0);

  const fetchUsers = async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      const res = await listHostelUsers(params);
      if (seq !== requestSeq.current) return;
      if (res.success && res.data) {
        setUsers(res.data.users);
        setTotal(res.data.total);
      } else {
        setError(res.message || 'Failed to load people');
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.userMessage || err.message || 'Failed to load people');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  const handleConfirmReset = async () => {
    if (!target) return;
    setResetting(true);
    setActionError(null);
    try {
      const res = await resetUserPassword(target.id);
      if (res.success && res.data) {
        setIssued({
          name: target.name,
          email: target.email,
          temporaryPassword: res.data.temporaryPassword,
        });
        setTarget(null);
        fetchUsers();
      } else {
        setActionError(res.message || 'Password reset failed');
        setTarget(null);
      }
    } catch (err) {
      setActionError(err.userMessage || err.message || 'Password reset failed');
      setTarget(null);
    } finally {
      setResetting(false);
    }
  };

  return (
    <DashboardLayout title="Residents and Staff" roleLabel="Warden">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Residents and Staff</h1>
          <p className="mt-1 text-xs text-slate-500">
            Students and technicians of your hostel. Use this when someone forgets their password: a
            temporary password is created and they must choose a new one when they sign in.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, student ID or employee ID"
            className="w-full sm:max-w-sm"
          />
          <FilterSelect
            label="Show"
            value={roleFilter}
            onChange={setRoleFilter}
            options={ROLE_OPTIONS}
            placeholder="Everyone"
          />
        </div>

        {actionError && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {actionError}
          </div>
        )}

        {loading && users.length === 0 ? (
          <LoadingSpinner text="Loading people..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchUsers} />
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            No one matches. Residents appear here after they register for your hostel.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">ID</th>
                    <th className="px-4 py-3 font-semibold">Room</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {u.role === 'STUDENT' ? 'Student' : 'Staff'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{u.studentId || u.employeeId || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{u.roomNumber || '-'}</td>
                      <td className="px-4 py-3">
                        {!u.isActive ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            Deactivated
                          </span>
                        ) : u.mustChangePassword ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Must set new password
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={!u.isActive}
                          onClick={() => {
                            setActionError(null);
                            setTarget(u);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
              Showing {users.length} of {total}
              {total > users.length ? '. Narrow the search to see the rest.' : '.'}
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={Boolean(target)}
        onClose={() => !resetting && setTarget(null)}
        onConfirm={handleConfirmReset}
        title="Reset password?"
        message={
          target ? (
            <>
              A temporary password will be created for <strong>{target.name}</strong> ({target.email}).
              Their current password stops working and they are signed out everywhere. You will see the
              temporary password once.
            </>
          ) : null
        }
        confirmText="Reset password"
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
    </DashboardLayout>
  );
}
