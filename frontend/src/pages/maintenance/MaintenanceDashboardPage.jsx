import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import maintenancePlanService from '../../services/maintenancePlanService.js';
import assetService from '../../services/assetService.js';
import userService from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

export default function MaintenanceDashboardPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('plans'); // 'plans', 'queue', 'overdue', 'failing'
  const [dashboardStats, setDashboardStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [duePlans, setDuePlans] = useState([]);
  const [overduePlans, setOverduePlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for Plans tab
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assets, setAssets] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    assetId: '',
    maintenanceType: 'PREVENTIVE',
    frequency: 3,
    frequencyUnit: 'MONTHS',
    priority: 'MEDIUM',
    estimatedDuration: 2,
    preferredAssigneeId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, plansRes, upcomingRes, dueRes, overdueRes] = await Promise.all([
        maintenancePlanService.getPreventiveDashboard(),
        maintenancePlanService.getMaintenancePlans({
          search: search || undefined,
          status: statusFilter || undefined,
          maintenanceType: typeFilter || undefined,
        }),
        maintenancePlanService.getUpcomingMaintenance(),
        maintenancePlanService.getDueMaintenance(),
        maintenancePlanService.getOverdueMaintenance(),
      ]);

      if (dashRes.success) setDashboardStats(dashRes.data);
      if (plansRes.success) setPlans(plansRes.data || []);
      if (upcomingRes.success) setUpcoming(upcomingRes.data || []);
      if (dueRes.success) setDuePlans(dueRes.data || []);
      if (overdueRes.success) setOverduePlans(overdueRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, typeFilter]);

  const handleOpenCreateModal = async () => {
    setShowModal(true);
    try {
      const [assetsRes, staffRes] = await Promise.all([
        assetService.getAssets({ limit: 100 }),
        userService.getUsers({ role: 'HOSTEL_STAFF' }),
      ]);
      if (assetsRes.success) setAssets(assetsRes.data || []);
      if (staffRes.success) setStaffList(staffRes.data || []);
    } catch (e) {
      console.error('Error fetching modal options:', e);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...formData,
        frequency: parseInt(formData.frequency, 10),
        estimatedDuration: parseFloat(formData.estimatedDuration) || 2,
        preferredAssigneeId: formData.preferredAssigneeId || undefined,
      };
      const res = await maintenancePlanService.createMaintenancePlan(payload);
      if (res.success) {
        setShowModal(false);
        setFormData({
          name: '',
          description: '',
          assetId: '',
          maintenanceType: 'PREVENTIVE',
          frequency: 3,
          frequencyUnit: 'MONTHS',
          priority: 'MEDIUM',
          estimatedDuration: 2,
          preferredAssigneeId: '',
        });
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to create maintenance plan');
    } finally {
      setCreating(false);
    }
  };

  const isManager = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);

  return (
    <DashboardLayout title="Preventive Maintenance & Scheduling" roleLabel={user?.role}>
      <div className="space-y-6">
        {/* Top Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500 sm:text-sm">
              Schedule recurring inspections and servicing to prevent equipment breakdowns proactively.
            </p>
          </div>
          {isManager && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <span>+</span> New Maintenance Plan
            </button>
          )}
        </div>

        {/* Dashboard KPI Row */}
        {dashboardStats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Active Plans</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboardStats.totalActivePlans}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-blue-700">Upcoming (7d)</p>
              <p className="mt-1 text-xl font-bold text-blue-900">{dashboardStats.upcomingCount}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-amber-700">Due Today</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{dashboardStats.dueTodayCount}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-rose-700">Overdue</p>
              <p className="mt-1 text-xl font-bold text-rose-900">{dashboardStats.overdueCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-emerald-700">Completed (Mo)</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{dashboardStats.completedThisMonth}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Paused Plans</p>
              <p className="mt-1 text-xl font-bold text-slate-700">{dashboardStats.pausedPlans}</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 shadow-xs">
              <p className="text-[10px] font-semibold uppercase text-purple-700">Frequent Failures</p>
              <p className="mt-1 text-xl font-bold text-purple-900">{dashboardStats.frequentlyFailingCount}</p>
            </div>
          </div>
        )}

        {/* View Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('plans')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'plans'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Schedules Catalog ({plans.length})
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'queue'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Due &amp; Upcoming Queue ({upcoming.length + duePlans.length})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'overdue'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overdue Maintenance ({overduePlans.length})
          </button>
          <button
            onClick={() => setActiveTab('failing')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              activeTab === 'failing'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Frequently Failing Equipment ({dashboardStats?.frequentlyFailingCount || 0})
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner size="lg" message="Loading maintenance schedules..." />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : (
          <div>
            {/* Tab 1: Schedules Catalog */}
            {activeTab === 'plans' && (
              <div className="space-y-4">
                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <input
                    type="text"
                    placeholder="Search plan or asset..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                    className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">All Types</option>
                    <option value="PREVENTIVE">PREVENTIVE</option>
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="INSPECTION">INSPECTION</option>
                    <option value="SERVICING">SERVICING</option>
                  </select>
                </div>

                {plans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                    No maintenance plans found matching your criteria.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 uppercase font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Plan ID</th>
                          <th className="px-4 py-3">Plan Name</th>
                          <th className="px-4 py-3">Asset Target</th>
                          <th className="px-4 py-3">Frequency</th>
                          <th className="px-4 py-3">Next Due</th>
                          <th className="px-4 py-3">Cycle</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {plans.map((p) => {
                          const isOverdue = new Date(p.nextDueAt) < new Date() && p.status === 'ACTIVE';
                          return (
                            <tr key={p._id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3 font-bold text-indigo-600">
                                <Link to={`/maintenance/plans/${p._id}`} className="hover:underline">
                                  {p.planId}
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-900">{p.name}</td>
                              <td className="px-4 py-3 text-slate-700">
                                <Link to={`/assets/${p.assetId?._id}`} className="text-indigo-600 hover:underline">
                                  {p.assetId?.name} ({p.assetId?.assetId})
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                Every {p.frequency} {p.frequencyUnit.toLowerCase()}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {new Date(p.nextDueAt).toLocaleDateString()}
                                  {isOverdue && ' (Overdue)'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">Cycle #{p.currentCycleNumber}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.status === 'ACTIVE'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : p.status === 'PAUSED'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link
                                  to={`/maintenance/plans/${p._id}`}
                                  className="font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                  Manage →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Due & Upcoming Queue (Timeline style) */}
            {activeTab === 'queue' && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...duePlans, ...upcoming].length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                    No maintenance schedules are due or upcoming within the next 7 days.
                  </div>
                ) : (
                  [...duePlans, ...upcoming].map((item) => {
                    const isDue = new Date(item.nextDueAt) <= new Date();
                    return (
                      <div
                        key={item._id}
                        className={`rounded-2xl border p-4 shadow-xs ${
                          isDue ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-indigo-600">{item.planId}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isDue ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isDue ? 'DUE TODAY' : 'UPCOMING'}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Target: {item.assetId?.name} ({item.assetId?.assetId})
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                          <span className="text-slate-500">Target Date:</span>
                          <span className="font-bold text-slate-800">
                            {new Date(item.nextDueAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Link
                            to={`/maintenance/plans/${item._id}`}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            View Plan &rarr;
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 3: Overdue Alerts */}
            {activeTab === 'overdue' && (
              <div className="space-y-4">
                {overduePlans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/20 p-12 text-center text-xs text-emerald-700 font-semibold">
                    ✓ All scheduled maintenance tasks are up to date! No overdue items.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {overduePlans.map((item) => (
                      <div key={item._id} className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-rose-700">{item.planId}</span>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            OVERDUE
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-600">
                          Target: {item.assetId?.name} ({item.assetId?.assetId})
                        </p>
                        <div className="mt-3 border-t border-rose-100 pt-3 text-xs flex justify-between">
                          <span className="text-rose-700 font-medium">Was Due:</span>
                          <span className="font-bold text-rose-800">{new Date(item.nextDueAt).toLocaleDateString()}</span>
                        </div>
                        {item.lastWorkOrderId && (
                          <div className="mt-2 text-xs">
                            <span className="text-slate-500">Generated Work Order: </span>
                            <Link
                              to={`/work-orders/${item.lastWorkOrderId._id || item.lastWorkOrderId}`}
                              className="font-bold text-indigo-600 hover:underline"
                            >
                              {item.lastWorkOrderId.workOrderId || 'View Ticket'}
                            </Link>
                          </div>
                        )}
                        <div className="mt-3 flex justify-end">
                          <Link
                            to={`/maintenance/plans/${item._id}`}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                          >
                            Investigate &rarr;
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Frequently Failing Assets */}
            {activeTab === 'failing' && (
              <div className="space-y-4">
                {(!dashboardStats?.frequentlyFailingAssets || dashboardStats.frequentlyFailingAssets.length === 0) ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
                    No equipment currently flagged for frequent breakdown history (&ge; 3 work orders in 90 days).
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 uppercase font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Asset ID</th>
                          <th className="px-4 py-3">Equipment Name</th>
                          <th className="px-4 py-3">Hostel / Location</th>
                          <th className="px-4 py-3">Health Status</th>
                          <th className="px-4 py-3">Total Repairs</th>
                          <th className="px-4 py-3 text-right">Proactive Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dashboardStats.frequentlyFailingAssets.map((ast) => (
                          <tr key={ast._id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-bold text-indigo-600">
                              <Link to={`/assets/${ast._id}`} className="hover:underline">
                                {ast.assetId}
                              </Link>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{ast.name}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {ast.hostelId?.name} {ast.roomId ? `(Room ${ast.roomId.roomNumber})` : ''}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                                FREQUENTLY FAILING
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-rose-700">{ast.totalWorkOrders} orders</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    assetId: ast._id,
                                    name: `Proactive Servicing: ${ast.name}`,
                                  }));
                                  setShowModal(true);
                                }}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                + Setup Plan
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Plan Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Create Preventive Maintenance Plan</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Plan Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quarterly RO Purifier Filter Replacement"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Select Equipment / Asset</label>
                  <select
                    required
                    value={formData.assetId}
                    onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose Asset from Inventory --</option>
                    {assets.map((ast) => (
                      <option key={ast._id} value={ast._id}>
                        {ast.name} ({ast.assetId}) - {ast.assetType}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Maintenance Type</label>
                    <select
                      value={formData.maintenanceType}
                      onChange={(e) => setFormData({ ...formData, maintenanceType: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="PREVENTIVE">PREVENTIVE</option>
                      <option value="ROUTINE">ROUTINE</option>
                      <option value="INSPECTION">INSPECTION</option>
                      <option value="SERVICING">SERVICING</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Frequency Interval</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Unit</label>
                    <select
                      value={formData.frequencyUnit}
                      onChange={(e) => setFormData({ ...formData, frequencyUnit: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="DAYS">DAYS</option>
                      <option value="WEEKS">WEEKS</option>
                      <option value="MONTHS">MONTHS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Preferred Technician Assignee (Optional)
                  </label>
                  <select
                    value={formData.preferredAssigneeId}
                    onChange={(e) => setFormData({ ...formData, preferredAssigneeId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Auto Route to Department Queue --</option>
                    {staffList.map((st) => (
                      <option key={st._id} value={st._id}>
                        {st.name} ({st.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Scope of Work Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Instructions for technicians during this recurring service..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creating ? 'Scheduling...' : 'Activate Schedule'}
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
