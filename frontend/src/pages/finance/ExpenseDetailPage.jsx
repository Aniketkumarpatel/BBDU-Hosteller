import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import financeService from '../../services/financeService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';

export default function ExpenseDetailPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [expense, setExpense] = useState(null);
  const [traceability, setTraceability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const canApprove = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);
  const isCreator = expense?.createdBy?._id === user?._id;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, traceRes] = await Promise.all([
        financeService.getExpenseById(id),
        financeService.getOperationalTraceability(id).catch(() => ({ success: false })),
      ]);

      if (expRes.success) {
        setExpense(expRes.data);
      } else {
        setError(expRes.message || 'Expense not found');
      }

      if (traceRes.success) {
        setTraceability(traceRes.data?.traceability);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading expense details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      const res = await financeService.submitExpense(id);
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to submit expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async () => {
    setActionLoading(true);
    try {
      const res = await financeService.reviewExpense(id);
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to mark under review');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    // Check self-approval guard
    if (isCreator && user?.role !== 'SUPER_ADMIN') {
      alert('Self-approval guard: You cannot approve your own expense request.');
      return;
    }
    if (!window.confirm(`Approve expense "${expense.title}" for ₹${expense.amount}?`)) return;

    setActionLoading(true);
    try {
      const res = await financeService.approveExpense(id);
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await financeService.rejectExpense(id, { reason: rejectReason });
      if (res.success) {
        setShowRejectModal(false);
        setRejectReason('');
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Specify cancellation reason:');
    if (!reason) return;
    setActionLoading(true);
    try {
      const res = await financeService.cancelExpense(id, { reason });
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Cancellation failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout
      title={expense ? `Expense: ${expense.expenseId}` : 'Expense Details'}
      roleLabel={user?.role}
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading expense and operational audit trail..." />
        </div>
      ) : error || !expense ? (
        <ErrorState message={error || 'Expense record not found'} onRetry={fetchData} />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link to="/finance" className="hover:text-indigo-600">Finance &amp; Expenses</Link>
                <span>/</span>
                <span className="font-semibold text-slate-700">{expense.expenseId}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{expense.title}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    expense.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : expense.status === 'UNDER_REVIEW'
                      ? 'bg-amber-100 text-amber-800'
                      : expense.status === 'SUBMITTED'
                      ? 'bg-blue-100 text-blue-800'
                      : expense.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {expense.status}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {expense.category}
                </span>
              </div>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {['DRAFT', 'REJECTED'].includes(expense.status) && (
                <button
                  disabled={actionLoading}
                  onClick={handleSubmit}
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  Submit for Approval
                </button>
              )}

              {canApprove && expense.status === 'SUBMITTED' && (
                <button
                  disabled={actionLoading}
                  onClick={handleReview}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Mark Under Review
                </button>
              )}

              {canApprove && ['SUBMITTED', 'UNDER_REVIEW'].includes(expense.status) && (
                <>
                  <button
                    disabled={actionLoading}
                    onClick={handleApprove}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve Expense
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => setShowRejectModal(true)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}

              {['DRAFT', 'SUBMITTED'].includes(expense.status) && (
                <button
                  disabled={actionLoading}
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}

              <Link
                to="/finance"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Back
              </Link>
            </div>
          </div>

          {/* Cards Grid: Details, Financials, Approval Status */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 1. Expenditure Overview */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Expenditure Summary</span>
              <div className="text-3xl font-extrabold text-slate-900">{formatCurrency(expense.amount)}</div>
              <div className="text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Financial Year:</span>
                  <span className="font-semibold text-slate-800">{expense.financialYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hostel:</span>
                  <span className="font-semibold text-slate-800">{expense.hostelId?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expense Date:</span>
                  <span className="text-slate-800">{formatDate(expense.expenseDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Invoice Number:</span>
                  <span className="font-mono text-slate-800">{expense.invoiceNumber || 'N/A'}</span>
                </div>
              </div>
              {expense.description && (
                <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
                  <span className="font-semibold text-slate-900">Justification: </span>
                  {expense.description}
                </div>
              )}
            </div>

            {/* 2. Personnel & Approval Context */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Approval Context</span>
              <div className="text-xs space-y-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block">Created / Requested By:</span>
                  <span className="font-semibold text-slate-800">{expense.createdBy?.name}</span>
                  <span className="text-[11px] text-slate-400 block">{expense.createdBy?.email} ({expense.createdBy?.role})</span>
                </div>
                {expense.approvedBy && (
                  <div className="border-t border-slate-100 pt-2">
                    <span className="text-slate-400 block">Approved By:</span>
                    <span className="font-semibold text-emerald-800">{expense.approvedBy?.name}</span>
                    <span className="text-[11px] text-slate-400 block">{formatDate(expense.approvedAt)}</span>
                  </div>
                )}
                {expense.rejectionReason && (
                  <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">
                    <span className="font-bold">Rejection Reason: </span>
                    {expense.rejectionReason}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Operational Traceability Chain */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Operational Traceability</span>
              <div className="text-xs space-y-2 text-slate-700">
                {/* Linked Asset */}
                {expense.assetId ? (
                  <div className="rounded-lg bg-indigo-50/70 p-2 border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 block">Linked Asset</span>
                    <Link to={`/assets/${expense.assetId._id}`} className="font-bold text-indigo-900 hover:underline">
                      {expense.assetId.name} ({expense.assetId.assetCode || expense.assetId.assetId})
                    </Link>
                    <div className="text-[11px] text-indigo-800">
                      Condition: {expense.assetId.condition} • Total Maint Spend: {formatCurrency(expense.assetId.totalMaintenanceCost)}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No asset directly linked.</div>
                )}

                {/* Linked Work Order */}
                {expense.workOrderId ? (
                  <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Linked Work Order</span>
                    <Link to={`/work-orders/${expense.workOrderId._id}`} className="font-bold text-slate-800 hover:underline">
                      {expense.workOrderId.workOrderId}: {expense.workOrderId.title}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      Priority: {expense.workOrderId.priority} • Status: {expense.workOrderId.status}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic">No work order directly linked.</div>
                )}

                {/* Linked Vendor */}
                {expense.vendorId && (
                  <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Vendor</span>
                    <span className="font-bold text-slate-800">{expense.vendorId.name}</span>
                    <div className="text-[11px] text-slate-500">
                      Category: {expense.vendorId.serviceCategory} • Ph: {expense.vendorId.phone || 'N/A'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chronological Audit Trail */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Audit Trail &amp; Workflow Transition Logs
            </h2>
            <div className="space-y-2">
              {[...(expense.auditTrail || [])].reverse().map((log, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="text-indigo-700 font-bold">{log.action}</span>
                    <span className="text-[11px] text-slate-400 font-normal">{formatDate(log.timestamp)}</span>
                  </div>
                  {log.previousStatus && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Transition: <span className="font-mono">{log.previousStatus}</span> → <span className="font-mono font-bold">{log.newStatus}</span>
                    </div>
                  )}
                  {log.notes && <p className="mt-1 text-[11px] text-slate-600 italic">"{log.notes}"</p>}
                  <p className="mt-1 text-[10px] text-slate-400">
                    Performed by: {log.performedBy?.name || 'Authorized Staff'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* REJECT MODAL */}
          {showRejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Reject Expense</h2>
                  <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleReject} className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700">Rejection Reason *</label>
                    <textarea
                      required
                      rows="3"
                      placeholder="Specify justification for rejection..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
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
