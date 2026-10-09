import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import DataTable from '../../components/common/DataTable.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import FilterSelect from '../../components/common/FilterSelect.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';
import { COMPLAINT_STATUS_LABELS, COMPLAINT_STATUS_FILTER_OPTIONS } from '../../utils/statusLabels.js';

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await complaintService.getMyComplaints();
      if (res.success) {
        setComplaints(res.data);
      } else {
        setError(res.message || 'We could not load your reports. Please try again.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Something went wrong loading your reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.complaintId.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q));

      const matchesStatus = !statusFilter || c.status === statusFilter;
      const matchesCategory = !categoryFilter || c.category === categoryFilter;
      const matchesPriority = !priorityFilter || c.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [complaints, search, statusFilter, categoryFilter, priorityFilter]);

  const getPriorityBadge = (p) => {
    const map = {
      LOW: 'bg-blue-100 text-blue-700',
      MEDIUM: 'bg-emerald-100 text-emerald-700',
      HIGH: 'bg-amber-100 text-amber-700',
      CRITICAL: 'bg-rose-100 text-rose-700 font-bold',
    };
    const shortLabel = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${map[p] || 'bg-slate-100 text-slate-700'}`}>
        {shortLabel[p] ?? p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const colorMap = {
      SUBMITTED:              'bg-indigo-50 text-indigo-700 border-indigo-200',
      TRIAGED:                'bg-cyan-50 text-cyan-700 border-cyan-200',
      ASSIGNED:               'bg-blue-50 text-blue-700 border-blue-200',
      ACKNOWLEDGED:           'bg-sky-50 text-sky-700 border-sky-200',
      IN_PROGRESS:            'bg-amber-50 text-amber-700 border-amber-200',
      WAITING_FOR_INFORMATION:'bg-orange-50 text-orange-700 border-orange-200',
      RESOLVED:               'bg-emerald-50 text-emerald-700 border-emerald-200',
      STUDENT_VERIFICATION:   'bg-purple-50 text-purple-700 border-purple-200',
      CLOSED:                 'bg-slate-100 text-slate-700 border-slate-200',
      REOPENED:               'bg-rose-50 text-rose-700 border-rose-200',
      ESCALATED:              'bg-red-100 text-red-800 border-red-300 font-bold',
      REJECTED:               'bg-gray-100 text-gray-600 border-gray-200',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${colorMap[s] || 'bg-slate-50 text-slate-700'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {COMPLAINT_STATUS_LABELS[s] ?? s.replace(/_/g, ' ')}
      </span>
    );
  };

  const columns = [
    {
      header: 'Reference No.',
      accessor: 'complaintId',
      render: (row) => (
        <div>
          <Link
            to={`/student/complaints/${row.complaintId || row._id}`}
            className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            {row.complaintId}
          </Link>
          <span className="block text-[10px] text-slate-400">
            {new Date(row.createdAt || row.submittedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      ),
    },
    {
      header: 'Issue',
      accessor: 'title',
      render: (row) => (
        <div className="max-w-xs sm:max-w-md">
          <Link
            to={`/student/complaints/${row.complaintId || row._id}`}
            className="font-semibold text-slate-900 hover:text-indigo-600 transition block truncate"
          >
            {row.title}
          </Link>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
            <span className="uppercase font-medium text-slate-600">{row.category}</span>
            <span>&bull;</span>
            <span className="text-slate-400">{row.issueType ? row.issueType.replace(/_/g, ' ') : ''}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Urgency',
      accessor: 'priority',
      render: (row) => getPriorityBadge(row.priority),
    },
    {
      header: 'Current Status',
      accessor: 'status',
      render: (row) => (
        <div className="space-y-1">
          <div>{getStatusBadge(row.status)}</div>
          <SlaBadge
            slaStatus={row.slaStatus}
            slaDueAt={row.slaDueAt}
            slaStartedAt={row.slaStartedAt}
            reminderSentAt={row.reminderSentAt}
            complaintStatus={row.status}
            escalationLevel={row.currentEscalationLevel}
          />
        </div>
      ),
    },
    {
      header: 'Location',
      render: (row) => (
        <div className="text-xs text-slate-600">
          <span>{row.hostelId?.name || 'Hostel'}</span>
          <span className="block text-[11px] font-mono text-slate-400">
            Room {row.roomId?.roomNumber || '-'}
          </span>
        </div>
      ),
    },
    {
      header: '',
      render: (row) => (
        <Link
          to={`/student/complaints/${row.complaintId || row._id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          View details &rarr;
        </Link>
      ),
    },
  ];

  if (loading) {
    return (
      <DashboardLayout title="My Reported Issues" roleLabel="Student">
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading your reported issues…" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="My Reported Issues" roleLabel="Student">
        <ErrorState title="Could not load your issues" message={error} onRetry={fetchComplaints} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Reported Issues" roleLabel="Student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Issues you have reported</h2>
            <p className="text-xs text-slate-500">
              See the current status of every issue you have sent from your room.
            </p>
          </div>
          <Link
            to="/student/complaints/new"
            id="report-new-issue-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report a new issue
          </Link>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by reference number or title…"
            />
          </div>
          <div className="w-48">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All statuses"
              options={COMPLAINT_STATUS_FILTER_OPTIONS}
            />
          </div>
          <div className="w-36">
            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="All areas"
              options={[
                { value: 'ELECTRICAL', label: 'Electrical' },
                { value: 'PLUMBING',   label: 'Plumbing' },
                { value: 'CLEANING',   label: 'Cleaning' },
                { value: 'WATER',      label: 'Water' },
                { value: 'INTERNET',   label: 'Internet' },
                { value: 'FURNITURE',  label: 'Furniture' },
                { value: 'SECURITY',   label: 'Security' },
                { value: 'ROOM',       label: 'Room' },
                { value: 'MESS',       label: 'Mess' },
                { value: 'OTHER',      label: 'Other' },
              ]}
            />
          </div>
          <div className="w-32">
            <FilterSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              placeholder="All urgency"
              options={[
                { value: 'LOW',      label: 'Low' },
                { value: 'MEDIUM',   label: 'Medium' },
                { value: 'HIGH',     label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
          </div>
        </div>

        {/* Table */}
        {complaints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">No issues reported yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              If something is broken or not working in your room — electricity, water, furniture, internet — tap the button below to tell us.
            </p>
            <div className="mt-6">
              <Link
                to="/student/complaints/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
              >
                + Report an issue
              </Link>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredComplaints}
            emptyMessage="No issues match your search or filters. Try clearing a filter."
          />
        )}
      </div>
    </DashboardLayout>
  );
}
