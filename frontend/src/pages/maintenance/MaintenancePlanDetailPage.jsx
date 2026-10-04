import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import maintenancePlanService from '../../services/maintenancePlanService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';

export default function MaintenancePlanDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit / Action modal state
  const [modalType, setModalType] = useState(null); // 'pause', 'deactivate'
  const [actionReason, setActionReason] = useState('');

  const fetchPlanDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await maintenancePlanService.getMaintenancePlanById(id);
      if (res.success) {
        setData(res.data ? res : { plan: res.data, cycles: res.cycles });
      } else {
        setError(res.message || 'Maintenance plan not found');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading plan details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanDetails();
  }, [id]);

  const handlePause = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await maintenancePlanService.pauseMaintenancePlan(id, actionReason);
      if (res.success) {
        setModalType(null);
        setActionReason('');
        fetchPlanDetails();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to pause plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await maintenancePlanService.resumeMaintenancePlan(id);
      if (res.success) {
        fetchPlanDetails();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to resume plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await maintenancePlanService.deactivateMaintenancePlan(id, actionReason);
      if (res.success) {
        setModalType(null);
        setActionReason('');
        fetchPlanDetails();
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to deactivate plan');
    } finally {
      setActionLoading(false);
    }
  };

  const plan = data?.plan;
  const cycles = data?.cycles || [];
  const isManager = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);

  return (
    <DashboardLayout
      title={plan ? `Maintenance Plan: ${plan.planId}` : 'Maintenance Plan Details'}
      roleLabel={user?.role}
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading maintenance plan details..." />
        </div>
      ) : error || !plan ? (
        <ErrorState message={error || 'Maintenance plan not found'} onRetry={fetchPlanDetails} />
      ) : (
        <div className="space-y-6">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link to="/maintenance" className="hover:text-indigo-600">Maintenance Dashboard</Link>
                <span>/</span>
                <span className="font-semibold text-slate-700">{plan.planId}</span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{plan.name}</h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    plan.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : plan.status === 'PAUSED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {plan.status}
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {plan.maintenanceType}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {isManager && (
              <div className="flex items-center gap-2">
                {plan.status === 'ACTIVE' && (
                  <button
                    onClick={() => setModalType('pause')}
                    disabled={actionLoading}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Pause Schedule
                  </button>
                )}
                {plan.status === 'PAUSED' && (
                  <button
                    onClick={handleResume}
                    disabled={actionLoading}
                    className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Resume Schedule
                  </button>
                )}
                {plan.status !== 'CANCELLED' && (
                  <button
                    onClick={() => setModalType('deactivate')}
                    disabled={actionLoading}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                  >
                    Deactivate Plan
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Details Overview Card */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2 space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Plan Specifications</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Target Asset / Equipment</span>
                  <p className="mt-0.5 font-bold text-indigo-600">
                    <Link to={`/assets/${plan.assetId?._id}`} className="hover:underline">
                      {plan.assetId?.name} ({plan.assetId?.assetId})
                    </Link>
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Recurrence Frequency</span>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    Every {plan.frequency} {plan.frequencyUnit.toLowerCase()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Assigned Department</span>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {plan.assignedDepartmentId?.name} ({plan.assignedDepartmentId?.code})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Assigned Hostel</span>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {plan.hostelId?.name} ({plan.hostelId?.code})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Preferred Technician</span>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {plan.preferredAssigneeId?.name || 'Auto-routed to Department Queue'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Priority Level</span>
                  <p className="mt-0.5 font-bold text-slate-800">{plan.priority}</p>
                </div>
              </div>

              {plan.description && (
                <div className="border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">Maintenance Scope &amp; Instructions</span>
                  <p className="mt-1 text-slate-700 whitespace-pre-wrap">{plan.description}</p>
                </div>
              )}
            </div>

            {/* Next Due & Metrics Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900">Schedule Status</h2>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-center">
                <span className="text-[11px] font-semibold uppercase text-indigo-600">Next Scheduled Service Due</span>
                <p className="mt-1 text-lg font-bold text-indigo-950">
                  {new Date(plan.nextDueAt).toLocaleDateString()}
                </p>
                <span className="text-[11px] text-indigo-600">
                  Cycle #{plan.currentCycleNumber}
                </span>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Completed Service:</span>
                  <span className="font-semibold text-slate-800">
                    {plan.lastCompletedAt ? new Date(plan.lastCompletedAt).toLocaleDateString() : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Cycles Logged:</span>
                  <span className="font-semibold text-slate-800">{cycles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Duration:</span>
                  <span className="font-semibold text-slate-800">{plan.estimatedDuration} hrs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Cycles Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-sm font-bold text-slate-900">Maintenance Cycles Timeline &amp; History</h2>
              <p className="text-xs text-slate-500">
                Track each recurring cycle, generated operational work orders, and completion evidence.
              </p>
            </div>

            {cycles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No maintenance cycles have been tracked yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Cycle #</th>
                    <th className="px-4 py-3">Scheduled Date</th>
                    <th className="px-4 py-3">Due Target</th>
                    <th className="px-4 py-3">Generated Work Order</th>
                    <th className="px-4 py-3">Technician</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Completed Date</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycles.map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">#{c.cycleNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(c.scheduledDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {new Date(c.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-600">
                        {c.workOrderId ? (
                          <Link to={`/work-orders/${c.workOrderId._id || c.workOrderId}`} className="hover:underline">
                            {c.workOrderId.workOrderId || 'View Work Order'}
                          </Link>
                        ) : (
                          <span className="text-slate-400 font-normal">Pending Trigger</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.assignedStaffId?.name || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            c.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'OVERDUE'
                              ? 'bg-rose-100 text-rose-800'
                              : c.status === 'WORK_ORDER_CREATED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-500">
                        {c.completionNotes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Modals (Pause / Deactivate) */}
          {modalType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-base font-bold text-slate-900">
                  {modalType === 'pause' ? 'Pause Maintenance Schedule' : 'Deactivate Maintenance Plan'}
                </h2>
                <form
                  onSubmit={modalType === 'pause' ? handlePause : handleDeactivate}
                  className="mt-4 space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Reason / Justification</label>
                    <textarea
                      required
                      rows="3"
                      placeholder="Explain why this maintenance schedule is being modified..."
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalType(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || actionReason.trim().length < 3}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                        modalType === 'pause'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {actionLoading ? 'Processing...' : 'Confirm'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
