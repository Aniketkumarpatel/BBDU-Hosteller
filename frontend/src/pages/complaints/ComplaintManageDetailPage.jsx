import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import complaintService from '../../services/complaintService.js';
import departmentService from '../../services/departmentService.js';
import workOrderService from '../../services/workOrderService.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Modal from '../../components/common/Modal.jsx';
import SlaBadge from '../../components/sla/SlaBadge.jsx';
import ComplaintSlaSection from '../../components/sla/ComplaintSlaSection.jsx';

export default function ComplaintManageDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [eligibleStaff, setEligibleStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Modals state
  const [triageModalOpen, setTriageModalOpen] = useState(false);
  const [triageForm, setTriageForm] = useState({ priority: 'MEDIUM', departmentId: '', triageNote: '' });
  const [triageSubmitting, setTriageSubmitting] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ assignedTo: '', reason: '' });
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignForm, setReassignForm] = useState({ assignedTo: '', reason: '' });
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Step 5.3: Resolve Modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const isWarden = user?.role === 'WARDEN';
  const isAuthority = user?.role === 'AUTHORITY';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isStaff = user?.role === 'HOSTEL_STAFF';

  const canManage = isWarden || isAuthority || isSuperAdmin;

  const currentUserId = user?._id || user?.id;
  const isCurrentAssignee =
    complaint?.assignedTo &&
    (complaint.assignedTo._id === currentUserId || complaint.assignedTo === currentUserId || isSuperAdmin);

  const roleLabel =
    isWarden ? 'Warden' : isStaff ? 'Hostel Staff' : isAuthority ? 'Authority' : isSuperAdmin ? 'Administrator' : 'Staff';

  const backLink =
    isWarden ? '/warden/complaints' : isStaff ? '/staff/complaints' : '/authority/complaints';

  const fetchComplaintData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [compRes, assignRes, resHist, woRes] = await Promise.all([
        complaintService.getComplaintDetails(id),
        complaintService.getComplaintAssignments(id).catch(() => ({ data: [] })),
        complaintService.getComplaintResolutions(id).catch(() => ({ data: [] })),
        workOrderService.getWorkOrders({ complaintId: id }).catch(() => ({ data: [] })),
      ]);

      if (compRes.success && compRes.data) {
        setComplaint(compRes.data);
        setAssignments(assignRes?.data || []);
        setResolutions(resHist?.data || []);
        setWorkOrders(woRes?.data || []);

        setTriageForm({
          priority: compRes.data.priority || 'MEDIUM',
          departmentId: compRes.data.departmentId?._id || compRes.data.departmentId || '',
          triageNote: compRes.data.triageNote || '',
        });
      } else {
        setError(compRes.message || 'Failed to load complaint');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load complaint data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaintData();
  }, [id]);

  // Load departments for triage modal
  useEffect(() => {
    if (canManage && (complaint?.status === 'SUBMITTED' || triageModalOpen)) {
      complaintService.getComplaintMeta().then((res) => {
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      }).catch(() => {
        departmentService.listDepartments().then((res) => {
          if (res.success && res.data) setDepartments(res.data);
        }).catch(() => {});
      });
    }
  }, [canManage, complaint?.status, triageModalOpen]);

  const fetchEligibleAssignees = async () => {
    try {
      const res = await complaintService.getEligibleAssignees(id);
      if (res.success && res.data) {
        setEligibleStaff(res.data);
      }
    } catch (err) {
      setActionError('Could not load eligible staff: ' + (err?.response?.data?.message || err.message));
    }
  };

  const handleOpenAssignModal = async () => {
    setActionError('');
    setActionSuccess('');
    await fetchEligibleAssignees();
    setAssignForm({ assignedTo: '', reason: '' });
    setAssignModalOpen(true);
  };

  const handleOpenReassignModal = async () => {
    setActionError('');
    setActionSuccess('');
    await fetchEligibleAssignees();
    setReassignForm({ assignedTo: '', reason: '' });
    setReassignModalOpen(true);
  };

  const handleOpenResolveModal = () => {
    setActionError('');
    setActionSuccess('');
    setResolveNote('');
    setResolveModalOpen(true);
  };

  // Actions
  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    if (!triageForm.departmentId) {
      setActionError('Department selection is required for triaging');
      return;
    }
    setTriageSubmitting(true);
    setActionError('');
    try {
      const res = await complaintService.triageComplaint(id, triageForm);
      if (res.success) {
        setActionSuccess('Complaint successfully triaged!');
        setTriageModalOpen(false);
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Triage failed');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Triage failed');
    } finally {
      setTriageSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.assignedTo) {
      setActionError('Please select a staff member to assign');
      return;
    }
    setAssignSubmitting(true);
    setActionError('');
    try {
      const res = await complaintService.assignComplaint(id, assignForm);
      if (res.success) {
        setActionSuccess('Complaint assigned successfully!');
        setAssignModalOpen(false);
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Assignment failed');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Assignment failed');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignForm.assignedTo) {
      setActionError('Please select a new staff member');
      return;
    }
    if (!reassignForm.reason.trim()) {
      setActionError('Reason for reassignment is mandatory for audit compliance');
      return;
    }
    setReassignSubmitting(true);
    setActionError('');
    try {
      const res = await complaintService.reassignComplaint(id, reassignForm);
      if (res.success) {
        setActionSuccess('Complaint successfully reassigned!');
        setReassignModalOpen(false);
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Reassignment failed');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Reassignment failed');
    } finally {
      setReassignSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!window.confirm('Confirm that you are acknowledging this assigned complaint?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await complaintService.acknowledgeComplaint(id);
      if (res.success) {
        setActionSuccess('Ticket acknowledged successfully!');
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Acknowledgment failed');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Acknowledgment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async () => {
    if (!window.confirm('Confirm that you are beginning work on this complaint?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await complaintService.startWorkOnComplaint(id);
      if (res.success) {
        setActionSuccess('Work marked as In Progress!');
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Could not update status');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Could not update status');
    } finally {
      setActionLoading(false);
    }
  };

  // Step 5.3: Submit Resolution
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveNote.trim() || resolveNote.trim().length < 5) {
      setActionError('Please provide a detailed resolution note (at least 5 characters).');
      return;
    }
    setResolveSubmitting(true);
    setActionError('');
    try {
      const res = await complaintService.resolveComplaint(id, { resolutionNote: resolveNote.trim() });
      if (res.success) {
        setActionSuccess('Complaint marked as resolved! Ticket is now waiting for student verification.');
        setResolveModalOpen(false);
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Resolution submission failed');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Resolution submission failed');
    } finally {
      setResolveSubmitting(false);
    }
  };

  // Step 5.3: Resume Work
  const handleResumeWork = async () => {
    if (!window.confirm('Confirm resuming work on this reopened complaint?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await complaintService.resumeWorkOnComplaint(id);
      if (res.success) {
        setActionSuccess('Work resumed! Complaint status updated to In Progress.');
        await fetchComplaintData();
      } else {
        setActionError(res.message || 'Could not resume work');
      }
    } catch (err) {
      setActionError(err?.response?.data?.message || err.message || 'Could not resume work');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadge = (p) => {
    const map = {
      LOW: 'bg-blue-100 text-blue-700',
      MEDIUM: 'bg-emerald-100 text-emerald-700',
      HIGH: 'bg-amber-100 text-amber-700',
      CRITICAL: 'bg-rose-100 text-rose-700 font-bold animate-pulse',
    };
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[p] || 'bg-slate-100 text-slate-700'}`}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s) => {
    const map = {
      SUBMITTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      TRIAGED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
      ACKNOWLEDGED: 'bg-sky-50 text-sky-700 border-sky-200',
      IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
      STUDENT_VERIFICATION: 'bg-purple-100 text-purple-800 border-purple-300 font-bold animate-pulse',
      RESOLVED: 'bg-purple-50 text-purple-700 border-purple-200',
      CLOSED: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      REOPENED: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${map[s] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        <span className="h-2 w-2 rounded-full bg-current" />
        {s?.replace(/_/g, ' ')}
      </span>
    );
  };

  // Workflow progress calculation
  const workflowSteps = [
    { key: 'SUBMITTED', label: '1. Submitted' },
    { key: 'TRIAGED', label: '2. Triaged' },
    { key: 'ASSIGNED', label: '3. Assigned' },
    { key: 'ACKNOWLEDGED', label: '4. Acknowledged' },
    { key: 'IN_PROGRESS', label: '5. In Progress' },
    { key: 'STUDENT_VERIFICATION', label: '6. Verification' },
    { key: 'CLOSED', label: '7. Closed' },
  ];

  const getStepStatus = (stepKey) => {
    const order = ['SUBMITTED', 'TRIAGED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'STUDENT_VERIFICATION', 'CLOSED'];
    const currentIndex = order.indexOf(complaint?.status === 'REOPENED' ? 'IN_PROGRESS' : complaint?.status);
    const stepIndex = order.indexOf(stepKey);

    if (complaint?.status === 'CLOSED') return 'complete';
    if (currentIndex > stepIndex) return 'complete';
    if (currentIndex === stepIndex) return 'current';
    return 'upcoming';
  };

  if (loading) {
    return (
      <DashboardLayout title="Complaint Details &amp; Operations" roleLabel={roleLabel}>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" message="Loading operational ticket data..." />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !complaint) {
    return (
      <DashboardLayout title="Complaint Details" roleLabel={roleLabel}>
        <div className="mx-auto max-w-lg">
          <ErrorState
            title="Unable to Access Complaint"
            message={error || 'Ticket not found'}
            onRetry={fetchComplaintData}
          />
          <div className="mt-4 text-center">
            <Link to={backLink} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              &larr; Back to Complaints Queue
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Operational Ticket: ${complaint.complaintId}`} roleLabel={roleLabel}>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigation & Status Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to={backLink}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Queue
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Database ID: {complaint._id}</span>
          </div>
        </div>

        {/* Notifications */}
        {actionSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-600 hover:text-emerald-900">&times;</button>
          </div>
        )}

        {actionError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError('')} className="text-rose-600 hover:text-rose-900">&times;</button>
          </div>
        )}

        {/* REOPENED BANNER */}
        {complaint.status === 'REOPENED' && (
          <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-full bg-rose-600 flex items-center justify-center text-white shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">
                    Complaint Reopened by Student (Attempt #{complaint.reopenCount || 1})
                  </h3>
                  <p className="text-xs text-rose-800 mt-0.5">
                    <strong>Student Reason:</strong> "{complaint.reopenReason}"
                  </p>
                  <p className="text-[11px] text-rose-600 mt-1">
                    Reopened on: {complaint.reopenedAt ? new Date(complaint.reopenedAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>

              {(isCurrentAssignee || canManage) && (
                <button
                  onClick={handleResumeWork}
                  disabled={actionLoading}
                  className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  {actionLoading ? 'Resuming...' : 'Resume Work (In Progress)'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* STUDENT VERIFICATION PENDING BANNER */}
        {complaint.status === 'STUDENT_VERIFICATION' && (
          <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-bold text-purple-900">
                  Resolution Submitted: Waiting for Student Verification
                </h3>
                <p className="text-xs text-purple-800 mt-0.5">
                  <strong>Resolution Note:</strong> "{complaint.resolutionNote}"
                </p>
                <p className="text-[11px] text-purple-600 mt-1">
                  Submitted by {complaint.resolvedBy?.name || 'Staff'} on {complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleString() : 'N/A'}. Awaiting student inspection.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CLOSED BANNER */}
        {complaint.status === 'CLOSED' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-bold text-emerald-900">Complaint Closed &amp; Verified</h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Verified by student {complaint.verifiedBy?.name || 'Resident'} on {complaint.verifiedAt ? new Date(complaint.verifiedAt).toLocaleString() : 'N/A'}.
                </p>
                {complaint.verificationNote && (
                  <p className="text-xs text-emerald-700 italic mt-1">
                    Student remark: "{complaint.verificationNote}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header Summary & Operational Action Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded">
                  {complaint.complaintId}
                </span>
                {getPriorityBadge(complaint.priority)}
                <span className="rounded bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase">
                  {complaint.category}
                </span>
                {complaint.departmentId && (
                  <span className="rounded bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
                    Dept: {complaint.departmentId.name || complaint.departmentId}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900">{complaint.title}</h1>
              <p className="text-xs text-slate-500">
                Issue Type: <span className="font-medium text-slate-700">{complaint.issueType?.replace(/_/g, ' ')}</span> &bull; Submitted {new Date(complaint.submittedAt || complaint.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Quick Status and Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <SlaBadge
                  slaStatus={complaint.slaStatus}
                  slaDueAt={complaint.slaDueAt}
                  slaStartedAt={complaint.slaStartedAt}
                  reminderSentAt={complaint.reminderSentAt}
                  complaintStatus={complaint.status}
                  escalationLevel={complaint.currentEscalationLevel}
                />
                {getStatusBadge(complaint.status)}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Triage Button (Warden/Authority/Admin when SUBMITTED) */}
                {canManage && complaint.status === 'SUBMITTED' && (
                  <button
                    onClick={() => {
                      setActionError('');
                      setActionSuccess('');
                      setTriageModalOpen(true);
                    }}
                    className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition flex items-center gap-1.5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Triage Ticket
                  </button>
                )}

                {/* 2. Assign Button (Warden/Authority/Admin when TRIAGED) */}
                {canManage && complaint.status === 'TRIAGED' && (
                  <button
                    onClick={handleOpenAssignModal}
                    className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition flex items-center gap-1.5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Assign Staff
                  </button>
                )}

                {/* 3. Reassign Button (Warden/Authority/Admin when ASSIGNED, ACKNOWLEDGED, or IN_PROGRESS) */}
                {canManage && ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(complaint.status) && (
                  <button
                    onClick={handleOpenReassignModal}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition flex items-center gap-1.5"
                  >
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Reassign Staff
                  </button>
                )}

                {/* 4. Acknowledge Button (Assigned Staff when ASSIGNED) */}
                {isCurrentAssignee && complaint.status === 'ASSIGNED' && (
                  <button
                    onClick={handleAcknowledge}
                    disabled={actionLoading}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {actionLoading ? 'Acknowledging...' : 'Acknowledge Assignment'}
                  </button>
                )}

                {/* 5. Start Work Button (Assigned Staff when ACKNOWLEDGED) */}
                {isCurrentAssignee && complaint.status === 'ACKNOWLEDGED' && (
                  <button
                    onClick={handleStartWork}
                    disabled={actionLoading}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {actionLoading ? 'Starting...' : 'Start Work (In Progress)'}
                  </button>
                )}

                {/* 6. Mark as Resolved Button (Step 5.3: when IN_PROGRESS) */}
                {(isCurrentAssignee || canManage) && complaint.status === 'IN_PROGRESS' && (
                  <button
                    onClick={handleOpenResolveModal}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition flex items-center gap-1.5"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as Resolved
                  </button>
                )}

                {/* 7. Resume Work Button (Step 5.3: when REOPENED) */}
                {(isCurrentAssignee || canManage) && complaint.status === 'REOPENED' && (
                  <button
                    onClick={handleResumeWork}
                    disabled={actionLoading}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    {actionLoading ? 'Resuming...' : 'Resume Work'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Issue Description</h3>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-4 rounded-lg border border-slate-100">
              {complaint.description}
            </p>
          </div>
        </div>

        {/* Workflow Lifecycle Stepper */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Workflow Lifecycle
          </h2>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
            {workflowSteps.map((st) => {
              const state = getStepStatus(st.key);
              return (
                <div
                  key={st.key}
                  className={`rounded-lg border p-3 text-center transition ${
                    state === 'complete'
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                      : state === 'current'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20 font-bold'
                      : 'border-slate-200 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                    {state === 'complete' && (
                      <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {state === 'current' && <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />}
                    <span className="truncate">{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time SLA & Escalation Engine Tracking */}
        <ComplaintSlaSection complaint={complaint} />

        {/* Operational Overview Grid: Assignee & Resolution Status */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Assignee Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Assigned Responsible Person
              </h2>
              {complaint.assignedTo ? (
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  ASSIGNED
                </span>
              ) : (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  UNASSIGNED
                </span>
              )}
            </div>

            {complaint.assignedTo ? (
              <dl className="mt-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Staff Member</dt>
                  <dd className="font-bold text-slate-900">{complaint.assignedTo.name}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Employee ID</dt>
                  <dd className="font-mono text-slate-700">{complaint.assignedTo.employeeId || 'STAFF'}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Email Address</dt>
                  <dd className="text-slate-700">{complaint.assignedTo.email}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="text-slate-700">{complaint.assignedTo.phone || 'N/A'}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Assigned At</dt>
                  <dd className="text-slate-700">
                    {complaint.assignedAt ? new Date(complaint.assignedAt).toLocaleString() : 'N/A'}
                  </dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Acknowledged At</dt>
                  <dd className="text-slate-700">
                    {complaint.acknowledgedAt ? (
                      <span className="font-semibold text-emerald-700">
                        {new Date(complaint.acknowledgedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">Pending Acknowledgment</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-500">Work Started At</dt>
                  <dd className="text-slate-700">
                    {complaint.startedAt ? (
                      <span className="font-semibold text-emerald-700">
                        {new Date(complaint.startedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-400">Not started yet</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                No staff member has been assigned yet.
              </div>
            )}
          </div>

          {/* Resolution & Verification Status Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Resolution &amp; Verification
              </h2>
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {complaint.status}
              </span>
            </div>

            <dl className="mt-4 space-y-3">
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Resolved By</dt>
                <dd className="font-semibold text-slate-900">{complaint.resolvedBy?.name || 'Not resolved yet'}</dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Resolved Date</dt>
                <dd className="text-slate-700">
                  {complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleString() : 'N/A'}
                </dd>
              </div>

              {complaint.resolutionNote && (
                <div className="rounded-lg bg-purple-50 p-2.5 border border-purple-100">
                  <dt className="text-[11px] font-bold text-purple-800">Resolution Note</dt>
                  <dd className="mt-0.5 text-xs text-slate-800 italic">"{complaint.resolutionNote}"</dd>
                </div>
              )}

              <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                <dt className="text-slate-500">Verified By Student</dt>
                <dd className="font-semibold text-slate-900">{complaint.verifiedBy?.name || 'Pending'}</dd>
              </div>

              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Verified Date</dt>
                <dd className="text-slate-700">
                  {complaint.verifiedAt ? new Date(complaint.verifiedAt).toLocaleString() : 'Pending verification'}
                </dd>
              </div>

              {complaint.verificationNote && (
                <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-100">
                  <dt className="text-[11px] font-bold text-emerald-800">Student Verification Remark</dt>
                  <dd className="mt-0.5 text-xs text-slate-800 italic">"{complaint.verificationNote}"</dd>
                </div>
              )}

              {complaint.reopenReason && (
                <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-100">
                  <dt className="text-[11px] font-bold text-rose-800">Student Reopen Reason</dt>
                  <dd className="mt-0.5 text-xs text-slate-800 italic">"{complaint.reopenReason}"</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Location & Resident Profile */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Resident Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
              Student / Complainant Profile
            </h2>
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-semibold text-slate-900">{complaint.studentId?.name || '-'}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Student ID / Roll No</dt>
                <dd className="font-mono text-slate-700">{complaint.studentId?.studentId || '-'}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-700">{complaint.studentId?.email || '-'}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-slate-700">{complaint.studentId?.phone || 'Not provided'}</dd>
              </div>
            </dl>
          </div>

          {/* Location Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
              Hostel Location
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <dt className="text-slate-500 text-[11px]">Hostel</dt>
                <dd className="font-semibold text-slate-900">{complaint.hostelId?.name || '-'}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <dt className="text-slate-500 text-[11px]">Block</dt>
                <dd className="font-semibold text-slate-900">{complaint.blockId?.name || '-'}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <dt className="text-slate-500 text-[11px]">Floor</dt>
                <dd className="font-semibold text-slate-900">
                  {complaint.floorId?.name || (complaint.floorId?.floorNumber !== undefined ? `Floor ${complaint.floorId.floorNumber}` : '-')}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <dt className="text-slate-500 text-[11px]">Room Number</dt>
                <dd className="font-bold text-indigo-700 font-mono">
                  Room {complaint.roomId?.roomNumber || '-'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Operational Maintenance Work Orders (Step 8) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Maintenance Work Orders</h2>
              <p className="text-xs text-slate-500">Operational tasks and technician job orders spawned for this complaint</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {workOrders.length} Order{workOrders.length === 1 ? '' : 's'}
              </span>
              <Link
                to="/work-orders"
                className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                + Work Orders Console
              </Link>
            </div>
          </div>

          {workOrders.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Work Order ID</th>
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Assigned Staff</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Priority</th>
                    <th className="px-4 py-2.5">Due At</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((wo) => (
                    <tr key={wo._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-indigo-600">
                        <Link to={`/work-orders/${wo._id}`} className="hover:underline">
                          {wo.workOrderId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{wo.title}</td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">
                        {wo.assignedTo?.name || <span className="italic text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {wo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-700">{wo.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {wo.dueAt ? new Date(wo.dueAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/work-orders/${wo._id}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View Order →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              No work orders currently open for this ticket.
            </div>
          )}
        </div>

        {/* Chronological Resolution & Verification History Table (Step 5.3) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Resolution &amp; Student Verification Cycles</h2>
              <p className="text-xs text-slate-500">Audit trail of all technician resolutions and student verification decisions</p>
            </div>
            <span className="font-mono text-xs text-slate-500">
              {resolutions.length} Cycle{resolutions.length === 1 ? '' : 's'}
            </span>
          </div>

          {resolutions.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Attempt</th>
                    <th className="px-4 py-2.5">Resolved By</th>
                    <th className="px-4 py-2.5">Resolution Note</th>
                    <th className="px-4 py-2.5">Resolved Date</th>
                    <th className="px-4 py-2.5">Student Decision</th>
                    <th className="px-4 py-2.5">Feedback / Reopen Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resolutions.map((res) => (
                    <tr key={res._id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        #{res.attemptNumber || 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {res.resolvedBy?.name || 'Staff'}
                        <span className="block text-[10px] font-normal text-slate-400">{res.resolvedBy?.role}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        "{res.resolutionNote}"
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">
                        {new Date(res.resolvedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {res.verificationDecision === 'ACCEPT' ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Accepted (Closed)
                          </span>
                        ) : res.verificationDecision === 'REJECT' ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            Rejected (Reopened)
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Awaiting Verification
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 italic max-w-xs truncate">
                        {res.reopenReason || res.verificationNote || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              No resolution history recorded yet for this ticket.
            </div>
          )}
        </div>

        {/* Chronological Assignment History */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Assignment History &amp; Reassignment Audit Trail</h2>
              <p className="text-xs text-slate-500">Permanent chronological log of all staff allocations and changes</p>
            </div>
            <span className="font-mono text-xs text-slate-500">
              {assignments.length} Record{assignments.length === 1 ? '' : 's'}
            </span>
          </div>

          {assignments.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Date &amp; Time</th>
                    <th className="px-4 py-2.5">Assigned By</th>
                    <th className="px-4 py-2.5">Assigned To</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Reason / Note</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((asg) => (
                    <tr key={asg._id} className={asg.isCurrent ? 'bg-blue-50/40 font-medium' : 'hover:bg-slate-50/60'}>
                      <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">
                        {new Date(asg.assignedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {asg.assignedBy?.name || 'System'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {asg.assignedTo?.name || '-'}
                        {asg.previousAssignee && (
                          <span className="block text-[10px] text-amber-700 font-normal">
                            (Replaced: {asg.previousAssignee.name})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {asg.departmentId?.name || '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {asg.assignmentType}
                      </td>
                      <td className="px-4 py-3 text-slate-700 italic max-w-xs truncate">
                        {asg.reason || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {asg.isCurrent ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Current
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            Superseded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              No assignment history recorded yet for this ticket.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: TRIAGE MODAL */}
      <Modal
        isOpen={triageModalOpen}
        onClose={() => setTriageModalOpen(false)}
        title="Triage Complaint"
        subtitle={`Set priority classification and assign service department for ticket ${complaint.complaintId}`}
      >
        <form onSubmit={handleTriageSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Priority Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={triageForm.priority}
              onChange={(e) => setTriageForm({ ...triageForm, priority: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              required
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsible Department <span className="text-rose-500">*</span>
            </label>
            <select
              value={triageForm.departmentId}
              onChange={(e) => setTriageForm({ ...triageForm, departmentId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              required
            >
              <option value="">-- Select Department --</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Triage Note (Optional)
            </label>
            <textarea
              rows={3}
              value={triageForm.triageNote}
              onChange={(e) => setTriageForm({ ...triageForm, triageNote: e.target.value })}
              placeholder="Add instructions, initial verification notes, or observations..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setTriageModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={triageSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {triageSubmitting ? 'Triaging...' : 'Complete Triage'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ASSIGN STAFF MODAL */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Responsible Staff"
        subtitle={`Select qualified maintenance staff for ticket ${complaint.complaintId}`}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Staff Member <span className="text-rose-500">*</span>
            </label>
            <select
              value={assignForm.assignedTo}
              onChange={(e) => setAssignForm({ ...assignForm, assignedTo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              required
            >
              <option value="">-- Choose Qualified Staff --</option>
              {eligibleStaff.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.name} ({st.employeeId || 'STAFF'}) &bull; {st.departmentId?.name || 'General'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assignment Note / Instruction (Optional)
            </label>
            <textarea
              rows={3}
              value={assignForm.reason}
              onChange={(e) => setAssignForm({ ...assignForm, reason: e.target.value })}
              placeholder="E.g., Please visit room and check the switchboard on priority..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {assignSubmitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: REASSIGN STAFF MODAL */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Reassign Staff Member"
        subtitle={`Transfer ticket ${complaint.complaintId} to another staff member with mandatory reason`}
      >
        <form onSubmit={handleReassignSubmit} className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <strong>Current Assignee:</strong> {complaint.assignedTo?.name || 'None'} ({complaint.assignedTo?.employeeId || 'STAFF'})
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select New Staff Member <span className="text-rose-500">*</span>
            </label>
            <select
              value={reassignForm.assignedTo}
              onChange={(e) => setReassignForm({ ...reassignForm, assignedTo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              required
            >
              <option value="">-- Choose New Staff --</option>
              {eligibleStaff
                .filter((st) => st._id !== (complaint.assignedTo?._id || complaint.assignedTo))
                .map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.employeeId || 'STAFF'}) &bull; {st.departmentId?.name || 'General'}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Reassignment Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reassignForm.reason}
              onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
              placeholder="State clear operational reason: e.g., Technician on leave, emergency shift..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setReassignModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reassignSubmitting}
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {reassignSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: MARK AS RESOLVED MODAL (Step 5.3) */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Mark Complaint as Resolved"
        subtitle={`Submit resolution for ticket ${complaint.complaintId}. Ticket will be forwarded to the resident student for verification.`}
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900">
            <strong>Resolution Confirmation:</strong> Confirming resolution transitions this complaint to <strong>STUDENT_VERIFICATION</strong>. The resident student will be asked to inspect and verify before closure.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Resolution Note &amp; Actions Performed <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Detail the work performed: e.g., Replaced washer on bathroom tap, inspected drainage pipe, tested water flow..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
              required
            />
            <p className="mt-1 text-[11px] text-slate-400">Minimum 5 characters. Max 2000 characters.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResolveModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resolveSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {resolveSubmitting ? 'Submitting Resolution...' : 'Submit Resolution'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
