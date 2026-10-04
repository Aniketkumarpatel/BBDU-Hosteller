import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardLayout from '../../layouts/DashboardLayout.jsx';
import LoadingSpinner from '../../components/common/LoadingSpinner.jsx';
import studentServicesService from '../../services/studentServicesService.js';
import api from '../../services/api.js';

export default function ServiceRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isWarden = user?.role === 'WARDEN';
  const isStaff = user?.role === 'HOSTEL_STAFF';
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const canManage = isWarden || isStaff || isAdmin;

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Status Action Form
  const [statusForm, setStatusForm] = useState({
    status: '',
    notes: '',
    resolutionNote: '',
    rejectionReason: '',
    actionRequiredNote: '',
  });

  // Verification Form
  const [verificationForm, setVerificationForm] = useState({
    isSatisfied: true,
    feedback: '',
  });

  // Assign Form
  const [assigneeId, setAssigneeId] = useState('');
  const [staffList, setStaffList] = useState([]);

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentServicesService.getServiceRequestById(id);
      setRequest(res.data);
      if (res.data.status) {
        setStatusForm((prev) => ({ ...prev, status: res.data.status }));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching request details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // Load staff for assignment if manager
  useEffect(() => {
    if (canManage) {
      api.get('/admin/users', { params: { role: 'HOSTEL_STAFF' } })
        .then((res) => {
          setStaffList(res.data.data?.users || res.data.data || []);
        })
        .catch(() => {});
    }
  }, [canManage]);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    try {
      await studentServicesService.updateServiceRequestStatus(id, statusForm);
      setActionSuccess(`Status updated to ${statusForm.status}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchRequest();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update request status');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assigneeId) return;
    try {
      await studentServicesService.assignServiceRequest(id, { assignedTo: assigneeId });
      setActionSuccess('Request assigned successfully');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchRequest();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign request');
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    try {
      await studentServicesService.verifyServiceRequest(id, verificationForm);
      setActionSuccess(
        verificationForm.isSatisfied
          ? 'Verification complete. Request has been closed.'
          : 'Report submitted. Request reopened for follow-up.'
      );
      setTimeout(() => setActionSuccess(null), 4000);
      fetchRequest();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit verification');
    }
  };

  const handleCancelRequest = async () => {
    if (!window.confirm('Are you sure you want to cancel this service request?')) return;
    try {
      await studentServicesService.updateServiceRequestStatus(id, {
        status: 'CANCELLED',
        notes: 'Request cancelled by student.',
      });
      setActionSuccess('Service request cancelled.');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchRequest();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  const statusBadgeColor = (status) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-800';
      case 'IN_PROGRESS':
      case 'ASSIGNED':
        return 'bg-indigo-100 text-indigo-800';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-24"><LoadingSpinner /></div>
      </DashboardLayout>
    );
  }

  if (error || !request) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <p className="font-semibold">{error || 'Request not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/student-services')}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            ← Back to Student Services
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/student-services"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            ← Back to Student Services
          </Link>
          <span className="font-mono text-xs font-bold text-slate-400">ID: {request.requestId}</span>
        </div>

        {/* Action Success Alert */}
        {actionSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {actionSuccess}
          </div>
        )}

        {/* Main Details Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
                  {request.category}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeColor(request.status)}`}>
                  {request.status}
                </span>
                <span className="text-xs font-semibold text-slate-400">• Priority: {request.priority}</span>
              </div>
              <h1 className="mt-3 text-xl font-bold text-slate-900">{request.title}</h1>
              <p className="mt-1 text-xs text-slate-500">
                Submitted on {new Date(request.submittedAt || request.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Quick student cancellation button if applicable */}
            {isStudent && ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status) && (
              <button
                type="button"
                onClick={handleCancelRequest}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                Cancel Request
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Request Description</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
              {request.description}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Student Requester</span>
              <p className="mt-1 font-bold text-slate-900">{request.studentId?.name || 'Student'}</p>
              <p className="text-slate-500">{request.studentId?.phone || request.studentId?.email}</p>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Hostel Location</span>
              <p className="mt-1 font-bold text-slate-900">{request.hostelId?.name || 'Campus'}</p>
              <p className="text-slate-500">
                Room {request.roomId?.roomNumber || '—'} (Floor {request.floorId?.floorNumber || '—'})
              </p>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Assigned Staff</span>
              <p className="mt-1 font-bold text-slate-900">
                {request.assignedTo ? request.assignedTo.name : 'Unassigned'}
              </p>
              {request.assignedTo && <p className="text-slate-500">{request.assignedTo.email}</p>}
            </div>

            <div>
              <span className="text-slate-400 font-medium">Resolution Status</span>
              <p className="mt-1 font-bold text-slate-900">
                {request.resolvedAt ? `Resolved on ${new Date(request.resolvedAt).toLocaleDateString()}` : 'In Workflow'}
              </p>
            </div>
          </div>

          {/* Resolution / Rejection Notes if set */}
          {request.resolutionNote && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs text-emerald-900">
              <strong className="block font-bold">Staff Resolution Note:</strong>
              <p className="mt-1">{request.resolutionNote}</p>
            </div>
          )}

          {request.rejectionReason && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs text-rose-900">
              <strong className="block font-bold">Rejection Reason:</strong>
              <p className="mt-1">{request.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Action Panel for Student Verification */}
        {isStudent && request.status === 'RESOLVED' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-6 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900">Verify Service Resolution</h3>
            <p className="mt-1 text-xs text-slate-600">
              Staff marked this request as resolved. Please verify if your request was satisfied.
            </p>

            <form onSubmit={handleVerificationSubmit} className="mt-4 space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="satisfaction"
                    checked={verificationForm.isSatisfied === true}
                    onChange={() => setVerificationForm({ ...verificationForm, isSatisfied: true })}
                    className="text-emerald-600"
                  />
                  <span>✓ Satisfied (Close Request)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="satisfaction"
                    checked={verificationForm.isSatisfied === false}
                    onChange={() => setVerificationForm({ ...verificationForm, isSatisfied: false })}
                    className="text-rose-600"
                  />
                  <span>✕ Unsatisfied (Reopen for Rework)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Student Feedback / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional verification comments..."
                  value={verificationForm.feedback}
                  onChange={(e) => setVerificationForm({ ...verificationForm, feedback: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800"
              >
                Submit Verification
              </button>
            </form>
          </div>
        )}

        {/* Action Panel for Staff & Warden */}
        {canManage && (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Staff Assignment */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">Assign Request</h3>
              <form onSubmit={handleAssign} className="mt-3 space-y-3">
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
                >
                  <option value="">Select Staff Member...</option>
                  {staffList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!assigneeId}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Assign Staff
                </button>
              </form>
            </div>

            {/* Status Transition */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">Update Request Workflow</h3>
              <form onSubmit={handleStatusUpdate} className="mt-3 space-y-3">
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
                >
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>

                {statusForm.status === 'RESOLVED' && (
                  <input
                    type="text"
                    required
                    placeholder="Resolution note (e.g. Relocated to Room 204)"
                    value={statusForm.resolutionNote}
                    onChange={(e) => setStatusForm({ ...statusForm, resolutionNote: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                )}

                {statusForm.status === 'REJECTED' && (
                  <input
                    type="text"
                    required
                    placeholder="Reason for rejection"
                    value={statusForm.rejectionReason}
                    onChange={(e) => setStatusForm({ ...statusForm, rejectionReason: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                )}

                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Apply Status Change
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Chronological Audit Timeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <h3 className="text-base font-bold text-slate-900">Action History &amp; Audit Trail</h3>
          <div className="mt-6 space-y-4">
            {request.timeline?.length === 0 ? (
              <p className="text-xs text-slate-400">No timeline history recorded.</p>
            ) : (
              request.timeline?.map((t, idx) => (
                <div key={t._id || idx} className="relative flex items-start gap-4 pb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{t.action}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(t.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {t.notes && <p className="mt-1 text-xs text-slate-600">{t.notes}</p>}
                    <span className="mt-1 block text-2xs text-slate-400">
                      By: {t.performedBy?.name || 'System / Staff'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
