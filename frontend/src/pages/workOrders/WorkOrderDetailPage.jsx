import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import workOrderService from '../../services/workOrderService.js';
import userService from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [modalType, setModalType] = useState(null); // 'reassign', 'hold', 'complete', 'cancel'
  const [noteOrReason, setNoteOrReason] = useState('');
  const [targetStaffId, setTargetStaffId] = useState('');
  const [staffList, setStaffList] = useState([]);

  const fetchWorkOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workOrderService.getWorkOrderById(id);
      if (res.success) {
        setWorkOrder(res.data);
      } else {
        setError(res.message || 'Work order not found');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error fetching work order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrder();
  }, [id]);

  useEffect(() => {
    if (modalType === 'reassign') {
      userService.getUsers({ role: 'HOSTEL_STAFF' }).then((res) => {
        if (res.success) setStaffList(res.data || []);
      }).catch(() => {});
    }
  }, [modalType]);

  const handleSimpleAction = async (actionFn, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionLoading(true);
    try {
      const res = await actionFn(workOrder._id);
      if (res.success) {
        fetchWorkOrder();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (modalType === 'reassign') {
        await workOrderService.reassignWorkOrder(workOrder._id, {
          assignedTo: targetStaffId,
          reason: noteOrReason,
        });
      } else if (modalType === 'hold') {
        await workOrderService.holdWorkOrder(workOrder._id, {
          holdReason: noteOrReason,
        });
      } else if (modalType === 'complete') {
        await workOrderService.completeWorkOrder(workOrder._id, {
          completionNote: noteOrReason,
        });
      } else if (modalType === 'cancel') {
        await workOrderService.cancelWorkOrder(workOrder._id, {
          cancellationReason: noteOrReason,
        });
      }
      setModalType(null);
      setNoteOrReason('');
      setTargetStaffId('');
      fetchWorkOrder();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isAssignedToMe = workOrder && String(workOrder.assignedTo?._id) === String(user?._id);
  const isManager = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);
  const isOverdue =
    workOrder?.dueAt &&
    new Date(workOrder.dueAt) < new Date() &&
    !['COMPLETED', 'CANCELLED'].includes(workOrder?.status);

  return (
    <DashboardLayout
      title={workOrder ? `Work Order: ${workOrder.workOrderId}` : 'Work Order Details'}
      roleLabel={user?.role}
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading work order details..." />
        </div>
      ) : error || !workOrder ? (
        <ErrorState message={error || 'Work order not found'} onRetry={fetchWorkOrder} />
      ) : (
        <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/work-orders" className="hover:text-indigo-600">Work Orders</Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">{workOrder.workOrderId}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {workOrder.workOrderId}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                workOrder.status === 'COMPLETED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : workOrder.status === 'IN_PROGRESS'
                  ? 'bg-amber-100 text-amber-800'
                  : workOrder.status === 'ACCEPTED'
                  ? 'bg-cyan-100 text-cyan-800'
                  : workOrder.status === 'ASSIGNED'
                  ? 'bg-indigo-100 text-indigo-800'
                  : workOrder.status === 'ON_HOLD'
                  ? 'bg-orange-100 text-orange-800'
                  : workOrder.status === 'CANCELLED'
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {workOrder.status.replace(/_/g, ' ')}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                workOrder.priority === 'CRITICAL'
                  ? 'bg-rose-100 text-rose-800'
                  : workOrder.priority === 'HIGH'
                  ? 'bg-amber-100 text-amber-800'
                  : workOrder.priority === 'MEDIUM'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {workOrder.priority}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {workOrder.status === 'ASSIGNED' && (isAssignedToMe || isManager) && (
            <button
              onClick={() => handleSimpleAction(workOrderService.acceptWorkOrder)}
              disabled={actionLoading}
              className="rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-cyan-700 disabled:opacity-50"
            >
              Accept Work
            </button>
          )}

          {(workOrder.status === 'ACCEPTED' || workOrder.status === 'ASSIGNED') && (isAssignedToMe || isManager) && (
            <button
              onClick={() => handleSimpleAction(workOrderService.startWorkOrder)}
              disabled={actionLoading}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              Start Work
            </button>
          )}

          {workOrder.status === 'IN_PROGRESS' && (isAssignedToMe || isManager) && (
            <>
              <button
                onClick={() => setModalType('hold')}
                disabled={actionLoading}
                className="rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50"
              >
                Put On Hold
              </button>
              <button
                onClick={() => setModalType('complete')}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                Complete Work
              </button>
            </>
          )}

          {workOrder.status === 'ON_HOLD' && (isAssignedToMe || isManager) && (
            <button
              onClick={() => handleSimpleAction(workOrderService.resumeWorkOrder)}
              disabled={actionLoading}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              Resume Work
            </button>
          )}

          {isManager && !['COMPLETED', 'CANCELLED'].includes(workOrder.status) && (
            <>
              <button
                onClick={() => setModalType('reassign')}
                disabled={actionLoading}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reassign
              </button>
              <button
                onClick={() => setModalType('cancel')}
                disabled={actionLoading}
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                Cancel Work Order
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Details & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Audit Trail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work Order Info Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{workOrder.title}</h2>
              <p className="mt-2 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {workOrder.description}
              </p>
            </div>

            {workOrder.completionNote && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-xs font-bold text-emerald-800">Completion Report</p>
                <p className="mt-1 text-xs text-emerald-900 whitespace-pre-line">
                  {workOrder.completionNote}
                </p>
              </div>
            )}

            {workOrder.holdReason && workOrder.status === 'ON_HOLD' && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                <p className="text-xs font-bold text-orange-800">Reason Placed On Hold</p>
                <p className="mt-1 text-xs text-orange-900">{workOrder.holdReason}</p>
              </div>
            )}

            {workOrder.cancellationReason && workOrder.status === 'CANCELLED' && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
                <p className="text-xs font-bold text-rose-800">Cancellation Reason</p>
                <p className="mt-1 text-xs text-rose-900">{workOrder.cancellationReason}</p>
              </div>
            )}
          </div>

          {/* Chronological Audit Log Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Work Order Event History</h3>
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {workOrder.auditLog?.map((entry, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-600 ring-2 ring-indigo-200" />
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold text-slate-800">{entry.action.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{entry.note}</p>
                  {entry.performedBy && (
                    <p className="text-[10px] text-slate-400">
                      By: {entry.performedBy.name} ({entry.performedBy.role})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Meta & Associations */}
        <div className="space-y-6">
          {/* Linked Entity References */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Associations & Context
            </h3>

            {/* Linked Complaint */}
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[11px] text-slate-400">Originating Complaint</span>
              {workOrder.complaintId ? (
                <p className="mt-1">
                  <Link
                    to={`/warden/complaints/${workOrder.complaintId._id}`}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    {workOrder.complaintId.complaintId} — {workOrder.complaintId.title}
                  </Link>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 italic">Standalone Maintenance Job</p>
              )}
            </div>

            {/* Linked Asset */}
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[11px] text-slate-400">Referenced Asset</span>
              {workOrder.assetId ? (
                <p className="mt-1">
                  <Link
                    to={`/assets/${workOrder.assetId._id}`}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    {workOrder.assetId.assetId} — {workOrder.assetId.name}
                  </Link>
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 italic">No specific asset tagged</p>
              )}
            </div>

            {/* Assigned Staff */}
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[11px] text-slate-400">Assigned Technician</span>
              {workOrder.assignedTo ? (
                <div className="mt-1 text-xs">
                  <p className="font-bold text-slate-800">{workOrder.assignedTo.name}</p>
                  <p className="text-[11px] text-slate-500">{workOrder.assignedTo.email}</p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400 italic">Currently Unassigned</p>
              )}
            </div>

            {/* Location */}
            <div className="border-b border-slate-100 pb-3 text-xs space-y-1">
              <span className="text-[11px] text-slate-400">Location</span>
              <p className="font-semibold text-slate-800">{workOrder.hostelId?.name}</p>
              <p className="text-slate-500">
                Department: {workOrder.departmentId?.name} ({workOrder.departmentId?.code})
              </p>
              {workOrder.roomId && (
                <p className="text-slate-500">Room: {workOrder.roomId.roomNumber}</p>
              )}
            </div>

            {/* SLA Due */}
            <div className="text-xs space-y-1">
              <span className="text-[11px] text-slate-400">SLA Resolution Target</span>
              {workOrder.dueAt ? (
                <p className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                  {new Date(workOrder.dueAt).toLocaleString()}
                  {isOverdue && ' (Breached ⚠️)'}
                </p>
              ) : (
                <p className="text-slate-500">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Modal (Hold, Complete, Reassign, Cancel) */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">
              {modalType === 'reassign' && 'Reassign Work Order'}
              {modalType === 'hold' && 'Place Work Order On Hold'}
              {modalType === 'complete' && 'Mark Work Order Completed'}
              {modalType === 'cancel' && 'Cancel Work Order'}
            </h2>

            <form onSubmit={handleModalSubmit} className="mt-4 space-y-4">
              {modalType === 'reassign' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Assign To Staff</label>
                  <select
                    required
                    value={targetStaffId}
                    onChange={(e) => setTargetStaffId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Staff Member</option>
                    {staffList.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {modalType === 'complete' ? 'Completion Note / Work Summary' : 'Reason / Note'}
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Minimum 5 characters..."
                  value={noteOrReason}
                  onChange={(e) => setNoteOrReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setModalType(null); setNoteOrReason(''); }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || noteOrReason.trim().length < 5}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
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
