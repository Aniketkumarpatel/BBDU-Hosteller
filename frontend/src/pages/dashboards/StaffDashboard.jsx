import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import dashboardService from '../../services/dashboardService.js';
import complaintService from '../../services/complaintService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';
import { COMPLAINT_STATUS_LABELS } from '../../utils/statusLabels.js';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getDashboardStats();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load staff dashboard');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAcknowledge = async (id) => {
    setActionLoadingId(id);
    setActionMsg('');
    try {
      const res = await complaintService.acknowledgeComplaint(id);
      if (res.success) {
        setActionMsg('✓ Task confirmed! You can start repair work when ready.');
        await fetchStats();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Could not confirm.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartWork = async (id) => {
    setActionLoadingId(id);
    setActionMsg('');
    try {
      const res = await complaintService.startWorkOnComplaint(id);
      if (res.success) {
        setActionMsg('✓ Task marked as "In Progress".');
        await fetchStats();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Could not start task.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getPriorityBadge = (p) => {
    const colorMap = {
      LOW: 'bg-blue-100 text-blue-700',
      MEDIUM: 'bg-emerald-100 text-emerald-700',
      HIGH: 'bg-amber-100 text-amber-700',
      CRITICAL: 'bg-rose-100 text-rose-700 font-bold',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorMap[p] || 'bg-slate-100 text-slate-700'}`}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const colorMap = {
      ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
      ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-200',
      IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
      STUDENT_VERIFICATION: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
      RESOLVED: 'bg-purple-50 text-purple-700 border-purple-200',
      CLOSED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      REOPENED: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorMap[s] || 'bg-slate-50 text-slate-700'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {COMPLAINT_STATUS_LABELS[s] ?? s?.replace(/_/g, ' ')}
      </span>
    );
  };

  const assignedComplaints = data?.assignedComplaints || [];
  const assignedWorkOrders = data?.assignedWorkOrders || [];
  const taskMetrics = data?.taskMetrics || {};

  return (
    <DashboardLayout title="Staff Operations Portal" roleLabel="Hostel Staff">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading your operations profile..." />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load staff dashboard"
          message={error}
          onRetry={fetchStats}
        />
      ) : (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-800 to-slate-900 p-6 text-white shadow-md">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Staff Operations Dashboard
                </span>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  Welcome, {data?.staff?.name || user?.name}!
                </h1>
                <p className="mt-1 text-sm text-teal-200">
                  {data?.department ? `${data.department.name} Department` : 'Hostel Maintenance & Services'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs font-medium text-white">
                  Emp ID: {data?.staff?.employeeId || user?.employeeId || 'STAFF-001'}
                </span>
                <button
                  onClick={fetchStats}
                  className="rounded-lg bg-teal-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition"
                  title="Refresh tasks"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Action notification message */}
          {actionMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 flex justify-between items-center shadow-xs">
              <span>{actionMsg}</span>
              <button onClick={() => setActionMsg('')} className="text-emerald-700 font-bold">&times;</button>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DashboardCard
              title="New Assigned"
              value={taskMetrics.assigned ?? 0}
              subtitle="Pending confirmation"
              color="rose"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <DashboardCard
              title="In Progress"
              value={taskMetrics.inProgress ?? 0}
              subtitle="Work underway"
              color="amber"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <DashboardCard
              title="Total Active Tasks"
              value={taskMetrics.totalActive ?? 0}
              subtitle="Active repair jobs"
              color="teal"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <DashboardCard
              title="SLA Overdue"
              value={data?.slaStats?.breached ?? 0}
              subtitle="Breached deadline"
              color="rose"
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>

          {/* Assigned Work & Live Task Queue Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-600 animate-pulse" />
                  My Assigned Work Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complaints &amp; maintenance tasks assigned by Warden to your queue.
                </p>
              </div>
              <Link
                to="/staff/complaints"
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 transition"
              >
                Full Work Queue ({taskMetrics.totalActive ?? 0}) &rarr;
              </Link>
            </div>

            {assignedComplaints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">No active assigned tasks right now.</p>
                <p className="mt-1 text-slate-400">When the Warden assigns complaints to you or your department, they will appear right here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Ref No.</th>
                      <th className="px-4 py-3">Issue Title</th>
                      <th className="px-4 py-3">Location &amp; Room</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status / SLA</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignedComplaints.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">
                          {c.complaintId}
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                          <div className="text-[11px] text-slate-500">{c.departmentId?.name || c.category?.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900">
                            {c.hostelId?.name || 'Hostel'} &bull; Room {c.roomId?.roomNumber || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.studentId?.name || 'Resident'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {getPriorityBadge(c.priority)}
                        </td>
                        <td className="px-4 py-3.5 space-y-1">
                          <div>{getStatusBadge(c.status)}</div>
                          <SlaBadge
                            slaStatus={c.slaStatus}
                            slaDueAt={c.slaDueAt}
                            slaStartedAt={c.slaStartedAt}
                            reminderSentAt={c.reminderSentAt}
                            complaintStatus={c.status}
                            escalationLevel={c.currentEscalationLevel}
                          />
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {c.status === 'ASSIGNED' && (
                              <button
                                onClick={() => handleAcknowledge(c._id)}
                                disabled={actionLoadingId === c._id}
                                title="Confirm task receipt"
                                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 transition disabled:opacity-50"
                              >
                                {actionLoadingId === c._id ? '…' : 'Confirm receipt'}
                              </button>
                            )}

                            {c.status === 'ACKNOWLEDGED' && (
                              <button
                                onClick={() => handleStartWork(c._id)}
                                disabled={actionLoadingId === c._id}
                                title="Start repair work"
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                {actionLoadingId === c._id ? '…' : 'Start work'}
                              </button>
                            )}

                            <Link
                              to={`/staff/complaints/${c._id}`}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                              {c.status === 'IN_PROGRESS' ? 'Mark fixed →' : 'View →'}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Maintenance Work Orders (if any) */}
          {assignedWorkOrders.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-3">
                Assigned Maintenance Work Orders
              </h3>
              <div className="divide-y divide-slate-100">
                {assignedWorkOrders.map((wo) => (
                  <div key={wo._id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-teal-700">{wo.workOrderId}</span>
                      <h4 className="text-sm font-semibold text-slate-900">{wo.title}</h4>
                      <p className="text-xs text-slate-500">{wo.hostelId?.name} • Room {wo.roomId?.roomNumber || '-'}</p>
                    </div>
                    <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                      {wo.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Details & Jurisdictional Profile Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Staff Profile &amp; Assignment Scope</h2>
                <p className="text-xs text-slate-500">Service department &amp; jurisdictional location details</p>
              </div>
              <StatusBadge status={data?.staff?.isActive !== false} />
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-slate-500">Staff Full Name</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.staff?.name || user?.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Employee ID</dt>
                <dd className="mt-1 text-sm font-semibold font-mono text-slate-900">
                  {data?.staff?.employeeId || user?.employeeId || 'STAFF-001'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Official Email</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{data?.staff?.email || user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Department</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {data?.department ? `${data.department.name} (${data.department.code})` : 'General Maintenance'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Assigned Location</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {data?.hostel ? `${data.hostel.name}` : 'Campus-Wide Support'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Jurisdiction Scope</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {data?.operationalOverview?.roomsCount ?? 0} Rooms
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
