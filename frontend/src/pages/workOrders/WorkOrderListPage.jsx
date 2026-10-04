import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import workOrderService from '../../services/workOrderService.js';
import hostelService from '../../services/hostelService.js';
import departmentService from '../../services/departmentService.js';
import userService from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';

export default function WorkOrderListPage() {
  const { user } = useAuth();

  const [workOrders, setWorkOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [eligibleStaff, setEligibleStaff] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    hostelId: user?.hostelId?._id || user?.hostelId || '',
    departmentId: '',
    assignedTo: '',
  });

  const fetchWorkOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (search) params.search = search;
      if (overdueOnly) params.overdue = 'true';

      const [woRes, statsRes] = await Promise.all([
        workOrderService.getWorkOrders(params),
        workOrderService.getWorkOrderStats(),
      ]);

      if (woRes.success) setWorkOrders(woRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [status, priority, overdueOnly]);

  // Load hostels, depts, and staff when modal opens
  useEffect(() => {
    if (showCreateModal) {
      hostelService.getHostels().then((res) => {
        if (res.success) setHostels(res.data);
      }).catch(() => {});

      departmentService.getDepartments().then((res) => {
        if (res.success) setDepartments(res.data);
      }).catch(() => {});

      userService.getUsers({ role: 'HOSTEL_STAFF' }).then((res) => {
        if (res.success) setEligibleStaff(res.data || []);
      }).catch(() => {});
    }
  }, [showCreateModal]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = { ...formData };
      if (!payload.assignedTo) delete payload.assignedTo;

      const res = await workOrderService.createWorkOrder(payload);
      if (res.success) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          priority: 'MEDIUM',
          hostelId: user?.hostelId?._id || user?.hostelId || '',
          departmentId: '',
          assignedTo: '',
        });
        fetchWorkOrders();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Error creating work order');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout title="Maintenance Work Orders" roleLabel={user?.role}>
      <div className="space-y-6">
        {/* Top Actions Row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 sm:text-sm">
              Track operational maintenance jobs, assign technician queues, and verify completion.
            </p>
          </div>

        <div className="flex items-center gap-2">
          {user?.role !== 'STUDENT' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <span>+</span> Create Work Order
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Total</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-blue-700">Assigned</p>
            <p className="mt-1 text-xl font-bold text-blue-900">{stats.assigned}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-amber-700">In Progress</p>
            <p className="mt-1 text-xl font-bold text-amber-900">{stats.inProgress}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-orange-700">On Hold</p>
            <p className="mt-1 text-xl font-bold text-orange-900">{stats.onHold}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-emerald-700">Completed</p>
            <p className="mt-1 text-xl font-bold text-emerald-900">{stats.completed}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-rose-700">Overdue</p>
            <p className="mt-1 text-xl font-bold text-rose-900">{stats.overdue}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-purple-700">Avg Time</p>
            <p className="mt-1 text-xl font-bold text-purple-900">{stats.avgCompletionHours}h</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search by ID or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchWorkOrders()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none w-48 sm:w-64"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="CREATED">Created</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            Overdue Only
          </label>
        </div>

        <button
          onClick={fetchWorkOrders}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Apply Filters
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" message="Loading work orders..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchWorkOrders} />
      ) : workOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-sm font-semibold text-slate-700">No maintenance work orders found</p>
          <p className="mt-1 text-xs text-slate-500">Create a work order or adjust your filter selection.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Work Order ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Hostel / Dept</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SLA Due</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workOrders.map((wo) => {
                  const isOverdue =
                    wo.dueAt &&
                    new Date(wo.dueAt) < new Date() &&
                    !['COMPLETED', 'CANCELLED'].includes(wo.status);

                  return (
                    <tr key={wo._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-bold text-indigo-600">
                        <Link to={`/work-orders/${wo._id}`} className="hover:underline">
                          {wo.workOrderId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate font-medium text-slate-800">
                        {wo.title}
                        {wo.complaintId && (
                          <span className="ml-2 text-[10px] text-slate-400">
                            (Ref: {wo.complaintId.complaintId})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {wo.hostelId?.name || 'Campus'} • {wo.departmentId?.name || 'Maintenance'}
                      </td>
                      <td className="px-4 py-3">
                        {wo.assignedTo ? (
                          <span className="font-semibold text-slate-700">{wo.assignedTo.name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            wo.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : wo.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : wo.priority === 'MEDIUM'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {wo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            wo.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : wo.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : wo.status === 'ACCEPTED'
                              ? 'bg-cyan-100 text-cyan-800'
                              : wo.status === 'ASSIGNED'
                              ? 'bg-indigo-100 text-indigo-800'
                              : wo.status === 'ON_HOLD'
                              ? 'bg-orange-100 text-orange-800'
                              : wo.status === 'CANCELLED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {wo.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {wo.dueAt ? (
                          <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                            {new Date(wo.dueAt).toLocaleDateString()} {new Date(wo.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isOverdue && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/work-orders/${wo._id}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">Create Maintenance Work Order</h2>
            <p className="mt-1 text-xs text-slate-500">Initiate an operational repair or maintenance task.</p>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Repair water leakage in washroom 204"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detailed work instructions or part requirements..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Hostel</label>
                  <select
                    required
                    value={formData.hostelId}
                    onChange={(e) => setFormData({ ...formData, hostelId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Hostel</option>
                    {hostels.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Department</label>
                  <select
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Assign To Staff (Optional)</label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Leave Unassigned</option>
                    {eligibleStaff.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Submit Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
