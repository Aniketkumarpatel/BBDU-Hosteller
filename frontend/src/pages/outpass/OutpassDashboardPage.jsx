import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import outpassService from '../../services/outpassService.js';
import api from '../../services/api.js';

const PURPOSES = [
  'COLLEGE_WORK',
  'FAMILY_VISIT',
  'MEDICAL',
  'PERSONAL',
  'EMERGENCY',
  'OFFICIAL_WORK',
  'OTHER',
];

const GOVT_ID_TYPES = [
  'AADHAAR',
  'PAN',
  'VOTER_ID',
  'DRIVING_LICENSE',
  'PASSPORT',
  'COLLEGE_ID',
  'OTHER',
];

export default function OutpassDashboardPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isWarden = user?.role === 'WARDEN';
  const isStaff = user?.role === 'HOSTEL_STAFF';
  const isSupervisor = ['WARDEN', 'AUTHORITY', 'SUPER_ADMIN'].includes(user?.role);
  const canGateVerify = ['HOSTEL_STAFF', 'WARDEN', 'SUPER_ADMIN'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('outpasses'); // 'outpasses', 'gate', 'visitors', 'overdue'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Core Data
  const [stats, setStats] = useState(null);
  const [outpasses, setOutpasses] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [hostels, setHostels] = useState([]);

  // Filters
  const [selectedHostel, setSelectedHostel] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({
    purpose: 'PERSONAL',
    destination: '',
    departureAt: '',
    expectedReturnAt: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    remarks: '',
  });

  const [showDigitalPassModal, setShowDigitalPassModal] = useState(false);
  const [activeDigitalPass, setActiveDigitalPass] = useState(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeOutpassForReview, setActiveOutpassForReview] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve'); // 'approve' or 'reject'
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    phone: '',
    relationship: '',
    purpose: '',
    governmentIdType: 'AADHAAR',
    governmentId: '',
    remarks: '',
  });

  // Gate Token Verification Box
  const [gateTokenInput, setGateTokenInput] = useState('');
  const [gateTokenResult, setGateTokenResult] = useState(null);
  const [verifyingToken, setVerifyingToken] = useState(false);

  // Status Alerts
  const [actionMsg, setActionMsg] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedHostel) params.hostelId = selectedHostel;
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      const [statsRes, outpassesRes, visitorsRes, hostelsRes] = await Promise.all([
        !isStudent
          ? outpassService.getDashboardStats(params).catch(() => ({ success: false }))
          : Promise.resolve({ success: false }),
        outpassService.getOutpasses(params),
        outpassService.getVisitors(params),
        api.get('/admin/hostels').catch(() => ({ data: { data: [] } })),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (outpassesRes.success) setOutpasses(outpassesRes.data);
      if (visitorsRes.success) setVisitors(visitorsRes.data);
      if (hostelsRes?.data?.data) setHostels(hostelsRes.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Error loading records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedHostel, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleRunScheduler = async () => {
    try {
      setSubmittingAction(true);
      const res = await outpassService.runSchedulerCheck();
      setActionMsg({
        type: 'success',
        text: `Overdue check complete: ${res.data.overdueMarkedCount} outpasses marked overdue.`,
      });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Scheduler run failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitOutpassRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAction(true);
      await outpassService.createOutpassRequest({
        purpose: requestForm.purpose,
        destination: requestForm.destination,
        departureAt: requestForm.departureAt,
        expectedReturnAt: requestForm.expectedReturnAt,
        emergencyContact: {
          name: requestForm.emergencyContactName,
          phone: requestForm.emergencyContactPhone,
          relation: requestForm.emergencyContactRelation,
        },
        remarks: requestForm.remarks,
      });

      setShowRequestModal(false);
      setRequestForm({
        purpose: 'PERSONAL',
        destination: '',
        departureAt: '',
        expectedReturnAt: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        remarks: '',
      });
      setActionMsg({ type: 'success', text: 'Outpass request submitted for warden review.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error submitting request',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!activeOutpassForReview) return;
    try {
      setSubmittingAction(true);
      if (reviewAction === 'approve') {
        await outpassService.approveOutpass(activeOutpassForReview._id, {
          remarks: approvalRemarks,
        });
        setActionMsg({ type: 'success', text: `Outpass ${activeOutpassForReview.outpassId} approved.` });
      } else {
        if (!rejectionReason.trim()) {
          setActionMsg({ type: 'error', text: 'Rejection reason is required' });
          return;
        }
        await outpassService.rejectOutpass(activeOutpassForReview._id, {
          rejectionReason,
        });
        setActionMsg({ type: 'success', text: `Outpass ${activeOutpassForReview.outpassId} rejected.` });
      }
      setShowReviewModal(false);
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Review failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCancelOutpass = async (id) => {
    if (!confirm('Are you sure you want to cancel this outpass?')) return;
    try {
      setSubmittingAction(true);
      await outpassService.cancelOutpass(id);
      setActionMsg({ type: 'success', text: 'Outpass cancelled.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Failed to cancel outpass',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleGateVerifyExit = async (id) => {
    try {
      setSubmittingAction(true);
      await outpassService.verifyExit(id, { remarks: 'Verified at main gate' });
      setActionMsg({ type: 'success', text: 'Exit verified. Student status set to OUTSIDE.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Exit verification failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleGateVerifyReturn = async (id) => {
    try {
      setSubmittingAction(true);
      await outpassService.verifyReturn(id, { remarks: 'Returned through main gate' });
      setActionMsg({ type: 'success', text: 'Return verified. Outpass marked COMPLETED.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Return verification failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const openDigitalPass = async (id) => {
    try {
      const res = await outpassService.getDigitalPass(id);
      if (res.success) {
        setActiveDigitalPass(res.data);
        setShowDigitalPassModal(true);
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Could not load pass',
      });
    }
  };

  const handleVerifyPassToken = async (e) => {
    e.preventDefault();
    if (!gateTokenInput.trim()) return;
    setVerifyingToken(true);
    setGateTokenResult(null);
    try {
      const res = await outpassService.verifyPassToken(gateTokenInput.trim());
      if (res.success) {
        setGateTokenResult(res.data);
      }
    } catch (err) {
      setGateTokenResult({
        error: err?.response?.data?.message || 'Invalid or expired pass token',
      });
    } finally {
      setVerifyingToken(false);
    }
  };

  const submitVisitorRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmittingAction(true);
      await outpassService.requestVisitor(visitorForm);
      setShowVisitorModal(false);
      setVisitorForm({
        visitorName: '',
        phone: '',
        relationship: '',
        purpose: '',
        governmentIdType: 'AADHAAR',
        governmentId: '',
        remarks: '',
      });
      setActionMsg({ type: 'success', text: 'Visitor registered successfully.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error registering visitor',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleVisitorCheckIn = async (id) => {
    try {
      setSubmittingAction(true);
      await outpassService.checkInVisitor(id, { remarks: 'Checked in at Gate 1' });
      setActionMsg({ type: 'success', text: 'Visitor checked in.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Check-in failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleVisitorCheckOut = async (id) => {
    try {
      setSubmittingAction(true);
      await outpassService.checkOutVisitor(id, { remarks: 'Visitor departed' });
      setActionMsg({ type: 'success', text: 'Visitor checked out.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Check-out failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleVisitorApprove = async (id) => {
    try {
      setSubmittingAction(true);
      await outpassService.approveVisitor(id);
      setActionMsg({ type: 'success', text: 'Visitor approved.' });
      await loadData();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Approval failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      PENDING: 'bg-amber-100 text-amber-800',
      APPROVED: 'bg-emerald-100 text-emerald-800 font-semibold',
      REJECTED: 'bg-rose-100 text-rose-800',
      CANCELLED: 'bg-slate-200 text-slate-700',
      OUTSIDE: 'bg-indigo-100 text-indigo-800 font-bold',
      RETURN_VERIFIED: 'bg-green-100 text-green-900 font-bold',
      OVERDUE: 'bg-rose-600 text-white font-bold animate-pulse',
      REQUESTED: 'bg-amber-100 text-amber-800',
      CHECKED_IN: 'bg-sky-100 text-sky-800 font-bold',
      CHECKED_OUT: 'bg-slate-100 text-slate-600',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${map[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <DashboardLayout title="Visitor & Outpass Management" roleLabel={user?.role}>
      <div className="space-y-6">
        {/* Banner & Action Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Campus Movement &amp; Visitor Registry</h2>
            <p className="text-xs text-slate-500 mt-1">
              Digital outpasses, QR gate verifications, expected return monitoring, and guest check-ins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isStudent && hostels.length > 0 && (
              <select
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Hostels</option>
                {hostels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}

            {isSupervisor && (
              <button
                onClick={handleRunScheduler}
                disabled={submittingAction}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                title="Detect students who exceeded their expected return deadline"
              >
                ⚡ Run Overdue Check
              </button>
            )}

            {isStudent && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs"
              >
                + Request Outpass
              </button>
            )}

            <button
              onClick={() => setShowVisitorModal(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              + Register Visitor
            </button>
          </div>
        </div>

        {/* Action Status Feedback */}
        {actionMsg && (
          <div
            className={`p-4 rounded-lg text-xs font-medium flex items-center justify-between ${
              actionMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{actionMsg.text}</span>
            <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        )}

        {/* Operational KPI Metric Cards */}
        {stats && !isStudent && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Currently Outside</span>
              <div className="text-xl font-bold text-indigo-600 mt-1">{stats.currentlyOutside}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Students off campus</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Review</span>
              <div className="text-xl font-bold text-amber-600 mt-1">{stats.pendingRequests}</div>
              <div className="text-[10px] text-amber-500 mt-0.5">{stats.emergencyPending} emergency alerts</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Overdue Alerts</span>
              <div className="text-xl font-bold text-rose-600 mt-1">{stats.overdueOutpasses}</div>
              <div className="text-[10px] text-rose-400 mt-0.5">Late return breaches</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Approved Today</span>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.approvedToday}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Issued digital passes</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Returns Verified</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">{stats.returnsToday}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">Safely returned today</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Visitors</span>
              <div className="text-xl font-bold text-sky-600 mt-1">{stats.activeVisitors}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Currently checked in</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('outpasses')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'outpasses'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 {isStudent ? 'My Outpasses' : 'Outpass Registry'} ({outpasses.length})
            </button>

            {canGateVerify && (
              <button
                onClick={() => setActiveTab('gate')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'gate'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🚪 Gate Exit &amp; Return Control
              </button>
            )}

            <button
              onClick={() => setActiveTab('visitors')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'visitors'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              👥 Visitors ({visitors.length})
            </button>

            {!isStudent && (
              <button
                onClick={() => setActiveTab('overdue')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'overdue'
                    ? 'border-rose-600 text-rose-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                ⚠️ Overdue Students Monitor ({outpasses.filter((o) => o.status === 'OVERDUE').length})
              </button>
            )}
          </nav>
        </div>

        {/* TAB 1: OUTPASSES LIST */}
        {activeTab === 'outpasses' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
              <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search outpass ID or destination..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 w-full sm:w-64 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 transition"
                >
                  Search
                </button>
              </form>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved (Digital Pass Ready)</option>
                <option value="OUTSIDE">Currently Outside</option>
                <option value="RETURN_VERIFIED">Returned (Completed)</option>
                <option value="OVERDUE">Overdue</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : outpasses.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                No outpasses found.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Outpass ID</th>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Purpose &amp; Destination</th>
                        <th className="px-4 py-3">Departure &amp; Return</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {outpasses.map((op) => (
                        <tr key={op._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-700">
                            {op.outpassId}
                            {op.isEmergency && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                EMERGENCY
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{op.studentId?.name || 'Student'}</div>
                            <div className="text-[11px] text-slate-400">
                              {op.hostelId?.name} &bull; Room {op.roomId?.roomNumber || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{op.destination}</div>
                            <div className="text-[11px] text-slate-500">{op.purpose}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div>
                              Depart: {new Date(op.departureAt).toLocaleDateString()}{' '}
                              {new Date(op.departureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Return: {new Date(op.expectedReturnAt).toLocaleDateString()}{' '}
                              {new Date(op.expectedReturnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(op.status)}</td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            {/* View Digital Pass */}
                            {['APPROVED', 'OUTSIDE', 'OVERDUE', 'RETURN_VERIFIED'].includes(op.status) && (
                              <button
                                onClick={() => openDigitalPass(op._id)}
                                className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px]"
                              >
                                View Pass
                              </button>
                            )}

                            {/* Warden Approval */}
                            {isSupervisor && op.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => {
                                    setActiveOutpassForReview(op);
                                    setReviewAction('approve');
                                    setApprovalRemarks('');
                                    setShowReviewModal(true);
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px]"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveOutpassForReview(op);
                                    setReviewAction('reject');
                                    setRejectionReason('');
                                    setShowReviewModal(true);
                                  }}
                                  className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium text-[11px]"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Student Cancel */}
                            {isStudent && ['PENDING', 'APPROVED'].includes(op.status) && (
                              <button
                                onClick={() => handleCancelOutpass(op._id)}
                                className="px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px]"
                              >
                                Cancel
                              </button>
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
        )}

        {/* TAB 2: GATE EXIT & RETURN CONTROL */}
        {activeTab === 'gate' && canGateVerify && (
          <div className="space-y-6">
            {/* Quick QR Token Scanner / Lookup */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-800 text-sm">Gate Pass Verification Scanner</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan student digital pass QR or enter the pass token to verify authenticity before granting exit or return.
              </p>
              <form onSubmit={handleVerifyPassToken} className="mt-3 flex gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="Enter or scan pass token..."
                  value={gateTokenInput}
                  onChange={(e) => setGateTokenInput(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 w-full font-mono focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={verifyingToken}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  {verifyingToken ? 'Checking...' : 'Verify'}
                </button>
              </form>

              {gateTokenResult && (
                <div className="mt-4 p-4 rounded-lg border bg-slate-50 text-xs">
                  {gateTokenResult.error ? (
                    <div className="text-rose-600 font-semibold">{gateTokenResult.error}</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-400 text-[10px]">Student Name:</span>
                        <div className="font-bold text-slate-800">{gateTokenResult.studentName}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Outpass ID:</span>
                        <div className="font-mono font-bold text-indigo-700">{gateTokenResult.outpassId}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Expected Return:</span>
                        <div className="font-medium">{new Date(gateTokenResult.expectedReturnAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Current Status:</span>
                        <div>{getStatusBadge(gateTokenResult.status)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Approved Outpasses Awaiting Exit */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Approved Students Ready for Exit</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="px-3 py-2">Outpass ID</th>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Destination</th>
                      <th className="px-3 py-2">Expected Return</th>
                      <th className="px-3 py-2 text-right">Gate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {outpasses.filter((o) => o.status === 'APPROVED').length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                          No students awaiting exit.
                        </td>
                      </tr>
                    ) : (
                      outpasses
                        .filter((o) => o.status === 'APPROVED')
                        .map((op) => (
                          <tr key={op._id}>
                            <td className="px-3 py-2 font-mono font-bold text-indigo-700">{op.outpassId}</td>
                            <td className="px-3 py-2 font-medium">{op.studentId?.name}</td>
                            <td className="px-3 py-2">{op.destination}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {new Date(op.expectedReturnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleGateVerifyExit(op._id)}
                                className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-[11px]"
                              >
                                Log Exit
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Students Currently Outside Awaiting Return */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Students Currently Outside Awaiting Return</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="px-3 py-2">Outpass ID</th>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Exited At</th>
                      <th className="px-3 py-2">Expected Return</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Gate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {outpasses.filter((o) => ['OUTSIDE', 'OVERDUE'].includes(o.status)).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                          No students currently outside.
                        </td>
                      </tr>
                    ) : (
                      outpasses
                        .filter((o) => ['OUTSIDE', 'OVERDUE'].includes(o.status))
                        .map((op) => (
                          <tr key={op._id}>
                            <td className="px-3 py-2 font-mono font-bold text-indigo-700">{op.outpassId}</td>
                            <td className="px-3 py-2 font-medium">{op.studentId?.name}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {op.actualExitAt ? new Date(op.actualExitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {new Date(op.expectedReturnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2">{getStatusBadge(op.status)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleGateVerifyReturn(op._id)}
                                className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 font-semibold text-[11px]"
                              >
                                Log Return
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VISITORS */}
        {activeTab === 'visitors' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Visitor ID</th>
                      <th className="px-4 py-3">Visitor Name &amp; Contact</th>
                      <th className="px-4 py-3">Student Host</th>
                      <th className="px-4 py-3">Relation &amp; Purpose</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {visitors.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No visitor records logged.
                        </td>
                      </tr>
                    ) : (
                      visitors.map((v) => (
                        <tr key={v._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{v.visitorId}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{v.visitorName}</div>
                            <div className="text-[11px] text-slate-400">
                              Phone: {v.phone} {v.governmentIdLast4 ? `• ID: ***${v.governmentIdLast4}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{v.studentId?.name || 'Student'}</div>
                            <div className="text-[11px] text-slate-400">{v.hostelId?.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{v.purpose}</div>
                            <div className="text-[11px] text-slate-500">Relationship: {v.relationship}</div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(v.status)}</td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            {isSupervisor && v.status === 'REQUESTED' && (
                              <button
                                onClick={() => handleVisitorApprove(v._id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px]"
                              >
                                Approve
                              </button>
                            )}

                            {canGateVerify && v.status === 'APPROVED' && (
                              <button
                                onClick={() => handleVisitorCheckIn(v._id)}
                                className="px-2.5 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 font-semibold text-[11px]"
                              >
                                Check In
                              </button>
                            )}

                            {canGateVerify && v.status === 'CHECKED_IN' && (
                              <button
                                onClick={() => handleVisitorCheckOut(v._id)}
                                className="px-2.5 py-1 rounded bg-slate-800 text-white hover:bg-slate-900 font-semibold text-[11px]"
                              >
                                Check Out
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: OVERDUE MONITOR */}
        {activeTab === 'overdue' && !isStudent && (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
              <h3 className="font-bold text-rose-800 text-sm">Emergency Outreach &amp; Overdue Monitor</h3>
              <p className="text-xs text-rose-700 mt-1">
                The students below have breached their approved outpass return time. Use emergency contacts to initiate outreach.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Outpass ID</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Expected Return</th>
                      <th className="px-4 py-3">Emergency Contact</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {outpasses.filter((o) => o.status === 'OVERDUE').length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No students are currently overdue.
                        </td>
                      </tr>
                    ) : (
                      outpasses
                        .filter((o) => o.status === 'OVERDUE')
                        .map((op) => (
                          <tr key={op._id} className="bg-rose-50/30">
                            <td className="px-4 py-3 font-mono font-bold text-rose-700">{op.outpassId}</td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800">{op.studentId?.name}</div>
                              <div className="text-[11px] text-slate-400">Phone: {op.studentId?.phone || 'N/A'}</div>
                            </td>
                            <td className="px-4 py-3">{op.destination}</td>
                            <td className="px-4 py-3 font-semibold text-rose-600">
                              {new Date(op.expectedReturnAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              {op.emergencyContact?.name ? (
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {op.emergencyContact.name} ({op.emergencyContact.relation || 'Parent'})
                                  </div>
                                  <div className="text-[11px] text-indigo-600 font-mono font-bold">
                                    📞 {op.emergencyContact.phone}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">None provided</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canGateVerify && (
                                <button
                                  onClick={() => handleGateVerifyReturn(op._id)}
                                  className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 font-semibold text-[11px]"
                                >
                                  Log Late Return
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REQUEST OUTPASS */}
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Request Digital Hostel Outpass</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Submit your travel schedule for warden approval. Once approved, you will receive a digital gate pass.
              </p>

              <form onSubmit={submitOutpassRequest} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose *</label>
                    <select
                      value={requestForm.purpose}
                      onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      {PURPOSES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Destination *</label>
                    <input
                      type="text"
                      required
                      value={requestForm.destination}
                      onChange={(e) => setRequestForm({ ...requestForm, destination: e.target.value })}
                      placeholder="e.g. Home, Market, Doctor Clinic"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Date &amp; Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={requestForm.departureAt}
                      onChange={(e) => setRequestForm({ ...requestForm, departureAt: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Return *</label>
                    <input
                      type="datetime-local"
                      required
                      value={requestForm.expectedReturnAt}
                      onChange={(e) => setRequestForm({ ...requestForm, expectedReturnAt: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Emergency Contact Details
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Name (e.g. Parent)"
                        value={requestForm.emergencyContactName}
                        onChange={(e) => setRequestForm({ ...requestForm, emergencyContactName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Relation (Father/Mother)"
                        value={requestForm.emergencyContactRelation}
                        onChange={(e) => setRequestForm({ ...requestForm, emergencyContactRelation: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={requestForm.emergencyContactPhone}
                        onChange={(e) => setRequestForm({ ...requestForm, emergencyContactPhone: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={requestForm.remarks}
                    onChange={(e) => setRequestForm({ ...requestForm, remarks: e.target.value })}
                    placeholder="Optional notes for warden review"
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    Submit Outpass Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DIGITAL OUTPASS (PASS BADGE) */}
        {showDigitalPassModal && activeDigitalPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border-2 border-indigo-500 overflow-hidden relative">
              <div className="text-center pb-4 border-b border-dashed border-slate-200">
                <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  BBDU HOSTELLER &bull; DIGITAL GATE PASS
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">{activeDigitalPass.outpassId}</h3>
                <div className="text-xs text-slate-500">{activeDigitalPass.hostel}</div>
              </div>

              {/* QR Code / Secure Token Representation */}
              <div className="my-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-24 h-24 bg-white border border-slate-300 p-2 rounded-lg flex items-center justify-center shadow-xs">
                  {/* Decorative QR Pattern representation */}
                  <div className="w-full h-full border-2 border-slate-800 flex flex-col justify-between p-1">
                    <div className="flex justify-between">
                      <div className="w-3 h-3 bg-slate-800" />
                      <div className="w-3 h-3 bg-slate-800" />
                    </div>
                    <div className="text-[8px] font-mono text-center font-bold text-indigo-700">PASS VALID</div>
                    <div className="flex justify-between">
                      <div className="w-3 h-3 bg-slate-800" />
                      <div className="w-2 h-2 bg-indigo-600" />
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-mono font-bold text-slate-500 tracking-wider">
                  TOKEN: {activeDigitalPass.verificationToken?.slice(0, 16)}...
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-800">{activeDigitalPass.studentName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Student ID:</span>
                  <span className="font-mono text-slate-700">{activeDigitalPass.studentIdNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-semibold text-slate-800">{activeDigitalPass.destination}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Expected Return:</span>
                  <span className="font-bold text-rose-600">
                    {new Date(activeDigitalPass.expectedReturnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                    ({new Date(activeDigitalPass.expectedReturnAt).toLocaleDateString()})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Approved By:</span>
                  <span className="text-slate-700 font-medium">{activeDigitalPass.approvedBy || 'Warden'}</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 flex justify-center">
                <button
                  onClick={() => setShowDigitalPassModal(false)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
                >
                  Close Pass
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: WARDEN REVIEW (APPROVE / REJECT) */}
        {showReviewModal && activeOutpassForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Warden Review: {activeOutpassForReview.outpassId}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Student: {activeOutpassForReview.studentId?.name} &bull; Destination:{' '}
                {activeOutpassForReview.destination}
              </p>

              <form onSubmit={submitReview} className="mt-4 space-y-4">
                <div className="flex items-center gap-4 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="reviewDec"
                      checked={reviewAction === 'approve'}
                      onChange={() => setReviewAction('approve')}
                      className="text-green-600"
                    />
                    Approve Request
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="radio"
                      name="reviewDec"
                      checked={reviewAction === 'reject'}
                      onChange={() => setReviewAction('reject')}
                      className="text-rose-600"
                    />
                    Reject Request
                  </label>
                </div>

                {reviewAction === 'approve' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Approval Remarks</label>
                    <input
                      type="text"
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="e.g. Permitted. Return strictly before curfew."
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-rose-700 mb-1">
                      Reason for Rejection *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Late hours unapproved, parental consent required."
                      className="w-full rounded-lg border border-rose-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-xs ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {reviewAction === 'approve' ? 'Approve & Issue Pass' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: REGISTER VISITOR */}
        {showVisitorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Register Hostel Visitor</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Record guest identification and purpose for security gate entry.
              </p>

              <form onSubmit={submitVisitorRequest} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Visitor Name *</label>
                    <input
                      type="text"
                      required
                      value={visitorForm.visitorName}
                      onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })}
                      placeholder="Full Name"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={visitorForm.phone}
                      onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                      placeholder="Contact number"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship *</label>
                    <input
                      type="text"
                      required
                      value={visitorForm.relationship}
                      onChange={(e) => setVisitorForm({ ...visitorForm, relationship: e.target.value })}
                      placeholder="Father, Guardian, Friend"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose *</label>
                    <input
                      type="text"
                      required
                      value={visitorForm.purpose}
                      onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
                      placeholder="Meeting, Dropping belongings"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Govt ID Type</label>
                    <select
                      value={visitorForm.governmentIdType}
                      onChange={(e) => setVisitorForm({ ...visitorForm, governmentIdType: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    >
                      {GOVT_ID_TYPES.map((idType) => (
                        <option key={idType} value={idType}>
                          {idType}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Govt ID Number (Privacy protected)
                    </label>
                    <input
                      type="text"
                      value={visitorForm.governmentId}
                      onChange={(e) => setVisitorForm({ ...visitorForm, governmentId: e.target.value })}
                      placeholder="Only last 4 digits stored"
                      className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowVisitorModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    Register Visitor
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
