import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import assetService from '../../services/assetService.js';
import analyticsService from '../../services/analyticsService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';

export default function AssetDetailPage() {
  const { user } = useAuth();
  const { id } = useParams();

  const isStudent = user?.role === 'STUDENT';
  const canManage = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN'].includes(user?.role);
  const canAudit = ['SUPER_ADMIN', 'AUTHORITY', 'WARDEN', 'HOSTEL_STAFF'].includes(user?.role);

  // Data states
  const [assetData, setAssetData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('workOrders'); // 'workOrders', 'movements', 'conditions', 'auditLog'

  // Hostels for move modal
  const [hostels, setHostels] = useState([]);

  // Modals
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms
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
    actionType: 'RETIRE',
    reason: '',
    salvageValue: '',
    disposalMethod: 'SCRAP',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [histRes, healthRes] = await Promise.all([
        assetService.getMaintenanceHistory(id),
        assetService.getAssetHealth(id).catch(() => ({ success: false })),
      ]);

      if (histRes.success) {
        setAssetData(histRes.data);
      } else {
        setError(histRes.message || 'Asset not found');
      }

      if (healthRes.success) {
        setHealthData(healthRes.data);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load asset details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    analyticsService.getHostels().then((res) => {
      if (res.success) setHostels(res.data || []);
    }).catch(() => {});
  }, [id]);

  const asset = assetData?.asset;
  const workOrders = assetData?.workOrders || [];
  const totalWorkOrders = assetData?.totalWorkOrders || 0;
  const completedWorkOrders = assetData?.completedWorkOrders || 0;
  const inProgressWorkOrders = assetData?.inProgressWorkOrders || 0;
  const avgCompletionHours = assetData?.avgCompletionHours || 0;

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        targetHostelId: moveForm.targetHostelId || asset.hostelId?._id || asset.hostelId,
        reason: moveForm.reason,
      };
      if (moveForm.targetBlockId) payload.targetBlockId = moveForm.targetBlockId;
      if (moveForm.targetFloorId) payload.targetFloorId = moveForm.targetFloorId;
      if (moveForm.targetRoomId) payload.targetRoomId = moveForm.targetRoomId;
      if (moveForm.commonArea) payload.commonArea = moveForm.commonArea;

      const res = await assetService.moveAsset(asset._id, payload);
      if (res.success) {
        setShowMoveModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to move asset');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConditionSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await assetService.updateCondition(asset._id, conditionForm);
      if (res.success) {
        setShowConditionModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Failed to record condition audit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetireSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (retireForm.actionType === 'RETIRE') {
        await assetService.retireAsset(asset._id, { reason: retireForm.reason });
      } else {
        await assetService.disposeAsset(asset._id, {
          reason: retireForm.reason,
          salvageValue: retireForm.salvageValue ? Number(retireForm.salvageValue) : 0,
          disposalMethod: retireForm.disposalMethod,
        });
      }
      setShowRetireModal(false);
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openMoveModal = () => {
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

  const openConditionModal = () => {
    setConditionForm({
      condition: asset.condition || 'GOOD',
      notes: '',
    });
    setShowConditionModal(true);
  };

  const openRetireModal = (actionType = 'RETIRE') => {
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

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <DashboardLayout
      title={asset ? `Asset: ${asset.name}` : 'Asset Details'}
      roleLabel={user?.role}
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading asset records and lifecycle..." />
        </div>
      ) : error || !asset ? (
        <ErrorState message={error || 'Asset not found'} onRetry={fetchData} />
      ) : (
        <div className="space-y-6">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link to="/assets" className="hover:text-indigo-600">Assets &amp; Inventory</Link>
                <span>/</span>
                <span className="font-semibold text-slate-700">{asset.assetCode || asset.assetId}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {asset.name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
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
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    ['NEW', 'EXCELLENT', 'GOOD'].includes(asset.condition)
                      ? 'bg-emerald-100 text-emerald-800'
                      : asset.condition === 'FAIR'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Condition: {asset.condition}
                </span>

                {asset.operationalFlag === 'FREQUENT_FAILURE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    ⚠ Frequent Failure ({asset.failureCount || 0} repairs)
                  </span>
                )}
                {asset.operationalFlag === 'WATCH' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    Watch ({asset.failureCount || 0} repairs)
                  </span>
                )}
                {asset.operationalFlag === 'CRITICAL' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                    Critical
                  </span>
                )}
                {asset.replacementRecommended && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    Replacement Recommended
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canAudit && (
                <button
                  onClick={openConditionModal}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Audit Condition
                </button>
              )}

              {canManage && asset.status !== 'DISPOSED' && (
                <>
                  <button
                    onClick={openMoveModal}
                    className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Move Asset
                  </button>

                  {asset.status !== 'RETIRED' && (
                    <button
                      onClick={() => openRetireModal('RETIRE')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Retire
                    </button>
                  )}

                  {asset.status === 'RETIRED' && (
                    <button
                      onClick={() => openRetireModal('DISPOSE')}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Dispose Asset
                    </button>
                  )}
                </>
              )}

              <Link
                to="/assets"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                ← Back
              </Link>
            </div>
          </div>

          {/* Cards Grid: Health Score, Specs & Lifecycle, Location, Financials */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* 1. Health Score Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Asset Health</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    (healthData?.healthScore || 100) >= 75
                      ? 'bg-emerald-100 text-emerald-800'
                      : (healthData?.healthScore || 100) >= 50
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {healthData?.healthStatus || 'HEALTHY'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {healthData?.healthScore ?? 100}
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>

              {/* Contributing factors */}
              {healthData?.contributingFactors && (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Condition Score:</span>
                    <span className="font-semibold">{healthData.contributingFactors.conditionScore}/100</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Age Penalty:</span>
                    <span>-{healthData.contributingFactors.agePenalty}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Repair Cost Penalty:</span>
                    <span>-{healthData.contributingFactors.repairCostPenalty}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Breakdown Penalty:</span>
                    <span>-{healthData.contributingFactors.breakdownPenalty}</span>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {healthData?.recommendations && healthData.recommendations.length > 0 && (
                <div className="mt-3 rounded-lg bg-indigo-50/70 p-2.5 text-[11px] text-indigo-900">
                  <p className="font-semibold text-indigo-950">Action Advisory:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {healthData.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 2. Specs & Warranty */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Specifications</span>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Type / Category:</span>
                  <span className="font-semibold text-slate-800">{asset.assetType} • {asset.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial Number:</span>
                  <span className="font-mono text-slate-800">{asset.serialNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Model Number:</span>
                  <span className="text-slate-800">{asset.modelNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Manufacturer:</span>
                  <span className="text-slate-800">{asset.manufacturer || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vendor:</span>
                  <span className="text-slate-800">{asset.vendor || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2 text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Warranty Expiry:</span>
                  <span className="font-semibold text-slate-800">{formatDate(asset.warrantyExpiryDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Life:</span>
                  <span className="text-slate-800">{asset.expectedLifeYears || 5} Years</span>
                </div>
              </div>
            </div>

            {/* 3. Location & Area */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Location Details</span>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hostel:</span>
                  <span className="font-semibold text-slate-800">{asset.hostelId?.name || 'Assigned Hostel'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Block:</span>
                  <span className="text-slate-800">{asset.blockId?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Floor:</span>
                  <span className="text-slate-800">{asset.floorId?.floorNumber != null ? `Floor ${asset.floorId.floorNumber}` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Room:</span>
                  <span className="font-semibold text-slate-800">{asset.roomId?.roomNumber ? `Room ${asset.roomId.roomNumber}` : '—'}</span>
                </div>
                {asset.commonArea && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Common Area:</span>
                    <span className="font-semibold text-indigo-700">{asset.commonArea}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-slate-800">{asset.departmentId?.name || '—'}</span>
                </div>
              </div>
            </div>

            {/* 4. Financials & Spend */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Financial Summary</span>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Procurement Cost:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(asset.purchaseCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Repair Spend:</span>
                  <span className="font-bold text-rose-700">{formatCurrency(asset.totalMaintenanceCost || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cost-to-Asset Ratio:</span>
                  <span className="font-semibold text-slate-800">
                    {asset.purchaseCost > 0
                      ? `${Math.round(((asset.totalMaintenanceCost || 0) / asset.purchaseCost) * 100)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Work Orders:</span>
                  <span className="font-bold text-slate-900">{totalWorkOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Breakdown Count:</span>
                  <span className="font-bold text-purple-700">{asset.failureCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Resolution:</span>
                  <span className="text-slate-800">{avgCompletionHours}h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity & History Tabs */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex border-b border-slate-200 px-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('workOrders')}
                className={`py-3 px-4 border-b-2 transition ${
                  activeTab === 'workOrders'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Work Orders ({workOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={`py-3 px-4 border-b-2 transition ${
                  activeTab === 'movements'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Movement History ({(asset.movementHistory || []).length})
              </button>
              <button
                onClick={() => setActiveTab('conditions')}
                className={`py-3 px-4 border-b-2 transition ${
                  activeTab === 'conditions'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Condition Audits ({(asset.conditionHistory || []).length})
              </button>
              <button
                onClick={() => setActiveTab('auditLog')}
                className={`py-3 px-4 border-b-2 transition ${
                  activeTab === 'auditLog'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Lifecycle Audit Log ({(asset.lifecycleAuditLog || []).length})
              </button>
            </div>

            <div className="p-4">
              {/* Tab 1: Work Orders */}
              {activeTab === 'workOrders' && (
                <div>
                  {workOrders.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No maintenance work orders have been logged for this asset.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                          <tr>
                            <th className="px-3 py-2">WO Number</th>
                            <th className="px-3 py-2">Title</th>
                            <th className="px-3 py-2">Priority</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Labor</th>
                            <th className="px-3 py-2">Parts</th>
                            <th className="px-3 py-2">Total Cost</th>
                            <th className="px-3 py-2 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {workOrders.map((wo) => (
                            <tr key={wo._id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-bold text-indigo-600">
                                <Link to={`/work-orders/${wo._id}`} className="hover:underline">
                                  {wo.workOrderId}
                                </Link>
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800">{wo.title}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  wo.priority === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800'
                                    : wo.priority === 'HIGH'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {wo.priority}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-semibold text-slate-700">{wo.status}</span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{formatCurrency(wo.laborCost || 0)}</td>
                              <td className="px-3 py-2 text-slate-600">{formatCurrency(wo.partsCost || 0)}</td>
                              <td className="px-3 py-2 font-bold text-slate-900">{formatCurrency(wo.totalCost || 0)}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{formatDate(wo.completedAt || wo.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Movement History */}
              {activeTab === 'movements' && (
                <div>
                  {(asset.movementHistory || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No relocation movements recorded for this asset.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(asset.movementHistory || [])].reverse().map((m, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <span>Relocation</span>
                            <span className="text-[11px] text-slate-500 font-normal">{formatDate(m.movedAt)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-slate-600">
                            <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px]">From: {m.fromLocation?.hostelId?.name || 'Origin'}</span>
                            <span>→</span>
                            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                              To: {m.toLocation?.hostelId?.name || 'Destination'} {m.toLocation?.commonArea ? `(${m.toLocation.commonArea})` : ''}
                            </span>
                          </div>
                          {m.reason && (
                            <p className="mt-1.5 text-[11px] text-slate-600 italic">"{m.reason}"</p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">Moved by: {m.movedBy?.name || 'Staff'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Condition History */}
              {activeTab === 'conditions' && (
                <div>
                  {(asset.conditionHistory || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No physical condition audits have been recorded.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(asset.conditionHistory || [])].reverse().map((c, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{c.previousCondition}</span>
                              <span>→</span>
                              <span className="font-bold text-slate-900">{c.newCondition}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-normal">{formatDate(c.changedAt)}</span>
                          </div>
                          {c.notes && (
                            <p className="mt-1.5 text-[11px] text-slate-600">Notes: {c.notes}</p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">Audited by: {c.changedBy?.name || 'Staff'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Lifecycle Audit Trail */}
              {activeTab === 'auditLog' && (
                <div>
                  {(asset.lifecycleAuditLog || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No lifecycle audit events recorded.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...(asset.lifecycleAuditLog || [])].reverse().map((log, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <span className="font-bold text-indigo-700">{log.action}</span>
                            <span className="text-[11px] text-slate-500 font-normal">{formatDate(log.performedAt)}</span>
                          </div>
                          {(log.previousStatus || log.newStatus) && (
                            <div className="mt-1 text-[11px] text-slate-600">
                              Status Transition: <span className="font-mono">{log.previousStatus || 'INIT'}</span> → <span className="font-mono font-bold">{log.newStatus}</span>
                            </div>
                          )}
                          {log.details && (
                            <p className="mt-1 text-[11px] text-slate-600">{log.details}</p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">Action performed by: {log.performedBy?.name || 'System / Staff'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal 1: Move Modal */}
          {showMoveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Relocate Asset</h2>
                  <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleMoveSubmit} className="mt-4 space-y-4">
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
                    <label className="block text-xs font-semibold text-slate-700">Target Common Area (Optional)</label>
                    <select
                      value={moveForm.commonArea}
                      onChange={(e) => setMoveForm({ ...moveForm, commonArea: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">None (Assigned to Room / Floor)</option>
                      {['MESS_HALL', 'DINING_HALL', 'CORRIDOR', 'COMMON_WASHROOM', 'STUDY_ROOM', 'GYM', 'TV_ROOM', 'TERRACE', 'ENTRANCE_LOBBY', 'PARKING'].map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Relocation Reason *</label>
                    <textarea
                      required
                      rows="2"
                      placeholder="e.g. Swapped to study room for higher capacity"
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

          {/* Modal 2: Condition Modal */}
          {showConditionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">Audit Physical Condition</h2>
                  <button onClick={() => setShowConditionModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleConditionSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">New Physical Condition *</label>
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
                    <label className="block text-xs font-semibold text-slate-700">Audit Observations</label>
                    <textarea
                      rows="3"
                      placeholder="Inspection remarks..."
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
                      {actionLoading ? 'Saving...' : 'Record Audit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 3: Retire / Dispose Modal */}
          {showRetireModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-base font-bold text-slate-900">
                    {retireForm.actionType === 'RETIRE' ? 'Retire Asset' : 'Dispose Asset'}
                  </h2>
                  <button onClick={() => setShowRetireModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <form onSubmit={handleRetireSubmit} className="mt-4 space-y-4">
                  <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                    {retireForm.actionType === 'RETIRE'
                      ? 'Retiring marks this asset as decommissioned from active student service while preserving maintenance history for audit.'
                      : 'Disposing finalized the asset removal from university premises.'}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Justification Reason *</label>
                    <textarea
                      required
                      rows="3"
                      placeholder="e.g. Unrecoverable wear / end-of-life"
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
      )}
    </DashboardLayout>
  );
}
