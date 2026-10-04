import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';

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
        setError(res.message || 'Failed to load task queue');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching staff tasks');
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
        setMsg('Task acknowledged successfully!');
        await fetchComplaints();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to acknowledge');
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
        setMsg('Work marked as In Progress!');
        await fetchComplaints();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to start work');
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
        setMsg('Work resumed on reopened complaint! Status updated to In Progress.');
        await fetchComplaints();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to resume work');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getPriorityBadge = (p) => {
    const map = {
      LOW: 'bg-blue-100 text-blue-700',
      MEDIUM: 'bg-emerald-100 text-emerald-700',
      HIGH: 'bg-amber-100 text-amber-700',
      CRITICAL: 'bg-rose-100 text-rose-700 font-bold',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[p] || 'bg-slate-100 text-slate-700'}`}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const map = {
      ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
      ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-200',
      IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
      STUDENT_VERIFICATION: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
      RESOLVED: 'bg-purple-50 text-purple-700 border-purple-200',
      CLOSED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      REOPENED: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[s] || 'bg-slate-50 text-slate-700'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {s?.replace(/_/g, ' ')}
      </span>
    );
  };

  const currentUserId = user?._id || user?.id;

  // Filter tasks
  const myComplaints = complaints.filter((c) => {
    const assignedId = c.assignedTo?._id || c.assignedTo;
    return assignedId === currentUserId || user?.role === 'SUPER_ADMIN';
  });

  const countAssigned = myComplaints.filter((c) => c.status === 'ASSIGNED').length;
  const countAcknowledged = myComplaints.filter((c) => c.status === 'ACKNOWLEDGED').length;
  const countInProgress = myComplaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const countReopened = myComplaints.filter((c) => c.status === 'REOPENED').length;
  const countAwaitingVerification = myComplaints.filter((c) => c.status === 'STUDENT_VERIFICATION').length;
  const countBreached = myComplaints.filter((c) => c.slaStatus === 'BREACHED').length;

  const filteredTasks = myComplaints.filter((c) => {
    if (activeTab === 'ASSIGNED') return c.status === 'ASSIGNED';
    if (activeTab === 'ACKNOWLEDGED') return c.status === 'ACKNOWLEDGED';
    if (activeTab === 'IN_PROGRESS') return c.status === 'IN_PROGRESS';
    if (activeTab === 'REOPENED') return c.status === 'REOPENED';
    if (activeTab === 'STUDENT_VERIFICATION') return c.status === 'STUDENT_VERIFICATION';
    if (activeTab === 'CLOSED') return c.status === 'CLOSED';
    if (activeTab === 'BREACHED') return c.slaStatus === 'BREACHED';
    return true;
  });

  return (
    <DashboardLayout title="My Assigned Work Queue" roleLabel="Hostel Staff">
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <DashboardCard
            title="Total Assigned"
            value={myComplaints.length}
            subtitle="All allocated tickets"
            color="indigo"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <DashboardCard
            title="Needs Acknowledgment"
            value={countAssigned}
            subtitle="Awaiting response"
            color="rose"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <DashboardCard
            title="Ready to Start"
            value={countAcknowledged}
            subtitle="Acknowledged tickets"
            color="sky"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          />
          <DashboardCard
            title="In Progress"
            value={countInProgress}
            subtitle="Under active work"
            color="amber"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
          <DashboardCard
            title="Reopened by Student"
            value={countReopened}
            subtitle="Requires resume work"
            color="rose"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />
        </div>

        {/* Success Alert */}
        {msg && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 flex justify-between items-center">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-emerald-700 font-bold">&times;</button>
          </div>
        )}

        {/* Tab Filters */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'ALL'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            All Assigned ({myComplaints.length})
          </button>
          <button
            onClick={() => setActiveTab('ASSIGNED')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'ASSIGNED'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Needs Acknowledgment ({countAssigned})
          </button>
          <button
            onClick={() => setActiveTab('ACKNOWLEDGED')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'ACKNOWLEDGED'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Ready to Start ({countAcknowledged})
          </button>
          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'IN_PROGRESS'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            In Progress ({countInProgress})
          </button>
          <button
            onClick={() => setActiveTab('REOPENED')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'REOPENED'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Reopened ({countReopened})
          </button>
          <button
            onClick={() => setActiveTab('STUDENT_VERIFICATION')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'STUDENT_VERIFICATION'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Verify Resolution ({countAwaitingVerification})
          </button>
          <button
            onClick={() => setActiveTab('BREACHED')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
              activeTab === 'BREACHED'
                ? 'border-rose-600 text-rose-600 font-bold bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-rose-700'
            }`}
          >
            SLA Breached ({countBreached})
          </button>
        </div>

        {/* Tasks Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <LoadingSpinner size="md" message="Loading assigned tasks..." />
            </div>
          ) : error ? (
            <div className="py-6">
              <ErrorState title="Error fetching tasks" message={error} onRetry={fetchComplaints} />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No tasks found in this section.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-4 py-3">Issue Title</th>
                    <th className="px-4 py-3">Location &amp; Room</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Date</th>
                    <th className="px-4 py-3 text-right">Quick Action</th>
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
                        {c.assignedAt ? new Date(c.assignedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'ASSIGNED' && (
                            <button
                              onClick={() => handleAcknowledge(c._id)}
                              disabled={actionLoadingId === c._id}
                              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 transition disabled:opacity-50"
                            >
                              {actionLoadingId === c._id ? '...' : 'Acknowledge'}
                            </button>
                          )}

                          {c.status === 'ACKNOWLEDGED' && (
                            <button
                              onClick={() => handleStartWork(c._id)}
                              disabled={actionLoadingId === c._id}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              {actionLoadingId === c._id ? '...' : 'Start Work'}
                            </button>
                          )}

                          {c.status === 'REOPENED' && (
                            <button
                              onClick={() => handleResumeWork(c._id)}
                              disabled={actionLoadingId === c._id}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition disabled:opacity-50"
                            >
                              {actionLoadingId === c._id ? '...' : 'Resume Work'}
                            </button>
                          )}

                          <Link
                            to={`/staff/complaints/${c._id}`}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            {c.status === 'IN_PROGRESS' ? 'Resolve / Details →' : 'Details →'}
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
