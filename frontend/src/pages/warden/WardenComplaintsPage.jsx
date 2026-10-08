import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardCard from '../../components/common/DashboardCard.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';

export default function WardenComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (slaFilter === 'ACTIVE') params.slaStatus = 'ACTIVE';
      if (slaFilter === 'BREACHED') params.slaStatus = 'BREACHED';
      if (slaFilter === 'DUE_SOON') params.dueSoon = 'true';
      if (slaFilter === 'ESCALATED') params.escalated = 'true';

      const res = await complaintService.listComplaints(params);
      if (res.success && res.data) {
        setComplaints(res.data);
      } else {
        setError(res.message || 'Failed to load complaints');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, priorityFilter, categoryFilter, slaFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchComplaints();
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
      SUBMITTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      TRIAGED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
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

  const countTotal = complaints.length;
  const countPendingTriage = complaints.filter((c) => c.status === 'SUBMITTED').length;
  const countAssigned = complaints.filter((c) => ['TRIAGED', 'ASSIGNED', 'ACKNOWLEDGED'].includes(c.status)).length;
  const countInProgress = complaints.filter((c) => c.status === 'IN_PROGRESS').length;

  return (
    <DashboardLayout title="Hostel Complaints Management" roleLabel="Warden">
      <div className="space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DashboardCard
            title="Total Complaints"
            value={countTotal}
            subtitle="Registered in this hostel"
            color="indigo"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <DashboardCard
            title="Pending Triage"
            value={countPendingTriage}
            subtitle="Awaiting classification"
            color="rose"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <DashboardCard
            title="Assigned / Ready"
            value={countAssigned}
            subtitle="Under staff routing"
            color="amber"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          <DashboardCard
            title="In Progress"
            value={countInProgress}
            subtitle="Active technician resolution"
            color="emerald"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </div>

        {/* Filters and Search Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket ID or issue title..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="TRIAGED">TRIAGED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="STUDENT_VERIFICATION">STUDENT_VERIFICATION</option>
                <option value="REOPENED">REOPENED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <select
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none font-medium text-slate-700"
              >
                <option value="">All SLA States</option>
                <option value="ACTIVE">SLA Active</option>
                <option value="DUE_SOON">Due Soon (&lt; 4h)</option>
                <option value="BREACHED">SLA Breached</option>
                <option value="ESCALATED">Escalated</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
              >
                Filter
              </button>
              {(search || statusFilter || priorityFilter || categoryFilter || slaFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                    setPriorityFilter('');
                    setCategoryFilter('');
                    setSlaFilter('');
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Complaints Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hostel Complaints Roster</h2>
              <p className="text-xs text-slate-500">Real-time status of student tickets assigned to this residence</p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {complaints.length} complaint{complaints.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <LoadingSpinner size="md" message="Loading complaints..." />
            </div>
          ) : error ? (
            <div className="py-6">
              <ErrorState title="Error fetching complaints" message={error} onRetry={fetchComplaints} />
            </div>
          ) : complaints.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No complaints found matching the criteria.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-4 py-3">Title &amp; Issue</th>
                    <th className="px-4 py-3">Student &amp; Room</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Assigned Staff</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">
                        {c.complaintId}
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-500">{c.category?.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">{c.studentId?.name || 'Student'}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {c.blockId?.name || ''} Room {c.roomId?.roomNumber || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {getPriorityBadge(c.priority)}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.assignedTo ? (
                          <div>
                            <span className="font-medium text-slate-800">{c.assignedTo.name}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">{c.assignedTo.employeeId || 'Staff'}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 italic text-[11px]">Unassigned</span>
                        )}
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
                        {new Date(c.submittedAt || c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Link
                          to={`/warden/complaints/${c._id}`}
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                        >
                          Manage &rarr;
                        </Link>
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
