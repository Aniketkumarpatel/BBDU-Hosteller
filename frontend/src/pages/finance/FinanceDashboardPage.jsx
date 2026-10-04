import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import financeService from '../../services/financeService.js';
import assetService from '../../services/assetService.js';
import workOrderService from '../../services/workOrderService.js';
import analyticsService from '../../services/analyticsService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';

export default function FinanceDashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'HOSTEL_STAFF';
  const isWarden = user?.role === 'WARDEN';
  const isAdmin = ['SUPER_ADMIN', 'AUTHORITY'].includes(user?.role);
  const canManageBudgets = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);
  const canApprove = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFY, setSelectedFY] = useState('2026-27');
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'budgets', 'approvals', 'vendors', 'financialYears'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for expenses
  const [expCategory, setExpCategory] = useState('');
  const [expStatus, setExpStatus] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showFYModal, setShowFYModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Dropdown reference data
  const [hostels, setHostels] = useState([]);
  const [assetsList, setAssetsList] = useState([]);
  const [workOrdersList, setWorkOrdersList] = useState([]);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    hostelId: user?.hostelId?._id || user?.hostelId || '',
    financialYear: '2026-27',
    category: 'MAINTENANCE',
    title: '',
    description: '',
    amount: '',
    invoiceNumber: '',
    vendorId: '',
    assetId: '',
    workOrderId: '',
  });

  const [budgetForm, setBudgetForm] = useState({
    hostelId: user?.hostelId?._id || user?.hostelId || '',
    financialYear: '2026-27',
    category: 'MAINTENANCE',
    allocatedAmount: '',
    revisedAmount: '',
    notes: '',
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    serviceCategory: 'ELECTRICAL',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    hostelId: user?.hostelId?._id || user?.hostelId || '',
  });

  const [fyForm, setFyForm] = useState({
    financialYear: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Fetch Core Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, bRes, expRes, vRes, fyRes] = await Promise.all([
        financeService.getFinanceDashboard({ financialYear: selectedFY }),
        financeService.getBudgets({ financialYear: selectedFY }),
        financeService.getExpenses({ financialYear: selectedFY, category: expCategory, status: expStatus, search }),
        financeService.getVendors(),
        financeService.getFinancialYears().catch(() => ({ data: [] })),
      ]);

      if (dashRes.success) setDashboardData(dashRes.data);
      if (bRes.success) setBudgets(bRes.data || []);
      if (expRes.success) setExpenses(expRes.data || []);
      if (vRes.success) setVendors(vRes.data || []);
      if (fyRes.success) {
        setFinancialYears(fyRes.data || []);
        if (fyRes.data?.length > 0 && !selectedFY) {
          setSelectedFY(fyRes.data[0].financialYear);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFY, expCategory, expStatus]);

  useEffect(() => {
    // Auxiliary lookup lists
    analyticsService.getHostels().then((res) => {
      if (res.success) setHostels(res.data || []);
    }).catch(() => {});

    assetService.getAssets({ limit: 100 }).then((res) => {
      if (res.success) setAssetsList(res.data || []);
    }).catch(() => {});

    workOrderService.getWorkOrders({ limit: 100 }).then((res) => {
      if (res.success) setWorkOrdersList(res.data || []);
    }).catch(() => {});
  }, []);

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

  // Handlers
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...expenseForm,
        financialYear: selectedFY,
        amount: Number(expenseForm.amount),
      };
      if (!payload.vendorId) delete payload.vendorId;
      if (!payload.assetId) delete payload.assetId;
      if (!payload.workOrderId) delete payload.workOrderId;

      const res = await financeService.createExpense(payload);
      if (res.success) {
        setShowExpenseModal(false);
        setExpenseForm({
          hostelId: user?.hostelId?._id || user?.hostelId || '',
          financialYear: selectedFY,
          category: 'MAINTENANCE',
          title: '',
          description: '',
          amount: '',
          invoiceNumber: '',
          vendorId: '',
          assetId: '',
          workOrderId: '',
        });
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to create expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBudgetSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...budgetForm,
        financialYear: selectedFY,
        allocatedAmount: Number(budgetForm.allocatedAmount),
      };
      if (budgetForm.revisedAmount) payload.revisedAmount = Number(budgetForm.revisedAmount);

      const res = await financeService.createBudget(payload);
      if (res.success) {
        setShowBudgetModal(false);
        setBudgetForm({
          hostelId: user?.hostelId?._id || user?.hostelId || '',
          financialYear: selectedFY,
          category: 'MAINTENANCE',
          allocatedAmount: '',
          revisedAmount: '',
          notes: '',
        });
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to allocate budget');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await financeService.createVendor(vendorForm);
      if (res.success) {
        setShowVendorModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to register vendor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFYSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await financeService.createFinancialYear(fyForm);
      if (res.success) {
        setShowFYModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to create financial year');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickApprove = async (expense) => {
    // Check self-approval guard client-side for immediate feedback
    if (expense.createdBy?._id === user?._id && user?.role !== 'SUPER_ADMIN') {
      alert('Self-approval guard: You cannot approve your own expense request.');
      return;
    }
    if (!window.confirm(`Approve expense "${expense.title}" for ₹${expense.amount}?`)) return;

    try {
      const res = await financeService.approveExpense(expense._id);
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to approve expense');
    }
  };

  const handleQuickReject = async (e) => {
    e.preventDefault();
    if (!selectedExpense || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await financeService.rejectExpense(selectedExpense._id, { reason: rejectReason });
      if (res.success) {
        setShowRejectModal(false);
        setSelectedExpense(null);
        setRejectReason('');
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to reject expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseFY = async (fyId) => {
    if (!window.confirm('Are you sure you want to close this financial year? Modifications will be locked.')) return;
    try {
      const res = await financeService.closeFinancialYear(fyId);
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Action failed');
    }
  };

  const handleReopenFY = async (fyId) => {
    if (!window.confirm('Reopen this financial year?')) return;
    try {
      const res = await financeService.reopenFinancialYear(fyId);
      if (res.success) fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Action failed');
    }
  };

  const pendingApprovalsList = expenses.filter((e) =>
    ['SUBMITTED', 'UNDER_REVIEW'].includes(e.status)
  );

  return (
    <DashboardLayout
      title="Hostel Finance &amp; Expense Management"
      roleLabel={user?.role}
    >
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Hostel Finance &amp; Expense Operations
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Track operational budgets, maintenance costs, vendor invoices, and multi-level expense approvals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Financial Year Selector */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-xs">
              <span className="font-semibold text-slate-500">FY:</span>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="bg-transparent font-bold text-indigo-700 focus:outline-none"
              >
                <option value="2026-27">2026-27</option>
                <option value="2025-26">2025-26</option>
                {financialYears
                  .filter((fy) => !['2026-27', '2025-26'].includes(fy.financialYear))
                  .map((fy) => (
                    <option key={fy._id} value={fy.financialYear}>
                      {fy.financialYear} {fy.status === 'CLOSED' ? '(Closed)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={() => setShowExpenseModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <span>+</span> New Expense
            </button>

            {canManageBudgets && (
              <button
                onClick={() => setShowBudgetModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span>+</span> Allocate Budget
              </button>
            )}
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        {dashboardData && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Total Budget</p>
              <p className="mt-1 text-lg font-bold text-slate-900 truncate">
                {formatCurrency(dashboardData.kpi.totalBudget)}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-emerald-700">Utilized Spend</p>
              <p className="mt-1 text-lg font-bold text-emerald-900 truncate">
                {formatCurrency(dashboardData.kpi.totalUtilized)}
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-blue-700">Remaining Balance</p>
              <p className="mt-1 text-lg font-bold text-blue-900 truncate">
                {formatCurrency(dashboardData.kpi.totalRemaining)}
              </p>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-purple-700">Utilization %</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-purple-900">
                  {dashboardData.kpi.utilizationPercent}%
                </span>
                <span className="text-[10px] text-purple-600">of allocated</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-amber-700">Pending Review</p>
              <p className="mt-1 text-xl font-bold text-amber-900">
                {dashboardData.kpi.pendingApprovalCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Approved Invoices</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {dashboardData.kpi.approvedCount}
              </p>
            </div>
          </div>
        )}

        {/* Visual Category Budget Progress Bars */}
        {budgets.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Operational Budget Utilization by Category ({selectedFY})
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.map((b) => {
                const effective = b.revisedAmount != null ? b.revisedAmount : b.allocatedAmount;
                const ratio = effective > 0 ? (b.utilizedAmount / effective) * 100 : 0;
                const percent = Math.min(100, Math.round(ratio));
                return (
                  <div key={b._id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{b.category}</span>
                      <span className={`${ratio > 100 ? 'text-rose-600 font-bold' : ratio >= 80 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {Math.round(ratio)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          ratio > 100
                            ? 'bg-rose-600'
                            : ratio >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Used: {formatCurrency(b.utilizedAmount)}</span>
                      <span>Total: {formatCurrency(effective)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex border-b border-slate-200 px-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'expenses'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('budgets')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'budgets'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Budgets ({budgets.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'approvals'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Pending Approvals</span>
              {pendingApprovalsList.length > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                  {pendingApprovalsList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`py-3 px-4 border-b-2 transition ${
                activeTab === 'vendors'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Vendors ({vendors.length})
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('financialYears')}
                className={`py-3 px-4 border-b-2 transition ${
                  activeTab === 'financialYears'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Financial Years
              </button>
            )}
          </div>

          <div className="p-4">
            {/* TAB 1: EXPENSES LIST */}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search by ID, title, invoice..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none w-56"
                  />
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="">All Categories</option>
                    {['MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'MESS', 'SECURITY', 'UTILITIES', 'ASSET_PURCHASE', 'REPAIR', 'GENERAL', 'OTHER'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={expStatus}
                    onChange={(e) => setExpStatus(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {(search || expCategory || expStatus) && (
                    <button
                      onClick={() => { setSearch(''); setExpCategory(''); setExpStatus(''); }}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner message="Loading expense records..." />
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                    No expense records found. Click "+ New Expense" to create one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2.5">Expense ID</th>
                          <th className="px-3 py-2.5">Title &amp; Category</th>
                          <th className="px-3 py-2.5">Amount</th>
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5">Links</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expenses.map((exp) => (
                          <tr key={exp._id} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2.5 font-bold text-indigo-600">
                              <Link to={`/finance/expenses/${exp._id}`} className="hover:underline">
                                {exp.expenseId}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-slate-800">{exp.title}</div>
                              <div className="text-[10px] text-slate-400">{exp.category}</div>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              {formatCurrency(exp.amount)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">
                              {formatDate(exp.expenseDate)}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] text-slate-600">
                              {exp.assetId && <span className="block text-indigo-700">Asset: {exp.assetId.assetCode || exp.assetId.assetId}</span>}
                              {exp.workOrderId && <span className="block text-slate-500">WO: {exp.workOrderId.workOrderId}</span>}
                              {exp.vendorId && <span className="block text-slate-500">Vendor: {exp.vendorId.name}</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  exp.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : exp.status === 'UNDER_REVIEW'
                                    ? 'bg-amber-100 text-amber-800'
                                    : exp.status === 'SUBMITTED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : exp.status === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {exp.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  to={`/finance/expenses/${exp._id}`}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Details
                                </Link>
                                {canApprove && ['SUBMITTED', 'UNDER_REVIEW'].includes(exp.status) && (
                                  <>
                                    <button
                                      onClick={() => handleQuickApprove(exp)}
                                      className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => { setSelectedExpense(exp); setShowRejectModal(true); }}
                                      className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BUDGETS LIST */}
            {activeTab === 'budgets' && (
              <div>
                {budgets.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No budget allocations found for Financial Year {selectedFY}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2.5">Budget ID</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5">Hostel</th>
                          <th className="px-3 py-2.5">Allocated</th>
                          <th className="px-3 py-2.5">Revised</th>
                          <th className="px-3 py-2.5">Utilized</th>
                          <th className="px-3 py-2.5">Remaining</th>
                          <th className="px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {budgets.map((b) => {
                          const effective = b.revisedAmount != null ? b.revisedAmount : b.allocatedAmount;
                          const ratio = effective > 0 ? (b.utilizedAmount / effective) * 100 : 0;
                          return (
                            <tr key={b._id} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5 font-bold text-indigo-600">{b.budgetId}</td>
                              <td className="px-3 py-2.5 font-semibold text-slate-800">{b.category}</td>
                              <td className="px-3 py-2.5 text-slate-600">{b.hostelId?.name}</td>
                              <td className="px-3 py-2.5">{formatCurrency(b.allocatedAmount)}</td>
                              <td className="px-3 py-2.5">{b.revisedAmount != null ? formatCurrency(b.revisedAmount) : '—'}</td>
                              <td className="px-3 py-2.5 font-bold text-emerald-800">{formatCurrency(b.utilizedAmount)}</td>
                              <td className="px-3 py-2.5 font-bold text-slate-900">{formatCurrency(b.remainingAmount)}</td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    ratio > 100
                                      ? 'bg-rose-100 text-rose-800'
                                      : ratio >= 80
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {Math.round(ratio)}%
                                </span>
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

            {/* TAB 3: PENDING APPROVALS */}
            {activeTab === 'approvals' && (
              <div>
                {pendingApprovalsList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No pending expense approvals requiring review.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2.5">Expense ID</th>
                          <th className="px-3 py-2.5">Title</th>
                          <th className="px-3 py-2.5">Amount</th>
                          <th className="px-3 py-2.5">Submitted By</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5 text-right">Review Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pendingApprovalsList.map((exp) => (
                          <tr key={exp._id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-bold text-indigo-600">{exp.expenseId}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{exp.title}</td>
                            <td className="px-3 py-2.5 font-bold text-slate-900">{formatCurrency(exp.amount)}</td>
                            <td className="px-3 py-2.5 text-slate-600">{exp.createdBy?.name}</td>
                            <td className="px-3 py-2.5 text-slate-500">{exp.category}</td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  to={`/finance/expenses/${exp._id}`}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Inspect Traceability
                                </Link>
                                <button
                                  onClick={() => handleQuickApprove(exp)}
                                  className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => { setSelectedExpense(exp); setShowRejectModal(true); }}
                                  className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: VENDORS */}
            {activeTab === 'vendors' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 uppercase">Registered Service &amp; Supply Vendors</h3>
                  {canManageBudgets && (
                    <button
                      onClick={() => setShowVendorModal(true)}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      + Register Vendor
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vendors.map((v) => (
                    <div key={v._id} className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-slate-900">
                        <span>{v.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {v.serviceCategory}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">ID: {v.vendorId}</div>
                      <div className="text-slate-600">Contact: {v.contactName || 'N/A'} • {v.phone || 'N/A'}</div>
                      <div className="text-slate-500 truncate">Email: {v.email || 'N/A'}</div>
                      <div className="text-[11px] text-slate-400 truncate">Address: {v.address || 'Lucknow Campus'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: FINANCIAL YEARS (Admin) */}
            {activeTab === 'financialYears' && isAdmin && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700 uppercase">Operational Financial Years</h3>
                  <button
                    onClick={() => setShowFYModal(true)}
                    className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    + Define New FY
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2.5">Financial Year</th>
                        <th className="px-3 py-2.5">Start Date</th>
                        <th className="px-3 py-2.5">End Date</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {financialYears.map((fy) => (
                        <tr key={fy._id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{fy.financialYear}</td>
                          <td className="px-3 py-2.5 text-slate-600">{formatDate(fy.startDate)}</td>
                          <td className="px-3 py-2.5 text-slate-600">{formatDate(fy.endDate)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              fy.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {fy.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {fy.status === 'OPEN' ? (
                              <button
                                onClick={() => handleCloseFY(fy._id)}
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Close FY
                              </button>
                            ) : (
                              user?.role === 'SUPER_ADMIN' && (
                                <button
                                  onClick={() => handleReopenFY(fy._id)}
                                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Reopen
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL 1: NEW EXPENSE */}
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Record Hostel Operational Expense</h2>
                <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleExpenseSubmit} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700">Expense Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Geyser thermostat repair parts"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700">Category *</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    >
                      {['MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'HOUSEKEEPING', 'CLEANING', 'MESS', 'SECURITY', 'UTILITIES', 'ASSET_PURCHASE', 'REPAIR', 'GENERAL', 'OTHER'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 4500"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700">Invoice / Bill Number</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-992"
                      value={expenseForm.invoiceNumber}
                      onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Vendor (Optional)</label>
                    <select
                      value={expenseForm.vendorId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, vendorId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">No vendor / Internal</option>
                      {vendors.map((v) => (
                        <option key={v._id} value={v._id}>{v.name} ({v.serviceCategory})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Operational Linking */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700">Link Work Order (Optional)</label>
                    <select
                      value={expenseForm.workOrderId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, workOrderId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      {workOrdersList.map((wo) => (
                        <option key={wo._id} value={wo._id}>{wo.workOrderId} - {wo.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Link Asset (Optional)</label>
                    <select
                      value={expenseForm.assetId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, assetId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      {assetsList.map((a) => (
                        <option key={a._id} value={a._id}>{a.assetCode || a.assetId} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Description / Justification</label>
                  <textarea
                    rows="2"
                    placeholder="Details of expenditure..."
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Create Draft'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ALLOCATE BUDGET */}
        {showBudgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Allocate Operational Budget</h2>
                <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleBudgetSubmit} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700">Category *</label>
                  <select
                    value={budgetForm.category}
                    onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  >
                    {['MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'HOUSEKEEPING', 'CLEANING', 'MESS', 'SECURITY', 'UTILITIES', 'ASSET_PURCHASE', 'REPAIR', 'GENERAL', 'OTHER'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Allocated Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 100000"
                    value={budgetForm.allocatedAmount}
                    onChange={(e) => setBudgetForm({ ...budgetForm, allocatedAmount: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Remarks / Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Annual allocation notes..."
                    value={budgetForm.notes}
                    onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBudgetModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Allocating...' : 'Allocate Budget'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: REGISTER VENDOR */}
        {showVendorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Register Vendor</h2>
                <button onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleVendorSubmit} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700">Vendor / Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shankar Electrical Supplies"
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Service Category *</label>
                  <select
                    value={vendorForm.serviceCategory}
                    onChange={(e) => setVendorForm({ ...vendorForm, serviceCategory: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  >
                    {['ELECTRICAL', 'PLUMBING', 'APPLIANCE_REPAIR', 'CLEANING_SUPPLIES', 'MESS_PROVISIONS', 'FURNITURE', 'SECURITY', 'UTILITIES', 'CIVIL_CONSTRUCTION', 'HARDWARE', 'GENERAL_SUPPLIES', 'OTHER'].map((sc) => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh"
                      value={vendorForm.contactName}
                      onChange={(e) => setVendorForm({ ...vendorForm, contactName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Phone</label>
                    <input
                      type="text"
                      placeholder="+91..."
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Address / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Gomti Nagar, Lucknow"
                    value={vendorForm.address}
                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowVendorModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: DEFINE FY */}
        {showFYModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Define Financial Year</h2>
                <button onClick={() => setShowFYModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleFYSubmit} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700">Financial Year Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2027-28"
                    value={fyForm.financialYear}
                    onChange={(e) => setFyForm({ ...fyForm, financialYear: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={fyForm.startDate}
                      onChange={(e) => setFyForm({ ...fyForm, startDate: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">End Date *</label>
                    <input
                      type="date"
                      required
                      value={fyForm.endDate}
                      onChange={(e) => setFyForm({ ...fyForm, endDate: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFYModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create FY'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: REJECT EXPENSE */}
        {showRejectModal && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Reject Expense: {selectedExpense.expenseId}</h2>
                <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleQuickReject} className="mt-4 space-y-3 text-xs">
                <p className="text-slate-600">
                  Please specify the operational justification for rejecting this expense request.
                </p>

                <div>
                  <label className="block font-semibold text-slate-700">Rejection Reason *</label>
                  <textarea
                    required
                    rows="3"
                    placeholder="e.g. Missing attached quotation / excess amount..."
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
    </DashboardLayout>
  );
}
