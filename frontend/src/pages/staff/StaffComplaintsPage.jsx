import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';
import { COMPLAINT_STATUS_LABELS } from '../../utils/statusLabels.js';

export default function StaffComplaintsPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [msg, setMsg] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await complaintService.listComplaints();
      if (res.success && res.data) {
        setComplaints(res.data);
      } else {
        setError(res.message || 'Could not load your tasks. Please try again.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Something went wrong loading your tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleAcknowledge = async (id) => {
    setActionLoadingId(id);
    setMsg('');
    try {
      const res = await complaintService.acknowledgeComplaint(id);
      if (res.success) {
        setMsg('You have confirmed you received this task. You can now start work when ready.');
        await fetchComplaints();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Could not confirm. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartWork = async (id) => {
    setActionLoadingId(id);
    setMsg('');
    try {
      const res = await complaintService.startWorkOnComplaint(id);
      if (res.success) {
        setMsg('Task marked as "Being fixed". The student will be notified.');
        await fetchComplaints();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Could not start the task. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResumeWork = async (id) => {
    setActionLoadingId(id);
    setMsg('');
    try {
      const res = await complaintService.resumeWorkOnComplaint(id);
      if (res.success) {
        setMsg('Task resumed. Status is now "Being fixed".');
        await fetchComplaints();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Could not resume the task. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getPriorityBadge = (p) => {
    const colorMap = {
      LOW:      'bg-blue-100 text-blue-700',
      MEDIUM:   'bg-emerald-100 text-emerald-700',
      HIGH:     'bg-amber-100 text-amber-700',
      CRITICAL: 'bg-rose-100 text-rose-700 font-bold',
    };
    const shortLabel = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorMap[p] || 'bg-slate-100 text-slate-700'}`}>
        {shortLabel[p] ?? p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const colorMap = {
      ASSIGNED:             'bg-blue-50 text-blue-700 border-blue-200',
      ACKNOWLEDGED:         'bg-sky-50 text-sky-700 border-sky-200',
      IN_PROGRESS:          'bg-amber-50 text-amber-700 border-amber-200',
      STUDENT_VERIFICATION: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
      RESOLVED:             'bg-purple-50 text-purple-700 border-purple-200',
      CLOSED:               'bg-emerald-50 text-emerald-800 border-emerald-200',
      REOPENED:             'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorMap[s] || 'bg-slate-50 text-slate-700'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {COMPLAINT_STATUS_LABELS[s] ?? s?.replace(/_/g, ' ')}
      </span>
    );
  };

  const currentUserId = user?._id || user?.id;

  const myComplaints = complaints.filter((c) => {
    const assignedId = c.assignedTo?._id || c.assignedTo;
    return assignedId === currentUserId || user?.role === 'SUPER_ADMIN';
  });

  const countAssigned          = myComplaints.filter((c) => c.status === 'ASSIGNED').length;
  const countAcknowledged      = myComplaints.filter((c) => c.status === 'ACKNOWLEDGED').length;
  const countInProgress        = myComplaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const countReopened          = myComplaints.filter((c) => c.status === 'REOPENED').length;
  const countAwaitingVerification = myComplaints.filter((c) => c.status === 'STUDENT_VERIFICATION').length;
  const countBreached          = myComplaints.filter((c) => c.slaStatus === 'BREACHED').length;

  const filteredTasks = myComplaints.filter((c) => {
    if (activeTab === 'ASSIGNED')             return c.status === 'ASSIGNED';
    if (activeTab === 'ACKNOWLEDGED')         return c.status === 'ACKNOWLEDGED';
    if (activeTab === 'IN_PROGRESS')          return c.status === 'IN_PROGRESS';
    if (activeTab === 'REOPENED')             return c.status === 'REOPENED';
    if (activeTab === 'STUDENT_VERIFICATION') return c.status === 'STUDENT_VERIFICATION';
    if (activeTab === 'CLOSED')               return c.status === 'CLOSED';
    if (activeTab === 'BREACHED')             return c.slaStatus === 'BREACHED';
    return true;
  });

  const tabs = [
    { key: 'ALL',                  label: `All tasks`,                    count: myComplaints.length,         activeColor: 'indigo' },
    { key: 'ASSIGNED',             label: `New — confirm receipt`,        count: countAssigned,               activeColor: 'rose' },
    { key: 'ACKNOWLEDGED',         label: `Ready to start`,               count: countAcknowledged,           activeColor: 'sky' },
    { key: 'IN_PROGRESS',          label: `Being fixed`,                  count: countInProgress,             activeColor: 'amber' },
    { key: 'REOPENED',             label: `Reopened`,                     count: countReopened,               activeColor: 'rose' },
    { key: 'STUDENT_VERIFICATION', label: `Is it fixed?`,                 count: countAwaitingVerification,   activeColor: 'purple' },
    { key: 'BREACHED',             label: `⚠ Overdue`,                    count: countBreached,               activeColor: 'rose' },
  ];

  return (
    <DashboardLayout title="My Maintenance Tasks" roleLabel="Hostel Staff">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <DashboardCard
            title="All my tasks"
            value={myComplaints.length}
            subtitle="Total assigned to you"
            color="indigo"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <DashboardCard
            title="Confirm receipt"
            value={countAssigned}
            subtitle="New — tap to confirm"
            color="rose"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardCard
            title="Ready to start"
            value={countAcknowledged}
            subtitle="Confirmed, not started yet"
            color="sky"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          />
          <DashboardCard
            title="Being fixed"
            value={countInProgress}
            subtitle="Currently in progress"
            color="amber"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <DashboardCard
            title="Reopened"
            value={countReopened}
            subtitle="Student says not fixed"
            color="rose"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />
        </div>

        {/* Success message */}
        {msg && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 flex justify-between items-center" role="status">
            <span>✓ {msg}</span>
            <button onClick={() => setMsg('')} className="text-emerald-700 font-bold" aria-label="Dismiss">
              &times;
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? `border-${tab.activeColor}-600 text-${tab.activeColor}-600`
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {/* Tasks table */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <LoadingSpinner size="md" message="Loading your tasks…" />
            </div>
          ) : error ? (
            <div className="py-6">
              <ErrorState title="Could not load tasks" message={error} onRetry={fetchComplaints} />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No tasks in this section right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Ref No.</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Location &amp; Room</th>
                    <th className="px-4 py-3">Urgency</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned on</th>
                    <th className="px-4 py-3 text-right">What to do next</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">
                        {c.complaintId}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-500">{c.category?.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {c.hostelId?.name || 'Hostel'} &bull; Room {c.roomId?.roomNumber || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {c.blockId?.name || ''} ({c.studentId?.name || 'Resident'})
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
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {c.assignedAt ? new Date(c.assignedAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short',
                        }) : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'ASSIGNED' && (
                            <button
                              onClick={() => handleAcknowledge(c._id)}
                              disabled={actionLoadingId === c._id}
                              title="Confirm you have received this task"
                              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 transition disabled:opacity-50"
                            >
                              {actionLoadingId === c._id ? '…' : 'Confirm receipt'}
                            </button>
                          )}

                          {c.status === 'ACKNOWLEDGED' && (
                            <button
                              onClick={() => handleStartWork(c._id)}
                              disabled={actionLoadingId === c._id}
                              title="Mark that you have started working on this"
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              {actionLoadingId === c._id ? '…' : 'Start work'}
                            </button>
                          )}

                          {c.status === 'REOPENED' && (
                            <button
                              onClick={() => handleResumeWork(c._id)}
                              disabled={actionLoadingId === c._id}
                              title="The student reported it is not fixed — resume work"
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition disabled:opacity-50"
                            >
                              {actionLoadingId === c._id ? '…' : 'Resume work'}
                            </button>
                          )}

                          <Link
                            to={`/staff/complaints/${c._id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            {c.status === 'IN_PROGRESS' ? 'Mark as fixed →' : 'View details →'}
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
      </div>
    </DashboardLayout>
  );
}
