import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import assetService from '../../services/assetService.js';
import analyticsService from '../../services/analyticsService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';

export default function AssetManagementPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const canManage = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);
  const canAudit = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN', 'HOSTEL_STAFF'].includes(user?.role);

  // Data states
  const [assets, setAssets] = useState([]);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [operationalFlag, setOperationalFlag] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Dropdown options
  const [hostels, setHostels] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [registerForm, setRegisterForm] = useState({
    name: '',
    assetCode: '',
    assetType: 'FAN',
    category: 'ELECTRICAL',
    hostelId: user?.hostelId?._id || user?.hostelId || '',
    departmentId: '',
    serialNumber: '',
    modelNumber: '',
    manufacturer: '',
    vendor: '',
    purchaseCost: '',
    expectedLifeYears: 5,
    warrantyStartDate: '',
    warrantyExpiryDate: '',
    condition: 'NEW',
    commonArea: '',
    notes: '',
  });

  const [moveForm, setMoveForm] = useState({
    targetHostelId: '',
    targetBlockId: '',
    targetFloorId: '',
    targetRoomId: '',
    commonArea: '',
    reason: '',
  });

  const [conditionForm, setConditionForm] = useState({
    condition: 'GOOD',
    notes: '',
  });

  const [retireForm, setRetireForm] = useState({
    actionType: 'RETIRE', // 'RETIRE' or 'DISPOSE'
    reason: '',
    salvageValue: '',
    disposalMethod: 'SCRAP',
  });

  // Fetch KPI dashboard data
  const fetchDashboardMetrics = async () => {
    if (isStudent) return;
    try {
      const res = await assetService.getInventoryDashboard();
      if (res.success) {
        setDashboardMetrics(res.data);
      }
    } catch {
      // Non-blocking
    }
  };

  // Fetch assets list
  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (condition) params.condition = condition;
      if (operationalFlag) params.operationalFlag = operationalFlag;
      if (category) params.category = category;

      const res = await assetService.getAssets(params);
      if (res.success) {
        setAssets(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [page, status, condition, operationalFlag, category]);

  useEffect(() => {
    fetchDashboardMetrics();
    // Load hostels & departments for selects
    analyticsService.getHostels().then((res) => {
      if (res.success) setHostels(res.data || []);
    }).catch(() => {});

    analyticsService.getDepartments().then((res) => {
      if (res.success) setDepartments(res.data || []);
    }).catch(() => {});
  }, []);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...registerForm,
        purchaseCost: registerForm.purchaseCost ? Number(registerForm.purchaseCost) : 0,
        expectedLifeYears: registerForm.expectedLifeYears ? Number(registerForm.expectedLifeYears) : 5,
      };
      if (!payload.commonArea) delete payload.commonArea;
      if (!payload.warrantyStartDate) delete payload.warrantyStartDate;
      if (!payload.warrantyExpiryDate) delete payload.warrantyExpiryDate;
      if (!payload.departmentId) delete payload.departmentId;

      const res = await assetService.createAsset(payload);
      if (res.success) {
        setShowRegisterModal(false);
        fetchAssets();
        fetchDashboardMetrics();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to register asset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setActionLoading(true);
    try {
      const payload = {
        targetHostelId: moveForm.targetHostelId || selectedAsset.hostelId?._id || selectedAsset.hostelId,
        reason: moveForm.reason,
      };
      if (moveForm.targetBlockId) payload.targetBlockId = moveForm.targetBlockId;
      if (moveForm.targetFloorId) payload.targetFloorId = moveForm.targetFloorId;
      if (moveForm.targetRoomId) payload.targetRoomId = moveForm.targetRoomId;
      if (moveForm.commonArea) payload.commonArea = moveForm.commonArea;

      const res = await assetService.moveAsset(selectedAsset._id, payload);
      if (res.success) {
        setShowMoveModal(false);
        setSelectedAsset(null);
        fetchAssets();
        fetchDashboardMetrics();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to move asset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConditionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setActionLoading(true);
    try {
      const res = await assetService.updateCondition(selectedAsset._id, conditionForm);
      if (res.success) {
        setShowConditionModal(false);
        setSelectedAsset(null);
        fetchAssets();
        fetchDashboardMetrics();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to update asset condition');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetireSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setActionLoading(true);
    try {
      if (retireForm.actionType === 'RETIRE') {
        await assetService.retireAsset(selectedAsset._id, { reason: retireForm.reason });
      } else {
        await assetService.disposeAsset(selectedAsset._id, {
          reason: retireForm.reason,
          salvageValue: retireForm.salvageValue ? Number(retireForm.salvageValue) : 0,
          disposalMethod: retireForm.disposalMethod,
        });
      }
      setShowRetireModal(false);
      setSelectedAsset(null);
      fetchAssets();
      fetchDashboardMetrics();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openMoveModal = (asset) => {
    setSelectedAsset(asset);
    setMoveForm({
      targetHostelId: asset.hostelId?._id || asset.hostelId || '',
      targetBlockId: '',
      targetFloorId: '',
      targetRoomId: '',
      commonArea: asset.commonArea || '',
      reason: '',
    });
    setShowMoveModal(true);
  };

  const openConditionModal = (asset) => {
    setSelectedAsset(asset);
    setConditionForm({
      condition: asset.condition || 'GOOD',
      notes: '',
    });
    setShowConditionModal(true);
  };

  const openRetireModal = (asset, actionType = 'RETIRE') => {
    setSelectedAsset(asset);
    setRetireForm({
      actionType,
      reason: '',
      salvageValue: '',
      disposalMethod: 'SCRAP',
    });
    setShowRetireModal(true);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  return (
    <DashboardLayout
      title={isStudent ? 'Assigned Room Assets' : 'Hostel Asset Lifecycle & Inventory'}
      roleLabel={user?.role}
    >
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {isStudent ? 'My Room Equipment & Inventory' : 'Hostel Inventory & Asset Lifecycle'}
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {isStudent
                ? 'View the status, warranty, and health of equipment assigned to your room.'
                : 'Monitor asset procurement, live health, breakdown frequency, repair costs, and retirement.'}
            </p>
          </div>

          {canManage && (
            <div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
              >
                <span>+</span> Register New Asset
              </button>
            </div>
          )}
        </div>

        {/* Inventory KPI Dashboard (for Staff, Warden, Authority, Super Admin) */}
        {!isStudent && dashboardMetrics && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Total Assets</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{dashboardMetrics.totalAssets || 0}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-emerald-700">Active</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{dashboardMetrics.activeAssets || 0}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-amber-700">Under Maint.</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{dashboardMetrics.underMaintenance || 0}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-rose-700">Damaged / Review</p>
              <p className="mt-1 text-xl font-bold text-rose-900">
                {(dashboardMetrics.damagedAssets || 0) + (dashboardMetrics.replacementReview || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-purple-700">Freq. Failure</p>
              <p className="mt-1 text-xl font-bold text-purple-900">{dashboardMetrics.frequentlyFailing || 0}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-blue-700">Warranty Alert</p>
              <p className="mt-1 text-xl font-bold text-blue-900">
                {(dashboardMetrics.warrantyExpiringSoon || 0) + (dashboardMetrics.warrantyExpired || 0)}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-indigo-700">Asset Value</p>
              <p className="mt-1 text-sm font-bold text-indigo-900 truncate">
                {formatCurrency(dashboardMetrics.totalAssetValue)}
              </p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-orange-700">Maint. Spend</p>
              <p className="mt-1 text-sm font-bold text-orange-900 truncate">
                {formatCurrency(dashboardMetrics.totalMaintenanceSpend)}
              </p>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by ID, name, code, serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchAssets()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none w-56 sm:w-64"
          />

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="REPAIRED">Repaired</option>
            <option value="DAMAGED">Damaged</option>
            <option value="REPLACEMENT_REVIEW">Replacement Review</option>
            <option value="RETIRED">Retired</option>
            <option value="DISPOSED">Disposed</option>
          </select>

          <select
            value={condition}
            onChange={(e) => { setCondition(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Conditions</option>
            <option value="NEW">New</option>
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
            <option value="DAMAGED">Damaged</option>
          </select>

          <select
            value={operationalFlag}
            onChange={(e) => { setOperationalFlag(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Operational Flags</option>
            <option value="NORMAL">Normal</option>
            <option value="WATCH">Watch</option>
            <option value="FREQUENT_FAILURE">Frequent Failure (3+)</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="PLUMBING">Plumbing</option>
            <option value="FURNITURE">Furniture</option>
            <option value="WATER">Water</option>
            <option value="APPLIANCE">Appliance</option>
            <option value="SECURITY">Security</option>
            <option value="INTERNET">Internet</option>
            <option value="MESS">Mess</option>
            <option value="OTHER">Other</option>
          </select>

          <button
            onClick={fetchAssets}
            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Apply Filter
          </button>

          {(search || status || condition || operationalFlag || category) && (
            <button
              onClick={() => {
                setSearch('');
                setStatus('');
                setCondition('');
                setOperationalFlag('');
                setCategory('');
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto"
            >
              Reset
            </button>
          )}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner size="lg" message="Loading asset inventory..." />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchAssets} />
        ) : assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No assets found matching the criteria</p>
            <p className="mt-1 text-xs text-slate-500">
              {isStudent
                ? 'No registered assets are currently linked to your allocated room.'
                : 'Try adjusting your filters or register a new asset.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Asset Code / ID</th>
                    <th className="px-4 py-3">Asset Details</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Condition &amp; Flag</th>
                    <th className="px-4 py-3">Warranty</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Repair Spend</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((asset) => (
                    <tr key={asset._id} className="hover:bg-slate-50/80 transition">
                      {/* Code / ID */}
                      <td className="px-4 py-3 font-semibold">
                        <Link to={`/assets/${asset._id}`} className="text-indigo-600 hover:underline">
                          {asset.assetCode || asset.assetId}
                        </Link>
                        {asset.assetCode && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {asset.assetId}
                          </span>
                        )}
                      </td>

                      {/* Name & Details */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{asset.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{asset.assetType}</span>
                          <span>•</span>
                          <span>{asset.category}</span>
                          {asset.manufacturer && (
                            <>
                              <span>•</span>
                              <span>{asset.manufacturer}</span>
                            </>
                          )}
                        </div>
                        {asset.serialNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">SN: {asset.serialNumber}</div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-medium text-slate-800">{asset.hostelId?.name || 'Assigned Hostel'}</div>
                        <div className="text-[11px] text-slate-500">
                          {asset.commonArea ? (
                            <span className="font-semibold text-indigo-700">Area: {asset.commonArea}</span>
                          ) : (
                            <>
                              {asset.roomId?.roomNumber ? `Room ${asset.roomId.roomNumber}` : 'Hostel General'}
                              {asset.blockId?.name && ` • Block ${asset.blockId.name}`}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Condition & Operational Flag */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ['NEW', 'EXCELLENT', 'GOOD'].includes(asset.condition)
                                ? 'bg-emerald-100 text-emerald-800'
                                : asset.condition === 'FAIR'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {asset.condition}
                          </span>
                          {asset.operationalFlag === 'FREQUENT_FAILURE' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              ⚠ Freq. Failure ({asset.failureCount || 0})
                            </span>
                          )}
                          {asset.operationalFlag === 'WATCH' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800">
                              Watch ({asset.failureCount || 0})
                            </span>
                          )}
                          {asset.operationalFlag === 'CRITICAL' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-600 text-white">
                              Critical
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Warranty */}
                      <td className="px-4 py-3">
                        {asset.warrantyExpiryDate ? (
                          (() => {
                            const now = new Date();
                            const expiry = new Date(asset.warrantyExpiryDate);
                            const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) {
                              return <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">Expired</span>;
                            }
                            if (diffDays <= 30) {
                              return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{diffDays}d left</span>;
                            }
                            return <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Active</span>;
                          })()
                        ) : (
                          <span className="text-[10px] text-slate-400">N/A</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            asset.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : asset.status === 'UNDER_MAINTENANCE'
                              ? 'bg-amber-100 text-amber-800'
                              : ['DAMAGED', 'REPLACEMENT_REVIEW'].includes(asset.status)
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {asset.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Spend */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(asset.totalMaintenanceCost || 0)}
                        </div>
                        {asset.purchaseCost > 0 && (
                          <div className="text-[10px] text-slate-400">
                            Cost: {formatCurrency(asset.purchaseCost)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/assets/${asset._id}`}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Details
                          </Link>

                          {canAudit && (
                            <button
                              onClick={() => openConditionModal(asset)}
                              title="Audit Condition"
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Audit
                            </button>
                          )}

                          {canManage && asset.status !== 'DISPOSED' && (
                            <>
                              <button
                                onClick={() => openMoveModal(asset)}
                                title="Move Location"
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
                              >
                                Move
                              </button>

                              {asset.status !== 'RETIRED' && (
                                <button
                                  onClick={() => openRetireModal(asset, 'RETIRE')}
                                  title="Retire Asset"
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  Retire
                                </button>
                              )}

                              {asset.status === 'RETIRED' && (
                                <button
                                  onClick={() => openRetireModal(asset, 'DISPOSE')}
                                  title="Dispose Asset"
                                  className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                >
                                  Dispose
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total assets)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal 1: Register Asset Modal */}
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Register New Hostel Asset</h2>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Asset Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Havells Geyser 15L"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Custom Asset Code</label>
                    <input
                      type="text"
                      placeholder="e.g. BH1-AC-104 (Auto if empty)"
                      value={registerForm.assetCode}
                      onChange={(e) => setRegisterForm({ ...registerForm, assetCode: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Classification */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Asset Type *</label>
                    <select
                      value={registerForm.assetType}
                      onChange={(e) => setRegisterForm({ ...registerForm, assetType: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      {['FAN', 'LIGHT', 'SWITCHBOARD', 'AC', 'GEYSER', 'COOLER', 'RO', 'BED', 'CHAIR', 'TABLE', 'CUPBOARD', 'MATTRESS', 'PLUMBING_FIXTURE', 'WATER_PURIFIER', 'FURNITURE', 'ROUTER', 'CCTV', 'DOOR_LOCK', 'ELECTRICAL_EQUIPMENT', 'OTHER'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Category *</label>
                    <select
                      value={registerForm.category}
                      onChange={(e) => setRegisterForm({ ...registerForm, category: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      {['ELECTRICAL', 'PLUMBING', 'CLEANING', 'MESS', 'INTERNET', 'FURNITURE', 'SECURITY', 'ROOM', 'WATER', 'APPLIANCE', 'OTHER'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Initial Condition *</label>
                    <select
                      value={registerForm.condition}
                      onChange={(e) => setRegisterForm({ ...registerForm, condition: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      {['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR'].map((cond) => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Location */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Hostel *</label>
                    <select
                      required
                      value={registerForm.hostelId}
                      onChange={(e) => setRegisterForm({ ...registerForm, hostelId: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select Hostel</option>
                      {hostels.map((h) => (
                        <option key={h._id} value={h._id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Common Area (Optional)</label>
                    <select
                      value={registerForm.commonArea}
                      onChange={(e) => setRegisterForm({ ...registerForm, commonArea: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">None (Assigned to Room / Floor)</option>
                      {['MESS_HALL', 'DINING_HALL', 'CORRIDOR', 'COMMON_WASHROOM', 'STUDY_ROOM', 'GYM', 'TV_ROOM', 'TERRACE', 'ENTRANCE_LOBBY', 'PARKING'].map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hardware Spec */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. Havells / Voltas"
                      value={registerForm.manufacturer}
                      onChange={(e) => setRegisterForm({ ...registerForm, manufacturer: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Model Number</label>
                    <input
                      type="text"
                      placeholder="e.g. HV-15L-ECO"
                      value={registerForm.modelNumber}
                      onChange={(e) => setRegisterForm({ ...registerForm, modelNumber: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Serial Number</label>
                    <input
                      type="text"
                      placeholder="e.g. SN-8921831"
                      value={registerForm.serialNumber}
                      onChange={(e) => setRegisterForm({ ...registerForm, serialNumber: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Financials & Warranty */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Purchase Cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 8500"
                      value={registerForm.purchaseCost}
                      onChange={(e) => setRegisterForm({ ...registerForm, purchaseCost: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Life Expectancy (Yrs)</label>
                    <input
                      type="number"
                      min="1"
                      value={registerForm.expectedLifeYears}
                      onChange={(e) => setRegisterForm({ ...registerForm, expectedLifeYears: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Warranty Start</label>
                    <input
                      type="date"
                      value={registerForm.warrantyStartDate}
                      onChange={(e) => setRegisterForm({ ...registerForm, warrantyStartDate: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Warranty Expiry</label>
                    <input
                      type="date"
                      value={registerForm.warrantyExpiryDate}
                      onChange={(e) => setRegisterForm({ ...registerForm, warrantyExpiryDate: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Notes / Description</label>
                  <textarea
                    rows="2"
                    placeholder="Specifications or initial remarks..."
                    value={registerForm.notes}
                    onChange={(e) => setRegisterForm({ ...registerForm, notes: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Register Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Move Asset Modal */}
        {showMoveModal && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">
                  Move Asset: {selectedAsset.name} ({selectedAsset.assetId})
                </h2>
                <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleMoveSubmit} className="mt-4 space-y-4">
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Current Location:</span>{' '}
                  {selectedAsset.hostelId?.name || 'Hostel'}
                  {selectedAsset.commonArea
                    ? ` • ${selectedAsset.commonArea}`
                    : selectedAsset.roomId?.roomNumber
                    ? ` • Room ${selectedAsset.roomId.roomNumber}`
                    : ''}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Target Hostel *</label>
                  <select
                    required
                    value={moveForm.targetHostelId}
                    onChange={(e) => setMoveForm({ ...moveForm, targetHostelId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Target Hostel</option>
                    {hostels.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Move to Common Area (Optional)</label>
                  <select
                    value={moveForm.commonArea}
                    onChange={(e) => setMoveForm({ ...moveForm, commonArea: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Not a Common Area</option>
                    {['MESS_HALL', 'DINING_HALL', 'CORRIDOR', 'COMMON_WASHROOM', 'STUDY_ROOM', 'GYM', 'TV_ROOM', 'TERRACE', 'ENTRANCE_LOBBY', 'PARKING'].map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reason for Relocation *</label>
                  <textarea
                    required
                    rows="2"
                    placeholder="e.g. Transferred for exam study room upgrade"
                    value={moveForm.reason}
                    onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowMoveModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Relocating...' : 'Confirm Move'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Audit Condition Modal */}
        {showConditionModal && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">
                  Audit Condition: {selectedAsset.name}
                </h2>
                <button onClick={() => setShowConditionModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleConditionSubmit} className="mt-4 space-y-4">
                <div className="text-xs text-slate-600">
                  Current Condition:{' '}
                  <span className="font-bold text-slate-900">{selectedAsset.condition}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">New Condition *</label>
                  <select
                    value={conditionForm.condition}
                    onChange={(e) => setConditionForm({ ...conditionForm, condition: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    {['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Inspection Notes / Observations</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Minor wear on blade bearings, operational but noisy"
                    value={conditionForm.notes}
                    onChange={(e) => setConditionForm({ ...conditionForm, notes: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConditionModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Recording...' : 'Save Audit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Retire / Dispose Modal */}
        {showRetireModal && selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">
                  {retireForm.actionType === 'RETIRE' ? 'Retire Asset' : 'Dispose Asset'}: {selectedAsset.name}
                </h2>
                <button onClick={() => setShowRetireModal(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>

              <form onSubmit={handleRetireSubmit} className="mt-4 space-y-4">
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                  {retireForm.actionType === 'RETIRE'
                    ? 'Retiring this asset will take it out of active hostel service. It will remain in the records for audit and lifecycle analytics.'
                    : 'Disposing this asset marks it as finalized and removed from physical inventory.'}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reason / Justification *</label>
                  <textarea
                    required
                    rows="3"
                    placeholder={
                      retireForm.actionType === 'RETIRE'
                        ? 'e.g. Uneconomical to repair after 5th compressor breakdown'
                        : 'e.g. Scrapped via university e-waste vendor'
                    }
                    value={retireForm.reason}
                    onChange={(e) => setRetireForm({ ...retireForm, reason: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {retireForm.actionType === 'DISPOSE' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Disposal Method</label>
                      <select
                        value={retireForm.disposalMethod}
                        onChange={(e) => setRetireForm({ ...retireForm, disposalMethod: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="SCRAP">Scrap</option>
                        <option value="AUCTION">Auction</option>
                        <option value="DONATION">Donation</option>
                        <option value="E_WASTE">E-Waste</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Salvage Value (₹)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 500"
                        value={retireForm.salvageValue}
                        onChange={(e) => setRetireForm({ ...retireForm, salvageValue: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRetireModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : `Confirm ${retireForm.actionType === 'RETIRE' ? 'Retirement' : 'Disposal'}`}
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
